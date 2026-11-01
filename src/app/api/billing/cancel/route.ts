import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseUser } from "@/lib/supabase/auth";
import { createBackendAdminClient } from "@/lib/database/backend-client";
import { getRazorpayClient } from "@/lib/razorpay";
import { logServerError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>;
  try { user = await getAuthenticatedSupabaseUser(); }
  catch { return NextResponse.json({ error: "Billing is not configured yet. Complete the Supabase server setup first." }, { status: 503 }); }
  if (!user) return NextResponse.json({ error: "Sign in to manage your subscription." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const payload = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const subscriptionId = payload.subscriptionId;
  const checkoutDismissed = payload.checkoutDismissed === true;
  if (typeof subscriptionId !== "string") return NextResponse.json({ error: "Select a valid subscription." }, { status: 400 });

  try {
    const admin = createBackendAdminClient();
    const { data: record, error } = await admin.from("billing_subscriptions").select("id,razorpay_subscription_id,status,current_period_end,trial_ends_at").eq("id", subscriptionId).eq("user_id", user.id).maybeSingle();
    if (error || !record) return NextResponse.json({ error: "Subscription not found." }, { status: 404 });
    const trialHasAccess = Boolean(record.trial_ends_at && Date.parse(record.trial_ends_at) > Date.now());
    const paidPlan = record.status === "active" && !trialHasAccess;
    if (["cancelled", "canceled"].includes(record.status)) {
      const accessEnd = record.trial_ends_at && Date.parse(record.trial_ends_at) > Date.now() ? record.trial_ends_at : record.current_period_end;
      return NextResponse.json({ success: true, status: "cancelled", access_ends_at: accessEnd });
    }
    if (!(checkoutDismissed && record.status === "created") && !trialHasAccess && !paidPlan) {
      return NextResponse.json({ error: "This subscription cannot be cancelled in its current state." }, { status: 409 });
    }
    // A trial/unfinished checkout is canceled immediately at Razorpay to remove the future charge.
    // A paid subscription still ends at the already-paid period boundary.
    const cancelAtCycleEnd = paidPlan && !checkoutDismissed;
    const updated = await getRazorpayClient().subscriptions.cancel(record.razorpay_subscription_id, cancelAtCycleEnd);
    const now = new Date().toISOString();
    const { error: updateError } = await admin.from("billing_subscriptions").update({
      status: "cancelled",
      cancel_at_cycle_end: cancelAtCycleEnd,
      canceled_at: now,
      trial_ends_at: trialHasAccess ? record.trial_ends_at : null,
      next_payment_at: null,
      updated_at: now,
    }).eq("id", record.id);
    if (updateError) throw new Error("Cancellation state could not be saved.");
    const end = cancelAtCycleEnd && updated.current_end ? new Date(updated.current_end * 1000).toISOString()
      : trialHasAccess ? record.trial_ends_at : null;
    return NextResponse.json({ success: true, status: "cancelled", access_ends_at: end });
  } catch (error) {
    logServerError({ operation: "billing.subscription.cancel", route: "/api/billing/cancel" }, error);
    return NextResponse.json({ error: "Could not cancel the subscription. Please try again." }, { status: 502 });
  }
}
