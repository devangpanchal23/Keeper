import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedSupabaseUser } from "@/lib/supabase/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient } from "@/lib/razorpay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  let user: Awaited<ReturnType<typeof getAuthenticatedSupabaseUser>>;
  try { user = await getAuthenticatedSupabaseUser(); }
  catch { return NextResponse.json({ error: "Billing is not configured yet. Complete the Supabase server setup first." }, { status: 503 }); }
  if (!user) return NextResponse.json({ error: "Sign in to confirm this subscription." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Payment verification details are missing." }, { status: 400 });
  const payload = body as Record<string, unknown>;
  const subId = payload.razorpay_subscription_id;
  const paymentId = payload.razorpay_payment_id;
  const signature = payload.razorpay_signature;
  if (typeof subId !== "string" || typeof paymentId !== "string" || typeof signature !== "string" || !/^[a-f\d]{64}$/i.test(signature)) {
    return NextResponse.json({ error: "Payment verification details are invalid." }, { status: 400 });
  }

  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) return NextResponse.json({ error: "Payments are not configured." }, { status: 503 });
  const expected = createHmac("sha256", secret).update(`${paymentId}|${subId}`).digest();
  const provided = Buffer.from(signature, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return NextResponse.json({ error: "Razorpay signature could not be verified." }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data: record, error } = await admin.from("billing_subscriptions").select("*").eq("razorpay_subscription_id", subId).eq("user_id", user.id).maybeSingle();
    if (error || !record) return NextResponse.json({ error: "This subscription is not linked to your account." }, { status: 404 });
    const razorpay = getRazorpayClient();
    const payment = await razorpay.payments.fetch(paymentId);
    if (payment.subscription_id !== subId || !["authorized", "captured"].includes(payment.status)) {
      return NextResponse.json({ error: "This payment does not match the subscription authorization." }, { status: 409 });
    }
    const subscription = await razorpay.subscriptions.fetch(subId);
    if (!subscription.notes || String(subscription.notes.keeper_user_id) !== user.id || !["authenticated", "active"].includes(subscription.status)) {
      return NextResponse.json({ error: "Razorpay has not confirmed the subscription authorization." }, { status: 409 });
    }
    const { error: updateError } = await admin.from("billing_subscriptions").update({
      status: subscription.status === "active" ? "active" : "trialing",
      current_period_start: subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : new Date().toISOString(),
      current_period_end: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : record.trial_ends_at,
      next_payment_at: subscription.charge_at ? new Date(subscription.charge_at * 1000).toISOString() : record.trial_ends_at,
      updated_at: new Date().toISOString(),
    }).eq("id", record.id);
    if (updateError) throw new Error("The confirmed subscription could not be saved.");
    return NextResponse.json({ success: true, trial_ends_at: record.trial_ends_at }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Subscription confirmation failed:", error);
    return NextResponse.json({ error: "Razorpay could not confirm the subscription. Please contact support if you were charged." }, { status: 502 });
  }
}
