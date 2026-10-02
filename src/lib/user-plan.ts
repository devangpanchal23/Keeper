import type { User } from "@/types";

export function getPlanLabel(tier: User["tier"] | null | undefined): string {
  if (!tier) return "Free";
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
