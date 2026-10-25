export type PendingRazorpayReceipt = {
  razorpay_payment_id: string;
  razorpay_invoice_id: string | null;
  receipt_url?: string | null;
};

export async function withRazorpayTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
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

export function createReceiptRetryTask(
  payments: PendingRazorpayReceipt[],
  dependencies: {
    fetchInvoice: (invoiceId: string) => Promise<{ short_url?: string | null }>;
    saveReceiptUrl: (paymentId: string, receiptUrl: string) => Promise<void>;
    timeoutMs?: number;
  },
): () => Promise<void> {
  const retryPayments = payments
    .filter((payment) => !payment.receipt_url && payment.razorpay_invoice_id)
    .slice(0, 3);

  return async () => {
    for (const payment of retryPayments) {
      try {
        const invoice = await withRazorpayTimeout(
          dependencies.fetchInvoice(payment.razorpay_invoice_id!),
          dependencies.timeoutMs ?? 2_000,
        );
        if (invoice.short_url) {
          await dependencies.saveReceiptUrl(payment.razorpay_payment_id, invoice.short_url);
        }
      } catch {
        // Keep receipt_url empty so a later billing refresh can retry.
      }
    }
  };
}
