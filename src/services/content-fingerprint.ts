import { createHash } from "node:crypto";

export const CONTENT_FINGERPRINT_VERSION = "v1" as const;
export const CONTENT_FINGERPRINT_MIN_SCALAR_VALUES = 80;
export const CONTENT_FINGERPRINT_FIELD_SEPARATOR = "\n";

export interface ContentFingerprintFields {
  title?: unknown;
  description?: unknown;
  caption?: unknown;
  bodyText?: unknown;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Reads only source-authoritative text fields; AI outputs and transcripts are excluded. */
export function getContentFingerprintFields(payload: unknown): ContentFingerprintFields {
  const record = asRecord(payload);
  const metadata = asRecord(record.metadata);
  return {
    title: record.title,
    description: record.description,
    caption: metadata.caption,
    bodyText: metadata.bodyText,
  };
}

export function normalizeFingerprintField(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.normalize("NFC").toLowerCase().replace(/\s+/gu, " ").trim();
  return normalized || null;
}

/** Stable v1 fingerprint. Short/empty evidence intentionally has no fingerprint. */
export function createContentFingerprint(fields: ContentFingerprintFields): string | null {
  const normalizedFields = [fields.title, fields.description, fields.caption, fields.bodyText]
    .map(normalizeFingerprintField)
    .filter((value): value is string => value !== null);
  if (normalizedFields.length === 0) return null;

  const normalizedText = normalizedFields.join(CONTENT_FINGERPRINT_FIELD_SEPARATOR);
  if (Array.from(normalizedText).length < CONTENT_FINGERPRINT_MIN_SCALAR_VALUES) return null;

  const digest = createHash("sha256").update(normalizedText, "utf8").digest("hex");
  return `${CONTENT_FINGERPRINT_VERSION}:${digest}`;
}

/**
 * Reproduces the historical standalone TypeScript/Mongo algorithm for dual-read:
 * string-only fields joined with spaces, trim + lowercase, JS UTF-16 length >= 80,
 * and an unversioned lowercase SHA-256 digest.
 */
export function createLegacyContentFingerprint(fields: ContentFingerprintFields): string | null {
  const legacyText = [fields.title, fields.description, fields.caption, fields.bodyText]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .trim()
    .toLowerCase();
  if (legacyText.length < CONTENT_FINGERPRINT_MIN_SCALAR_VALUES) return null;
  return createHash("sha256").update(legacyText, "utf8").digest("hex");
}

/** New v1 and legacy candidates coexist during the compatibility window. */
export function createContentFingerprintCandidates(
  fields: ContentFingerprintFields,
  additionalLegacyCandidates: readonly (string | null | undefined)[] = [],
): string[] {
  return [...new Set([
    createContentFingerprint(fields),
    createLegacyContentFingerprint(fields),
    ...additionalLegacyCandidates,
  ].filter((candidate): candidate is string => typeof candidate === "string" && candidate.length > 0))];
}
