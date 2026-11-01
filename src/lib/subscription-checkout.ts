import type { KeeperBillingCycle, KeeperPlanId } from "@/lib/billing-plans";

type SubscriptionCheckoutResult = { success?: boolean; error?: string; subscription_id?: string; subscription_record_id?: string; key_id?: string; trial_ends_at?: string };
type CheckoutPayment = { razorpay_subscription_id: string; razorpay_payment_id: string; razorpay_signature: string };
type CheckoutOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (payment: CheckoutPayment) => void | Promise<void>;
  modal?: { confirm_close?: boolean; ondismiss?: () => void };
};
type CheckoutInstance = {
  open: () => void;
  on: (event: "payment.failed", callback: (response: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window { Razorpay?: new (options: CheckoutOptions) => CheckoutInstance }
}

let razorpayLoadPromise: Promise<void> | null = null;

export function prepareRazorpayCheckout(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.Razorpay) return Promise.resolve();
  if (razorpayLoadPromise) return razorpayLoadPromise;
  razorpayLoadPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    const script = existing || document.createElement("script");
    const onLoad = () => window.Razorpay ? resolve() : reject(new Error("Razorpay checkout did not initialize. Reload and try again."));
    const onError = () => reject(new Error("Razorpay checkout could not be loaded. Check your connection and try again."));
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) {
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.head.appendChild(script);
    } else if (script.dataset.loaded === "true") {
      onLoad();
    }
  }).catch((error: unknown) => {
    razorpayLoadPromise = null;
    throw error;
  });
  return razorpayLoadPromise;
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as T & { error?: string; referenceId?: string };
  if (!response.ok) {
    const supportReference = result.referenceId ? ` (Reference: ${result.referenceId})` : "";
    throw new Error(`${result.error || "The request could not be completed."}${supportReference}`);
  }
  return result;
}

export async function startKeeperSubscription(input: {
  plan: KeeperPlanId;
  billingCycle: KeeperBillingCycle;
  name?: string;
  email?: string;
}): Promise<"paid" | "cancelled"> {
  const [checkoutData] = await Promise.all([
    postJson<SubscriptionCheckoutResult>("/api/billing/checkout", input),
    prepareRazorpayCheckout(),
  ]);
  if (!checkoutData.subscription_id || !checkoutData.subscription_record_id || !checkoutData.key_id) throw new Error("Secure subscription checkout could not be prepared.");
  const subscriptionId = checkoutData.subscription_id;
  const keyId = checkoutData.key_id;
  const RazorpayCheckout = window.Razorpay;
  if (!RazorpayCheckout) throw new Error("Razorpay checkout is unavailable. Reload and try again.");

  return new Promise((resolve, reject) => {
    let finished = false;
    let handlerStarted = false;
    const finish = (result: "paid" | "cancelled") => { if (!finished) { finished = true; resolve(result); } };
    const cancelCheckout = async () => {
      if (finished || handlerStarted) return;
      finished = true;
      try {
        await postJson("/api/billing/cancel", { subscriptionId: checkoutData.subscription_record_id, checkoutDismissed: true });
        resolve("cancelled");
      } catch (error) {
        reject(error);
      }
    };
    const checkout = new RazorpayCheckout({
      key: keyId,
      subscription_id: subscriptionId,
      name: "Keeper",
      description: `${input.plan === "basic" ? "Basic" : "Pro"} · ${input.billingCycle} · 7-day free trial`,
      prefill: { name: input.name, email: input.email },
      theme: { color: "#d9ae32" },
      modal: { confirm_close: true, ondismiss: () => { void cancelCheckout(); } },
      handler: async (payment) => {
        handlerStarted = true;
        try {
          await postJson("/api/billing/verify", payment);
          finish("paid");
        } catch (error) {
          finished = true;
          reject(error);
        }
      },
    });
    checkout.on("payment.failed", () => {
      // Razorpay keeps the modal open for retries. Keep the checkout lock until it closes.
    });
    checkout.open();
  });
}
