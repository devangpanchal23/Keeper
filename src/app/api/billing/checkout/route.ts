import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isKeeperBillingCycle, isKeeperPlanId, KEEPER_BILLING_PLANS } from "@/lib/billing-plans";
import { getMissingBillingServerVariables } from "@/lib/billing-config";
import { checkoutBlockMessages, getCheckoutBlockDecision, type CheckoutSubscription } from "@/lib/billing-checkout-policy";
import { logServerError } from "@/lib/monitoring";
import { getRazorpayConfigurationError, getSafeRazorpayErrorCode } from "@/lib/razorpay-config";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckoutFailureStage = "configuration" | "subscription_lookup" | "subscription_recovery" | "plan_catalog" | "plan_create" | "subscription_create" | "subscription_save";

export async function POST(request: NextRequest) {
  const { getAuthenticatedSupabaseUser } = await import("@/lib/supabase/auth");
  let user: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>;
  try { user = await getAuthenticatedSupabaseUser(); }
  catch { return NextResponse.json({ error: "Billing is not configured yet. Complete the Supabase server setup first." }, { status: 503 }); }
  if (!user) return NextResponse.json({ error: "Sign in before starting a plan." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Select a valid Keeper plan." }, { status: 400 });
  const payload = body as Record<string, unknown>;
  if (!isKeeperPlanId(payload.plan) || !isKeeperBillingCycle(payload.billingCycle)) {
    return NextResponse.json({ error: "Select a valid Keeper plan and billing cycle." }, { status: 400 });
  }

  const { plan, billingCycle } = payload;
  const price = KEEPER_BILLING_PLANS[plan][billingCycle];
  const requestId = randomUUID();
  const razorpayConfigurationError = getRazorpayConfigurationError();
  if (razorpayConfigurationError) return NextResponse.json({ error: `${razorpayConfigurationError} Configure test-mode keys to use checkout.` }, { status: 503 });
  const missingBillingVariables = getMissingBillingServerVariables();
  if (missingBillingVariables.length) {
    return NextResponse.json({
      error: `Billing server setup is missing ${missingBillingVariables.join(" and ")}. Add it to the server environment and restart the app.`,
    }, { status: 503 });
  }

  let failureStage: CheckoutFailureStage = "configuration";
  try {
    failureStage = "subscription_lookup";
    const [{ createBackendAdminClient }, { getRazorpayClient, getRazorpayKeyId }] = await Promise.all([
      import("@/lib/database/backend-client"),
      import("@/lib/razorpay"),
    ]);
    const razorpay = getRazorpayClient();
    const admin = createBackendAdminClient();
    const { data: subscriptions, error: lookupError } = await admin.from("billing_subscriptions")
      .select("id,razorpay_subscription_id,status,current_period_end,trial_ends_at,cancel_at_cycle_end,created_at,updated_at")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "authenticated", "pending", "cancelled", "canceled", "created"])
      .order("created_at", { ascending: false });
    if (lookupError) {
      if (["42P01", "PGRST205"].includes(lookupError.code || "")) failureStage = "plan_catalog";
      throw new Error("Could not check your current plan.");
    }
    const checkoutRows = (subscriptions || []) as CheckoutSubscription[];
    failureStage = "subscription_recovery";
    for (const row of checkoutRows.filter((entry) => entry.status === "created")) {
      if (!row.razorpay_subscription_id) {
        const now = new Date().toISOString();
        const { error: recoveryError } = await admin.from("billing_subscriptions").update({
          status: "cancelled", cancel_at_cycle_end: false, trial_ends_at: null, next_payment_at: null, canceled_at: now, updated_at: now,
        }).eq("id", row.id).eq("user_id", user.id);
        if (recoveryError) throw new Error("An incomplete local checkout could not be resolved.");
        row.status = "cancelled";
        row.trial_ends_at = null;
        continue;
      }
      const remote = await razorpay.subscriptions.fetch(row.razorpay_subscription_id);
      let recoveredStatus: string | null = null;
      if (remote.status === "created") {
        const canceled = await razorpay.subscriptions.cancel(remote.id, false);
        if (["cancelled", "canceled"].includes(canceled.status)) recoveredStatus = "cancelled";
      } else if (["cancelled", "canceled"].includes(remote.status)) {
        recoveredStatus = "cancelled";
      } else if (["completed", "expired"].includes(remote.status)) {
        recoveredStatus = "completed";
      } else if (["authenticated", "active", "halted"].includes(remote.status)) {
        recoveredStatus = remote.status;
      }

      if (!recoveredStatus) continue;
      const now = new Date().toISOString();
      const isTerminal = ["cancelled", "completed"].includes(recoveredStatus);
      const { error: recoveryError } = await admin.from("billing_subscriptions").update({
        status: recoveredStatus,
        ...(isTerminal ? { trial_ends_at: null, next_payment_at: null, cancel_at_cycle_end: false, canceled_at: recoveredStatus === "cancelled" ? now : null } : {}),
        ...(remote.current_start ? { current_period_start: new Date(remote.current_start * 1000).toISOString() } : {}),
        ...(remote.current_end ? { current_period_end: new Date(remote.current_end * 1000).toISOString() } : {}),
        ...(remote.charge_at ? { next_payment_at: new Date(remote.charge_at * 1000).toISOString() } : {}),
        updated_at: now,
      }).eq("id", row.id).eq("user_id", user.id);
      if (recoveryError) throw new Error("The previous checkout was resolved by Razorpay but its status could not be saved.");
      row.status = recoveredStatus;
      if (isTerminal) {
        row.trial_ends_at = null;
        row.current_period_end = remote.current_end ? new Date(remote.current_end * 1000).toISOString() : null;
        row.cancel_at_cycle_end = false;
      } else {
        row.current_period_end = remote.current_end ? new Date(remote.current_end * 1000).toISOString() : row.current_period_end;
        row.trial_ends_at = remote.start_at ? new Date(remote.start_at * 1000).toISOString() : row.trial_ends_at;
      }
    }
    const decision = getCheckoutBlockDecision(checkoutRows as CheckoutSubscription[]);
    for (const row of decision.unknownExpiryRows) {
      console.warn("Billing checkout blocked for subscription with unknown expiry.", {
        userId: user.id,
        rowId: row.id,
        status: row.status,
      });
    }
    if (decision.reason) return NextResponse.json({ error: checkoutBlockMessages[decision.reason] }, { status: 409 });
    const period = billingCycle === "yearly" ? "yearly" : "monthly";
    const planKey = `${plan}_${billingCycle}`;
    failureStage = "plan_catalog";
    const { data: cachedPlan, error: planLookupError } = await admin.from("billing_plan_catalog").select("razorpay_plan_id,amount").eq("plan_key", planKey).maybeSingle();
    if (planLookupError) throw new Error("Billing plan catalog is unavailable. Apply the Supabase migration first.");
    let razorpayPlanId = cachedPlan?.razorpay_plan_id;
    if (cachedPlan && cachedPlan.amount !== price.amount) throw new Error("The configured Razorpay plan amount does not match the current Keeper price.");
    if (!razorpayPlanId) {
      failureStage = "plan_create";
      const razorpayPlan = await razorpay.plans.create({
        period,
        interval: 1,
        item: { name: `Keeper ${plan === "basic" ? "Basic" : "Pro"} · ${billingCycle}`, amount: price.amount, currency: "INR", description: price.credits < 0 ? "Unlimited saves and imports" : `${price.credits.toLocaleString("en-IN")} import credits per ${billingCycle === "yearly" ? "year" : "month"}` },
        notes: { keeper_plan: plan, keeper_billing_cycle: billingCycle },
      });
      failureStage = "plan_catalog";
      const { error: catalogInsertError } = await admin.from("billing_plan_catalog").insert({ plan_key: planKey, razorpay_plan_id: razorpayPlan.id, amount: price.amount });
      if (catalogInsertError && catalogInsertError.code !== "23505") throw new Error("Razorpay plan could not be saved to the catalog.");
      const { data: storedPlan, error: storedPlanError } = await admin.from("billing_plan_catalog").select("razorpay_plan_id").eq("plan_key", planKey).single();
      if (storedPlanError || !storedPlan) throw new Error("Razorpay plan could not be resolved.");
      razorpayPlanId = storedPlan.razorpay_plan_id;
    }
    const trialStartsAt = Math.floor(Date.now() / 1000);
    const trialEndsAt = trialStartsAt + 7 * 86400;
    failureStage = "subscription_create";
    const subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      total_count: billingCycle === "monthly" ? 120 : 10,
      customer_notify: 0,
      start_at: trialEndsAt,
      // Authorization must complete before the free trial ends; otherwise no charge may be scheduled.
      expire_by: trialEndsAt - 1,
      notes: { keeper_user_id: user.id, keeper_plan: plan, keeper_billing_cycle: billingCycle },
    });
    failureStage = "subscription_save";
    const { data: savedSubscription, error } = await admin.from("billing_subscriptions").insert({
      user_id: user.id,
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: razorpayPlanId,
      plan,
      billing_cycle: billingCycle,
      amount: price.amount,
      status: subscription.status,
      trial_ends_at: new Date(trialEndsAt * 1000).toISOString(),
      next_payment_at: new Date(trialEndsAt * 1000).toISOString(),
    }).select("id").single();
    if (error || !savedSubscription) {
      try {
        await razorpay.subscriptions.cancel(subscription.id, false);
      } catch (cancelError) {
        logServerError({ operation: "billing.checkout.orphan_cancel", route: "/api/billing/checkout", requestId }, cancelError);
      }
      throw new Error("Could not save the pending subscription record.");
    }
    return NextResponse.json({ subscription_id: subscription.id, subscription_record_id: savedSubscription.id, key_id: getRazorpayKeyId(), trial_ends_at: new Date(trialEndsAt * 1000).toISOString() }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const providerCode = getSafeRazorpayErrorCode(error);
    logServerError({ operation: "billing.checkout.create", route: "/api/billing/checkout", requestId, stage: failureStage, providerCode }, error);
    const errorByStage: Record<CheckoutFailureStage, string> = {
      configuration: "Secure checkout is not configured correctly. Contact support with the reference below.",
      subscription_lookup: "Keeper could not check your current plan. Please try again shortly.",
      subscription_recovery: "Keeper could not safely resolve your previous checkout. Please refresh and try again.",
      plan_catalog: "Billing storage is unavailable. Confirm the billing database migration is applied, then try again.",
      plan_create: "Razorpay could not create the billing plan. Check the test API keys and that Subscriptions are enabled for your Razorpay account.",
      subscription_create: "Razorpay could not start this subscription. Check the test API keys and Razorpay Subscriptions setup.",
      subscription_save: "Checkout setup could not be saved safely. Contact support before trying again.",
    };
    return NextResponse.json({ error: errorByStage[failureStage], referenceId: requestId }, { status: failureStage === "configuration" ? 503 : 502 });
  }
}
