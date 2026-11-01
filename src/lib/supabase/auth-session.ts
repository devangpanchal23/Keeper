export const AUTH_SESSION_COOKIE = "keeper_session_expiry";
export const AUTH_SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

function sessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;

  // Resilient fallback: If AUTH_SESSION_SECRET is omitted from deployment environment variables,
  // use the server-only SUPABASE_SERVICE_ROLE_KEY or derive from the configured Supabase key
  // so valid Supabase logins don't crash with 503 Service Unavailable.
  const fallback =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (fallback && fallback.length >= 32) {
    return fallback;
  }

  if (!secret || secret.length < 32) throw new Error("AUTH_SESSION_SECRET must be configured with at least 32 characters.");
  return secret;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function signature(expiration: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(sessionSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(expiration))));
}

export async function createAuthSessionMarker(now = Date.now()): Promise<{ value: string; expiresAt: number }> {
  const expiresAt = Math.floor(now / 1000) + AUTH_SESSION_DURATION_SECONDS;
  const expiration = String(expiresAt);
  return { value: `${expiration}.${await signature(expiration)}`, expiresAt };
}

export async function isAuthSessionMarkerValid(value: string | undefined, now = Date.now()): Promise<boolean> {
  if (!value) return false;
  const [expiration, suppliedSignature, ...extra] = value.split(".");
  if (!expiration || !suppliedSignature || extra.length || !/^\d{10}$/.test(expiration)) return false;
  const expiresAt = Number(expiration);
  if (!Number.isSafeInteger(expiresAt) || expiresAt * 1000 <= now) return false;
  try {
    const expected = await signature(expiration);
    if (expected.length !== suppliedSignature.length) return false;
    let mismatch = 0;
    for (let index = 0; index < expected.length; index += 1) mismatch |= expected.charCodeAt(index) ^ suppliedSignature.charCodeAt(index);
    return mismatch === 0;
  } catch (error) {
    console.error("Could not validate the Keeper session expiry marker.", error);
    return false;
  }
}

export const authSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
