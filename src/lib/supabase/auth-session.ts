export const AUTH_SESSION_COOKIE = "keeper_session_expiry";
export const AUTH_SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;
const MIN_SESSION_SECRET_BYTES = 32;
const WEAK_SESSION_SECRETS = new Set([
  "change-me",
  "changeme",
  "secret",
  "development-secret",
  "your-secret-here",
  "replace-with-a-secure-random-value",
]);

function sessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET?.trim();
  if (!secret) throw new Error("AUTH_SESSION_SECRET is required to sign authentication sessions.");
  if (new TextEncoder().encode(secret).byteLength < MIN_SESSION_SECRET_BYTES) {
    throw new Error("AUTH_SESSION_SECRET must contain at least 32 bytes.");
  }
  const normalizedSecret = secret.toLowerCase();
  const isPlaceholder = [...WEAK_SESSION_SECRETS].some((weak) => normalizedSecret === weak || normalizedSecret.startsWith(`${weak}-`) || normalizedSecret.startsWith(`${weak}_`));
  const secretCharacters = [...secret];
  const frequencies = new Map<string, number>();
  for (const character of secretCharacters) frequencies.set(character, (frequencies.get(character) || 0) + 1);
  const entropyPerCharacter = [...frequencies.values()].reduce((entropy, count) => {
    const probability = count / secretCharacters.length;
    return entropy - probability * Math.log2(probability);
  }, 0);
  if (isPlaceholder || /^(.)\1+$/.test(secret) || entropyPerCharacter < 3.5) {
    throw new Error("AUTH_SESSION_SECRET must be a strong, independently generated value.");
  }
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
  } catch {
    // Missing or invalid configuration must invalidate the marker without
    // exposing configuration details in logs or responses.
    return false;
  }
}

export const authSessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};
