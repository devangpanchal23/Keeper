export type CheckoutSubscription = {
  id: string;
  razorpay_subscription_id?: string;
  status: string;
  current_period_end: string | null;
  trial_ends_at: string | null;
  cancel_at_cycle_end: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type CheckoutBlockReason = "active_or_trial" | "pending" | "cancelled_with_access" | "created_checkout" | "recent_authenticated";

export function getCheckoutBlockDecision(
  subscriptions: CheckoutSubscription[],
  now = Date.now(),
): { reason: CheckoutBlockReason | null; unknownExpiryRows: Array<Pick<CheckoutSubscription, "id" | "status">> } {
  const expiryTime = (subscription: CheckoutSubscription): number | null => {
    const value = subscription.current_period_end || subscription.trial_ends_at;
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  };
  const withinWindow = (values: Array<string | null>): boolean =>
    values.some((value) => {
      if (value === null) return false;
      const timestamp = Date.parse(value);
      return Number.isFinite(timestamp) && timestamp >= now - 30 * 60 * 1000 && timestamp <= now;
    });

  const unknownExpiryRows = subscriptions
    .filter((subscription) => ["active", "trialing"].includes(subscription.status) && expiryTime(subscription) === null)
    .map(({ id, status }) => ({ id, status }));

  const activeOrTrial = subscriptions.some((subscription) => {
    const expiry = expiryTime(subscription);
    if (["active", "trialing"].includes(subscription.status)) return expiry === null || expiry > now;
    if (["cancelled", "canceled"].includes(subscription.status) && subscription.trial_ends_at) {
      const trialExpiry = Date.parse(subscription.trial_ends_at);
      return Number.isFinite(trialExpiry) && trialExpiry > now;
    }
    return subscription.status === "authenticated" && expiry !== null && expiry > now;
  });
  if (activeOrTrial) return { reason: "active_or_trial", unknownExpiryRows };
  if (subscriptions.some((subscription) => ["pending", "halted"].includes(subscription.status))) {
    return { reason: "pending", unknownExpiryRows };
  }
  if (subscriptions.some((subscription) => {
    const expiry = expiryTime(subscription);
    return ["cancelled", "canceled"].includes(subscription.status)
      && subscription.cancel_at_cycle_end
      && expiry !== null
      && expiry > now;
  })) {
    return { reason: "cancelled_with_access", unknownExpiryRows };
  }
  if (subscriptions.some((subscription) => subscription.status === "created")) {
    return { reason: "created_checkout", unknownExpiryRows };
  }
  if (subscriptions.some((subscription) =>
    subscription.status === "authenticated" && expiryTime(subscription) === null
      && withinWindow([subscription.updated_at, subscription.created_at]))) {
    return { reason: "recent_authenticated", unknownExpiryRows };
  }
  return { reason: null, unknownExpiryRows };
}

export const checkoutBlockMessages: Record<CheckoutBlockReason, string> = {
  active_or_trial: "You already have an active plan or trial. Cancel its renewal before starting another.",
  pending: "A subscription is pending. Complete or resolve it before starting another checkout.",
  cancelled_with_access: "Your cancelled plan still has paid access. Wait until that period ends before starting another plan.",
  created_checkout: "A plan checkout is already in progress. Complete it or try again later.",
  recent_authenticated: "Your subscription authorization is still being processed. Please wait before starting another checkout.",
};
