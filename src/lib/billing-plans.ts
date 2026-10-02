export type KeeperPlanId = "basic" | "pro";
export type KeeperBillingCycle = "monthly" | "yearly";

export const FREE_PLAN = { amount: 0, credits: 30, cycleDays: 7 } as const;

export const KEEPER_BILLING_PLANS = {
  basic: {
    monthly: { amount: 30_000, credits: 220 },
    yearly: { amount: 350_000, credits: 2_640 },
  },
  pro: {
    monthly: { amount: 50_000, credits: -1 },
    yearly: { amount: 550_000, credits: -1 },
  },
} as const satisfies Record<KeeperPlanId, Record<KeeperBillingCycle, { amount: number; credits: number }>>;

export function isKeeperPlanId(value: unknown): value is KeeperPlanId {
  return value === "basic" || value === "pro";
}

export function isKeeperBillingCycle(value: unknown): value is KeeperBillingCycle {
  return value === "monthly" || value === "yearly";
}
