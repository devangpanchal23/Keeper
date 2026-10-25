import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isKeeperBillingCycle, isKeeperPlanId, KEEPER_BILLING_PLANS } from "@/lib/billing-plans";
import { logServerError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type CheckoutSubscription = {
  id: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_cycle_end: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type CheckoutBlockReason = "active_or_trial" | "pending" | "cancelled_with_access" | "created_checkout" | "recent_authenticated";

function getCheckoutBlockDecision(
  subscriptions: CheckoutSubscription[],
  now = Date.now(),
): { reason: CheckoutBlockReason | null; unknownExpiryRows: Array<Pick<CheckoutSubscription, "id" | "status">> } {
  const expiryTime = (subscription: CheckoutSubscription): number | null => {
    const value = subscription.current_period_end || subscription.trial_ends_at;
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  };
  const withinWindow = (values: Array<string | null>): boolean =>
    values.some((value) => {
      if (value === null) return false;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) && timestamp >= now - 30 * 60 * 1000 && timestamp <= now;
    });

  const unknownExpiryRows = subscriptions
    .filter((subscription) => ["active", "trialing"].includes(subscription.status) && expiryTime(subscription) === null)
    .map(({ id, status }) => ({ id, status }));

  const activeOrTrial = subscriptions.some((subscription) => {
    const expiry = expiryTime(subscription);
    if (["active", "trialing"].includes(subscription.status)) return expiry === null || expiry > now;
    return subscription.status === "authenticated" && expiry !== null && expiry > now;
  });
  if (activeOrTrial) return { reason: "active_or_trial", unknownExpiryRows };
  if (subscriptions.some((subscription) => subscription.status === "pending")) {
    return { reason: "pending", unknownExpiryRows };
  }
  if (subscriptions.some((subscription) => {
    const expiry = expiryTime(subscription);
    return ["cancelled", "canceled"].includes(subscription.status)
      && subscription.cancel_at_cycle_end
      && expiry !== null
      && expiry > now;
  })) {
    return { reason: "cancelled_with_access", unknownExpiryRows };
  }
  if (subscriptions.some((subscription) => subscription.status === "created" && withinWindow([subscription.created_at]))) {
    return { reason: "created_checkout", unknownExpiryRows };
  }
  if (subscriptions.some((subscription) =>
    subscription.status === "authenticated" && expiryTime(subscription) === null
      && withinWindow([subscription.updated_at, subscription.created_at]))) {
    return { reason: "recent_authenticated", unknownExpiryRows };
  }
  return { reason: null, unknownExpiryRows };
}

const checkoutBlockMessages: Record<CheckoutBlockReason, string> = {
  active_or_trial: "You already have an active plan or trial. Cancel its renewal before starting another.",
  pending: "A subscription is pending. Complete or resolve it before starting another checkout.",
  cancelled_with_access: "Your cancelled plan still has paid access. Wait until that period ends before starting another plan.",
  created_checkout: "A plan checkout is already in progress. Complete it or try again later.",
  recent_authenticated: "Your subscription authorization is still being processed. Please wait before starting another checkout.",
};

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
  try {
    const [{ createSupabaseAdminClient }, { getRazorpayClient, getRazorpayKeyId }] = await Promise.all([
      import("@/lib/supabase/admin"),
      import("@/lib/razorpay"),
    ]);
    const razorpay = getRazorpayClient();
    const admin = createSupabaseAdminClient();
    const { data: subscriptions, error: lookupError } = await admin.from("billing_subscriptions")
      .select("id,status,current_period_end,trial_ends_at,cancel_at_cycle_end,created_at,updated_at")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "authenticated", "pending", "cancelled", "canceled", "created"])
      .order("created_at", { ascending: false });
    if (lookupError) throw new Error("Could not check your current plan.");
    const decision = getCheckoutBlockDecision((subscriptions || []) as CheckoutSubscription[]);
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
    const { data: cachedPlan, error: planLookupError } = await admin.from("billing_plan_catalog").select("razorpay_plan_id,amount").eq("plan_key", planKey).maybeSingle();
    if (planLookupError) throw new Error("Billing plan catalog is unavailable. Apply the Supabase migration first.");
    let razorpayPlanId = cachedPlan?.razorpay_plan_id;
    if (cachedPlan && cachedPlan.amount !== price.amount) throw new Error("The configured Razorpay plan amount does not match the current Keeper price.");
    if (!razorpayPlanId) {
      const razorpayPlan = await razorpay.plans.create({
        period,
        interval: 1,
        item: { name: `Keeper ${plan === "basic" ? "Basic" : "Pro"} · ${billingCycle}`, amount: price.amount, currency: "INR", description: price.credits < 0 ? "Unlimited saves and imports" : `${price.credits.toLocaleString("en-IN")} import credits per ${billingCycle === "yearly" ? "year" : "month"}` },
        notes: { keeper_plan: plan, keeper_billing_cycle: billingCycle },
      });
      const { error: catalogInsertError } = await admin.from("billing_plan_catalog").insert({ plan_key: planKey, razorpay_plan_id: razorpayPlan.id, amount: price.amount });
      if (catalogInsertError && catalogInsertError.code !== "23505") throw new Error("Razorpay plan could not be saved to the catalog.");
      const { data: storedPlan, error: storedPlanError } = await admin.from("billing_plan_catalog").select("razorpay_plan_id").eq("plan_key", planKey).single();
      if (storedPlanError || !storedPlan) throw new Error("Razorpay plan could not be resolved.");
      razorpayPlanId = storedPlan.razorpay_plan_id;
    }
    const trialEndsAt = Math.floor(Date.now() / 1000) + 7 * 86400;
    const subscription = await razorpay.subscriptions.create({
      plan_id: razorpayPlanId,
      total_count: billingCycle === "monthly" ? 120 : 10,
      customer_notify: 0,
      start_at: trialEndsAt,
      expire_by: trialEndsAt + 30 * 86400,
      notes: { keeper_user_id: user.id, keeper_plan: plan, keeper_billing_cycle: billingCycle },
    });
    const { error } = await admin.from("billing_subscriptions").insert({
      user_id: user.id,
      razorpay_subscription_id: subscription.id,
      razorpay_plan_id: razorpayPlanId,
      plan,
      billing_cycle: billingCycle,
      amount: price.amount,
      status: subscription.status,
      trial_ends_at: new Date(trialEndsAt * 1000).toISOString(),
      next_payment_at: new Date(trialEndsAt * 1000).toISOString(),
    });
    if (error) throw new Error("Could not save the pending subscription record.");
    return NextResponse.json({ subscription_id: subscription.id, key_id: getRazorpayKeyId(), trial_ends_at: new Date(trialEndsAt * 1000).toISOString() }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    logServerError({ operation: "billing.checkout.create", route: "/api/billing/checkout" }, error);
    return NextResponse.json({ error: "Secure checkout could not be started. Please try again." }, { status: 502 });
  }
}

export namespace POST {
  export const getCheckoutBlockDecisionForTests = getCheckoutBlockDecision;
}
