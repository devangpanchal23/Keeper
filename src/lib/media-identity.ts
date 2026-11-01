import { ProviderService } from "@/services/provider-service";
import { SavedItem } from "@/types";

/**
 * Returns a deterministic, cross-device canonical identity key for any media URL.
 * e.g. "instagram:de0b_t2v1g6", "youtube:dqw4w9wgxcq", "website:example.com/article"
 */
export function getCanonicalIdentityKey(url: string): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  try {
    const identity = ProviderService.getCanonicalIdentity(trimmed);
    if (identity.canonicalId) return `${identity.platform}:${identity.canonicalId}`.toLowerCase();
    if (identity.normalizedUrl) return `${identity.platform}:${identity.normalizedUrl}`.toLowerCase();
  } catch {}
  return trimmed.toLowerCase();
}

/**
 * Returns the cleanest canonical URL for storage in keeper_media.canonical_url.
 * Strips tracking parameters, shortener domains, and mobile query residues.
 */
export function getAuthoritativeCanonicalUrl(url: string): string {
  if (!url || typeof url !== "string") return "";
  const trimmed = url.trim();
  try {
    const identity = ProviderService.getCanonicalIdentity(trimmed);
    if (
      identity.canonicalUrl &&
      (identity.platform === "instagram" ||
        identity.platform === "youtube" ||
        identity.platform === "youtube-shorts" ||
        identity.platform === "twitter" ||
        identity.platform === "x" ||
        identity.platform === "reddit")
    ) {
      return identity.canonicalUrl.trim();
    }
    if (identity.normalizedUrl) {
      return `https://${identity.normalizedUrl}`;
    }
  } catch {}
  return trimmed;
}

/**
 * Determines whether two items represent the same media piece across devices.
 */
export function isSameContentItem(
  itemA: Partial<SavedItem> | null | undefined,
  itemB: Partial<SavedItem> | null | undefined
): boolean {
  if (!itemA || !itemB) return false;
  if (itemA.id && itemB.id && itemA.id === itemB.id) return true;
  if (
    itemA.metadata?.serverMediaId &&
    itemB.metadata?.serverMediaId &&
    itemA.metadata.serverMediaId === itemB.metadata.serverMediaId
  ) {
    return true;
  }
  if (!itemA.url || !itemB.url) return false;
  const keyA = getCanonicalIdentityKey(itemA.url);
  const keyB = getCanonicalIdentityKey(itemB.url);
  return Boolean(keyA && keyB && keyA === keyB);
}

