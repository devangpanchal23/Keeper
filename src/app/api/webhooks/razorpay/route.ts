import { after, NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient } from "@/lib/razorpay";
import { logServerError } from "@/lib/monitoring";
import { handleRazorpayWebhook, type RazorpayWebhookStore } from "@/lib/razorpay-webhook-handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  return handleRazorpayWebhook(request, {
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
    createStore: () => {
      const admin = createSupabaseAdminClient();
      const store: RazorpayWebhookStore = {
        async claimEvent(eventId, eventType) {
          const { error: insertError } = await admin.from("razorpay_webhook_events").insert({ event_id: eventId, event_type: eventType, processed_at: null });
          if (!insertError) return "claimed";
          if (insertError.code !== "23505") throw new Error("Webhook event claim failed.");
          const { data, error } = await admin.from("razorpay_webhook_events").select("processed_at").eq("event_id", eventId).maybeSingle();
          if (error || !data) throw new Error("Webhook event claim could not be checked.");
          return data.processed_at ? "processed" : "unprocessed";
        },
        async markEventProcessed(eventId) {
          const { error } = await admin.from("razorpay_webhook_events").update({ processed_at: new Date().toISOString() }).eq("event_id", eventId);
          if (error) throw new Error("Webhook event completion could not be saved.");
        },
        async findSubscription(subscriptionId) {
          const { data, error } = await admin.from("billing_subscriptions").select("id,user_id,plan,billing_cycle,amount,currency,status").eq("razorpay_subscription_id", subscriptionId).maybeSingle();
          if (error) throw new Error("Subscription record lookup failed.");
          return data;
        },
        async updateSubscription(id, values) {
          const { error } = await admin.from("billing_subscriptions").update(values).eq("id", id);
          if (error) throw new Error("Subscription state update failed.");
        },
        async upsertCapturedPayment(values) {
          const { data: existing, error: lookupError } = await admin.from("billing_payments").select("receipt_url").eq("razorpay_payment_id", values.razorpay_payment_id).maybeSingle();
          if (lookupError) throw new Error("Payment history lookup failed.");
          const { error } = await admin.from("billing_payments").upsert({ ...values, receipt_url: existing?.receipt_url || null }, { onConflict: "razorpay_payment_id" });
          if (error) throw new Error("Payment history update failed.");
        },
        async recordPaymentFailure(values) {
          const { error } = await admin.from("billing_payment_failures").upsert(values, { onConflict: "event_id", ignoreDuplicates: true });
          if (error) throw new Error("Payment failure record could not be saved.");
        },
        async updateReceiptUrl(paymentId, receiptUrl) {
          const { error } = await admin.from("billing_payments").update({ receipt_url: receiptUrl }).eq("razorpay_payment_id", paymentId).is("receipt_url", null);
          if (error) throw new Error("Payment receipt link could not be saved.");
        },
      };
      return store;
    },
    scheduleAfterResponse: (work) => after(work),
    fetchInvoice: (invoiceId) => getRazorpayClient().invoices.fetch(invoiceId),
    logError: (error) => logServerError({ operation: "billing.webhook.process", route: "/api/webhooks/razorpay" }, error),
  });
}
