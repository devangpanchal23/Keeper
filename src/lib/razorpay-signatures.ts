import { createHmac, timingSafeEqual } from "node:crypto";

function matchesHexHmac(message: string, signature: string, secret: string): boolean {
  if (!/^[a-f\d]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(message).digest();
  const provided = Buffer.from(signature, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export function verifyRazorpayWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string | undefined,
): boolean {
  return Boolean(secret && matchesHexHmac(rawBody, signature, secret));
}

export function verifyRazorpaySubscriptionSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string,
  secret: string | undefined,
): boolean {
  return Boolean(secret && matchesHexHmac(`${paymentId}|${subscriptionId}`, signature, secret));
}
