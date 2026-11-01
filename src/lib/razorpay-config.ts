export function getRazorpayConfigurationError(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const keyId = env.RAZORPAY_KEY_ID;
  const keySecret = env.RAZORPAY_KEY_SECRET;
  const mode = env.RAZORPAY_MODE || "test";

  if (!keyId || !keySecret) return "Razorpay API keys are not configured.";
  if (mode === "test" && !keyId.startsWith("rzp_test_")) {
    return "Test mode requires a Razorpay test key ID.";
  }
  if (mode === "live" && (env.ALLOW_REAL_RAZORPAY_PAYMENTS !== "true" || !keyId.startsWith("rzp_live_"))) {
    return "Live Razorpay payments are disabled or the live key ID is invalid.";
  }
  if (mode !== "test" && mode !== "live") return "RAZORPAY_MODE must be test or live.";
  return null;
}

export function getSafeRazorpayErrorCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const candidate = error as { code?: unknown; error?: { code?: unknown } };
  const code = candidate.code ?? candidate.error?.code;
  return typeof code === "string" && /^[A-Z0-9_]{1,64}$/i.test(code) ? code : undefined;
}
