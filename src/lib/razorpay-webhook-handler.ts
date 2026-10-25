import { verifyRazorpayWebhookSignature } from "@/lib/razorpay-signatures";

export type RazorpayWebhookEntity = {
  id?: string;
  status?: string;
  subscription_id?: string | null;
  current_start?: number | null;
  current_end?: number | null;
  charge_at?: number | null;
  ended_at?: number | null;
  notes?: Record<string, string | number>;
  amount?: number;
  currency?: string;
  invoice_id?: string | null;
  error_code?: string | null;
  error_reason?: string | null;
  created_at?: number;
};

export type RazorpayWebhookSubscription = {
  id: string;
  user_id: string;
  plan: "basic" | "pro";
  billing_cycle: "monthly" | "yearly";
  amount: number;
  currency: string;
  status: string;
};

export type RazorpayWebhookStore = {
  claimEvent: (eventId: string, eventType: string) => Promise<"claimed" | "unprocessed" | "processed">;
  markEventProcessed: (eventId: string) => Promise<void>;
  findSubscription: (razorpaySubscriptionId: string) => Promise<RazorpayWebhookSubscription | null>;
  updateSubscription: (id: string, values: Record<string, unknown>) => Promise<void>;
  upsertCapturedPayment: (values: Record<string, unknown>) => Promise<void>;
  recordPaymentFailure: (values: Record<string, unknown>) => Promise<void>;
  updateReceiptUrl: (razorpayPaymentId: string, receiptUrl: string) => Promise<void>;
};

export type RazorpayWebhookDependencies = {
  webhookSecret: string | undefined;
  createStore: () => RazorpayWebhookStore;
  scheduleAfterResponse: (work: () => Promise<void>) => void;
  fetchInvoice: (invoiceId: string) => Promise<{ short_url?: string | null }>;
  logError: (error: unknown) => void;
  receiptTimeoutMs?: number;
};

function json(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function asEntity(value: unknown): RazorpayWebhookEntity | null {
  if (!value || typeof value !== "object") return null;
  const entity = (value as { entity?: unknown }).entity;
  return entity && typeof entity === "object" ? entity as RazorpayWebhookEntity : null;
}

function toIsoDate(seconds: number | null | undefined): string | undefined {
  return seconds ? new Date(seconds * 1000).toISOString() : undefined;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeout = setTimeout(() => reject(new Error("Razorpay invoice lookup timed out.")), timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function handleRazorpayWebhook(
  request: Request,
  dependencies: RazorpayWebhookDependencies,
): Promise<Response> {
  const signature = request.headers.get("x-razorpay-signature");
  const eventId = request.headers.get("x-razorpay-event-id");
  if (!dependencies.webhookSecret || !signature || !eventId) {
    return json({ error: "Webhook authentication is not configured." }, 401);
  }

  const rawBody = await request.text();
  if (!verifyRazorpayWebhookSignature(rawBody, signature, dependencies.webhookSecret)) {
    return json({ error: "Invalid webhook signature." }, 400);
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid webhook payload." }, 400);
  }
  if (!body || typeof body !== "object") return json({ error: "Invalid webhook payload." }, 400);

  const envelope = body as { event?: unknown; payload?: Record<string, unknown> };
  const eventType = String(envelope.event || "unknown");
  const payload = envelope.payload || {};
  const subscription = asEntity(payload.subscription);
  const payment = asEntity(payload.payment);

  // Preserve the existing no-op behavior for unrelated events.
  if (!subscription?.id && eventType !== "payment.failed") return json({ received: true });

  try {
    const store = dependencies.createStore();
    const claim = await store.claimEvent(eventId, eventType);
    if (claim === "processed") return json({ received: true, duplicate: true });

    let receiptJob: { paymentId: string; invoiceId: string } | null = null;

    if (eventType === "payment.failed") {
      if (payment?.id) {
        const externalSubscriptionId = subscription?.id || payment.subscription_id || undefined;
        const linkedSubscription = externalSubscriptionId
          ? await store.findSubscription(externalSubscriptionId)
          : null;
        await store.recordPaymentFailure({
          event_id: eventId,
          razorpay_payment_id: payment.id,
          razorpay_invoice_id: payment.invoice_id || null,
          subscription_id: linkedSubscription?.id || null,
          amount: typeof payment.amount === "number" ? payment.amount : null,
          currency: payment.currency || linkedSubscription?.currency || null,
          error_code: payment.error_code || null,
          error_reason: payment.error_reason || null,
        });
      }
    } else if (subscription?.id) {
      const record = await store.findSubscription(subscription.id);
      if (record) {
        const protectedStatuses = new Set(["active", "cancelled", "completed", "halted"]);
        const isProtectedAuthentication =
          eventType === "subscription.authenticated" && protectedStatuses.has(record.status);

        if (!isProtectedAuthentication) {
          const nextStatus = eventType === "subscription.authenticated" ? "authenticated"
            : eventType === "subscription.cancelled" ? "cancelled"
            : eventType === "subscription.completed" ? "completed"
            : eventType === "subscription.halted" ? "halted"
            : eventType === "subscription.activated" || eventType === "subscription.charged" ? "active"
            : subscription.status || record.status;

          await store.updateSubscription(record.id, {
            status: nextStatus,
            current_period_start: toIsoDate(subscription.current_start),
            current_period_end: toIsoDate(subscription.current_end),
            next_payment_at: toIsoDate(subscription.charge_at) || null,
            canceled_at: toIsoDate(subscription.ended_at),
            updated_at: new Date().toISOString(),
          });
        }

        if (eventType === "subscription.charged" && payment?.id && typeof payment.amount === "number") {
          await store.upsertCapturedPayment({
            user_id: record.user_id,
            subscription_id: record.id,
            razorpay_payment_id: payment.id,
            razorpay_invoice_id: payment.invoice_id || null,
            amount: payment.amount,
            currency: payment.currency || record.currency,
            status: "captured",
            plan: record.plan,
            billing_cycle: record.billing_cycle,
            paid_at: toIsoDate(payment.created_at) || new Date().toISOString(),
          });
          if (payment.invoice_id) receiptJob = { paymentId: payment.id, invoiceId: payment.invoice_id };
        }
      }
    }

    await store.markEventProcessed(eventId);

    if (receiptJob) {
      const { paymentId, invoiceId } = receiptJob;
      dependencies.scheduleAfterResponse(async () => {
        try {
          const invoice = await withTimeout(
            dependencies.fetchInvoice(invoiceId),
            dependencies.receiptTimeoutMs ?? 2_000,
          );
          if (invoice.short_url) await store.updateReceiptUrl(paymentId, invoice.short_url);
        } catch {
          // Keep receipt_url null. The billing refresh retries using the stored invoice ID.
        }
      });
    }

    return json({ received: true });
  } catch (error) {
    dependencies.logError(error);
    return json({ error: "Webhook processing failed; Razorpay may retry this event." }, 500);
  }
}
