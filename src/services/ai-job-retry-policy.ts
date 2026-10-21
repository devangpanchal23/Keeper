export const MAX_AI_JOB_ATTEMPTS = 5;

export function processingFailureCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/timeout|timed out|abort/i.test(message)) return "TIMEOUT";
  if (/429|rate.?limit|quota/i.test(message)) return "RATE_LIMITED";
  if (/not configured/i.test(message)) return "PROVIDER_NOT_CONFIGURED";
  if (/unsupported/i.test(message)) return "UNSUPPORTED_MEDIA";
  if (/unauthorized|forbidden|expired source access/i.test(message)) return "SOURCE_ACCESS_DENIED";
  if (/corrupt|invalid media/i.test(message)) return "INVALID_MEDIA";
  if (/HTTP\s+5\d\d/i.test(message)) return "PROVIDER_UNAVAILABLE";
  return "PROCESSING_ERROR";
}

export function isPermanentProcessingFailure(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error || "");
  if (/not configured|unsupported|corrupt|invalid media|unauthorized|forbidden|expired source access|no accessible audio|too short for grounded AI/i.test(message)) return true;
  const status = message.match(/HTTP\s+(\d{3})/i)?.[1];
  if (!status) return false;
  const code = Number(status);
  return code >= 400 && code < 500 && code !== 408 && code !== 409 && code !== 429;
}

export function shouldRetryAiJob(attempts: number, error: unknown): boolean {
  return attempts < MAX_AI_JOB_ATTEMPTS && !isPermanentProcessingFailure(error);
}

export function aiJobRetryDelaySeconds(attempts: number): number {
  return Math.min(3600, 15 * 2 ** Math.max(0, attempts - 1));
}
