import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient } from "@/lib/razorpay";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RazorpayEntity = {
  id?: string;
  status?: string;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  ended_at?: number | null;
  notes?: Record<string, string | number>;
  amount?: number;
  currency?: string;
  invoice_id?: string | null;
  created_at?: number;
};

function asEntity(value: unknown): RazorpayEntity | null {
  if (!value || typeof value !== "object") return null;
  const entity = (value as { entity?: unknown }).entity;
  return entity && typeof entity === "object" ? entity as RazorpayEntity : null;
}

export async function POST(request: NextRequest) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!secret || !signature || !eventId) return NextResponse.json({ error: "Webhook authentication is not configured." }, { status: 401 });
  const rawBody = await request.text();
  const expected = createHmac("sha256", secret).update(rawBody).digest();
  let provided: Buffer;
  try { provided = Buffer.from(signature, "hex"); }
  catch { return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 }); }
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 400 });

  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  const payload = (body as { payload?: Record<string, unknown> }).payload || {};
  const eventType = String((body as { event?: unknown }).event || "unknown");
  const subscription = asEntity(payload.subscription);
  const payment = asEntity(payload.payment);
  const subscriptionId = subscription?.id;
  if (!subscriptionId) return NextResponse.json({ received: true });

  try {
    const admin = createSupabaseAdminClient();
    const { data: record, error: lookupError } = await admin.from("billing_subscriptions").select("id,user_id,plan,billing_cycle,amount,currency,status").eq("razorpay_subscription_id", subscriptionId).maybeSingle();
    if (lookupError) throw new Error("Subscription record lookup failed.");
    if (!record) return NextResponse.json({ received: true, ignored: true });

    const terminalStatus = eventType === "subscription.cancelled" ? "cancelled"
      : eventType === "subscription.completed" ? "completed"
      : eventType === "subscription.halted" ? "halted"
      : eventType === "subscription.activated" || eventType === "subscription.charged" ? "active"
      : subscription.status || record.status;
    const { error: updateError } = await admin.from("billing_subscriptions").update({
      status: terminalStatus,
      current_period_start: subscription.current_start ? new Date(subscription.current_start * 1000).toISOString() : undefined,
      current_period_end: subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : undefined,
      next_payment_at: subscription.charge_at ? new Date(subscription.charge_at * 1000).toISOString() : null,
      canceled_at: subscription.ended_at ? new Date(subscription.ended_at * 1000).toISOString() : undefined,
      updated_at: new Date().toISOString(),
    }).eq("id", record.id);
    if (updateError) throw new Error("Subscription state update failed.");

    if (eventType === "subscription.charged" && payment?.id && typeof payment.amount === "number") {
      const invoice = payment.invoice_id ? await getRazorpayClient().invoices.fetch(payment.invoice_id) : null;
      const { error: paymentError } = await admin.from("billing_payments").upsert({
        user_id: record.user_id,
        subscription_id: record.id,
        razorpay_payment_id: payment.id,
        razorpay_invoice_id: payment.invoice_id || null,
        receipt_url: invoice?.short_url || null,
        amount: payment.amount,
        currency: payment.currency || record.currency,
        status: "captured",
        plan: record.plan,
        billing_cycle: record.billing_cycle,
        paid_at: payment.created_at ? new Date(payment.created_at * 1000).toISOString() : new Date().toISOString(),
      }, { onConflict: "razorpay_payment_id" });
      if (paymentError) throw new Error("Payment history update failed.");
    }
    const { error: eventError } = await admin.from("razorpay_webhook_events").insert({ event_id: eventId, event_type: eventType });
    if (eventError?.code === "23505") return NextResponse.json({ received: true, duplicate: true });
    if (eventError) throw new Error("Webhook idempotency record failed.");
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Razorpay webhook processing failed:", error);
    return NextResponse.json({ error: "Webhook processing failed; Razorpay may retry this event." }, { status: 500 });
  }
}
