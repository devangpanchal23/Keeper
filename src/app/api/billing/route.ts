import { after, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getRazorpayClient } from "@/lib/razorpay";
import { createReceiptRetryTask } from "@/lib/razorpay-receipts";
import { logServerError } from "@/lib/monitoring";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  try { supabase = await createSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "Billing is not configured yet. Complete the Supabase server setup first." }, { status: 503 }); }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to view billing." }, { status: 401 });

  try {
    const [subscriptionsResult, paymentsResult] = await Promise.all([
      supabase.from("billing_subscriptions").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("billing_payments").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    ]);
    if (subscriptionsResult.error || paymentsResult.error) throw new Error("Billing records are unavailable.");

    const now = Date.now();
    const subscriptions = subscriptionsResult.data || [];
    const current = subscriptions.find((entry) => {
      const entitledStatus = ["trialing", "authenticated", "active"].includes(entry.status) || (entry.status === "cancelled" && entry.cancel_at_cycle_end);
      const periodEnd = entry.current_period_end || entry.trial_ends_at;
      const end = periodEnd ? Date.parse(periodEnd) : Number.POSITIVE_INFINITY;
      return entitledStatus && end > now;
    }) || null;
    const tier = current ? current.plan : "free";
    const displaySubscriptions = subscriptions.map((entry) => {
      const periodEnd = entry.current_period_end || entry.trial_ends_at;
      if (["trialing", "authenticated", "active"].includes(entry.status) && periodEnd && Date.parse(periodEnd) <= now) {
        return { ...entry, status: "expired" };
      }
      return entry;
    });

    const payments = paymentsResult.data || [];
    const response = NextResponse.json({ current, subscriptions: displaySubscriptions, payments, tier }, { headers: { "Cache-Control": "no-store" } });
    const missingReceipts = payments.filter((payment) => !payment.receipt_url && payment.razorpay_invoice_id).slice(0, 3);
    if (missingReceipts.length) {
      after(createReceiptRetryTask(missingReceipts, {
        fetchInvoice: (invoiceId) => getRazorpayClient().invoices.fetch(invoiceId),
        saveReceiptUrl: async (paymentId, receiptUrl) => {
          const admin = createSupabaseAdminClient();
          const { error } = await admin.from("billing_payments").update({ receipt_url: receiptUrl })
            .eq("razorpay_payment_id", paymentId).eq("user_id", user.id).is("receipt_url", null);
          if (error) throw new Error("Payment receipt link could not be saved.");
        },
        timeoutMs: 2_000,
      }));
    }
    return response;
  } catch (error) {
    logServerError({ operation: "billing.profile.query", route: "/api/billing" }, error);
    return NextResponse.json({ error: "Billing records could not be loaded." }, { status: 503 });
  }
}
