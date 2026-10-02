import { NextRequest, NextResponse } from "next/server";
import { isKeeperBillingCycle, isKeeperPlanId, KEEPER_BILLING_PLANS } from "@/lib/billing-plans";
import { getAuthenticatedSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient, getRazorpayKeyId } from "@/lib/razorpay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
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
    const razorpay = getRazorpayClient();
    const admin = createSupabaseAdminClient();
    const { data: activePlan, error: lookupError } = await admin.from("billing_subscriptions").select("id").eq("user_id", user.id).in("status", ["trialing", "authenticated", "active"]).gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
    if (lookupError) throw new Error("Could not check your current plan.");
    if (activePlan) return NextResponse.json({ error: "You already have an active plan. Cancel its renewal before starting another." }, { status: 409 });
    const { data: pendingPlan, error: pendingError } = await admin.from("billing_subscriptions").select("id").eq("user_id", user.id).eq("status", "created").gt("created_at", new Date(Date.now() - 30 * 60 * 1000).toISOString()).limit(1).maybeSingle();
    if (pendingError) throw new Error("Could not check for an existing checkout.");
    if (pendingPlan) return NextResponse.json({ error: "A plan checkout is already in progress. Complete it or try again in 30 minutes." }, { status: 409 });
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
    console.error("Subscription checkout creation failed:", error);
    return NextResponse.json({ error: "Secure checkout could not be started. Please try again." }, { status: 502 });
  }
}
