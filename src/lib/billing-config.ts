const REQUIRED_BILLING_SERVER_VARIABLES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
] as const;

export function getMissingBillingServerVariables(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return REQUIRED_BILLING_SERVER_VARIABLES.filter((name) => !env[name]?.trim());
}
