import "server-only";
import Razorpay from "razorpay";
import { getRazorpayConfigurationError } from "@/lib/razorpay-config";

let razorpayClient: Razorpay | null = null;

export function getRazorpayClient(): Razorpay {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  const configurationError = getRazorpayConfigurationError();
  if (configurationError) throw new Error(configurationError);

  if (!razorpayClient) {
    razorpayClient = new Razorpay({ key_id: keyId, key_secret: keySecret });
  }

  return razorpayClient;
}

export function getRazorpayKeyId(): string {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const configurationError = getRazorpayConfigurationError();
  if (!keyId || configurationError) throw new Error(configurationError || "Razorpay key ID is not configured.");
  return keyId;
}
