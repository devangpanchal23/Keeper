import type { KeeperBillingCycle, KeeperPlanId } from "@/lib/billing-plans";

type SubscriptionCheckoutResult = { success?: boolean; error?: string; subscription_id?: string; key_id?: string; trial_ends_at?: string };
type CheckoutPayment = { razorpay_subscription_id: string; razorpay_payment_id: string; razorpay_signature: string };
type CheckoutOptions = {
  key: string;
  subscription_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string };
  theme?: { color?: string };
  handler: (payment: CheckoutPayment) => void | Promise<void>;
  modal?: { ondismiss?: () => void };
};
type CheckoutInstance = {
  open: () => void;
  on: (event: "payment.failed", callback: (response: { error?: { description?: string } }) => void) => void;
};

declare global {
  interface Window { Razorpay?: new (options: CheckoutOptions) => CheckoutInstance }
}

async function loadRazorpay() {
  if (window.Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    const script = existing || document.createElement("script");
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not be loaded. Check your connection and try again."));
    if (!existing) {
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      document.body.appendChild(script);
    }
  });
}

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const result = await response.json() as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

export async function startKeeperSubscription(input: {
  plan: KeeperPlanId;
  billingCycle: KeeperBillingCycle;
  name?: string;
  email?: string;
}): Promise<"paid" | "cancelled"> {
  await loadRazorpay();
  const checkoutData = await postJson<SubscriptionCheckoutResult>("/api/billing/checkout", input);
  if (!checkoutData.subscription_id || !checkoutData.key_id) throw new Error("Secure subscription checkout could not be prepared.");
  const subscriptionId = checkoutData.subscription_id;
  const keyId = checkoutData.key_id;
  const RazorpayCheckout = window.Razorpay;
  if (!RazorpayCheckout) throw new Error("Razorpay checkout is unavailable. Reload and try again.");

  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (result: "paid" | "cancelled") => { if (!finished) { finished = true; resolve(result); } };
    const checkout = new RazorpayCheckout({
      key: keyId,
      subscription_id: subscriptionId,
      name: "Keeper",
      description: `${input.plan === "basic" ? "Basic" : "Pro"} · ${input.billingCycle} · 7-day free trial`,
      prefill: { name: input.name, email: input.email },
      theme: { color: "#d9ae32" },
      modal: { ondismiss: () => finish("cancelled") },
      handler: async (payment) => {
        try {
          await postJson("/api/billing/verify", payment);
          finish("paid");
        } catch (error) {
          finished = true;
          reject(error);
        }
      },
    });
    checkout.on("payment.failed", (event) => {
      finished = true;
      reject(new Error(event.error?.description || "Subscription authorization failed. Please try again."));
    });
    checkout.open();
  });
}
