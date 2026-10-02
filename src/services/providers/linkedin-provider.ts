import {
  AuthoritativeSourceData,
  ContentType,
  Creator,
  FieldProvenance,
  Platform,
} from "@/types";
import { ContentProvider, UrlValidationResult } from "./content-provider.interface";
import { MetadataNormalizer } from "../normalizer/metadata-normalizer";

export function extractLinkedInDetails(url: string): {
  id: string | null;
  slug: string | null;
  isPulse: boolean;
  canonicalUrl: string;
} {
  try {
    const trimmed = (url || "").trim();
    const pulseMatch = trimmed.match(/linkedin\.com\/pulse\/([a-zA-Z0-9_\-]+)/i);
    if (pulseMatch) {
      const slug = pulseMatch[1].split(/[?#&]/)[0];
      return {
        id: slug,
        slug,
        isPulse: true,
        canonicalUrl: `https://www.linkedin.com/pulse/${slug}`,
      };
    }
    const postMatch = trimmed.match(
      /linkedin\.com\/(?:posts|feed\/update\/urn:li:activity:)([a-zA-Z0-9_\-]+)/i
    );
    if (postMatch) {
      const id = postMatch[1].split(/[?#&]/)[0];
      return {
        id,
        slug: null,
        isPulse: false,
        canonicalUrl: `https://www.linkedin.com/posts/${id}`,
      };
    }
    return { id: null, slug: null, isPulse: false, canonicalUrl: trimmed };
  } catch {
    return { id: null, slug: null, isPulse: false, canonicalUrl: url };
  }
}

export class LinkedInProvider implements ContentProvider {
  readonly platform: Platform = "linkedin";

  canHandle(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    return /linkedin\.com/i.test(url);
  }

  validateAndCanonicalize(url: string): UrlValidationResult {
    const trimmed = (url || "").trim();
    const { id, slug, isPulse, canonicalUrl } = extractLinkedInDetails(trimmed);
    const contentType: ContentType = isPulse ? "article" : "post";

    if (!id && !slug && !trimmed.toLowerCase().includes("linkedin.com")) {
      return {
        isValid: false,
        normalizedUrl: trimmed,
        canonicalUrl: trimmed,
        contentId: null,
        platform: "linkedin",
        contentType,
        error: "Invalid LinkedIn URL: could not identify post or article ID.",
      };
    }

    const normalizedUrl = isPulse
      ? `linkedin.com/pulse/${slug || id || ""}`
      : `linkedin.com/posts/${id || ""}`;

    return {
      isValid: true,
      normalizedUrl,
      canonicalUrl,
      contentId: id || slug,
      platform: "linkedin",
      contentType,
    };
  }

  async fetchAuthoritativeData(
    url: string,
    _signal?: AbortSignal
  ): Promise<AuthoritativeSourceData> {
    const validation = this.validateAndCanonicalize(url);
    const { id, slug, isPulse } = extractLinkedInDetails(url);
    const now = new Date().toISOString();

    const formattedTitle = slug
      ? MetadataNormalizer.normalizeText(
          slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        )
      : id
      ? `LinkedIn Post • ${id}`
      : "LinkedIn Professional Update";

    const provenance: Record<string, FieldProvenance> = {
      title: { value: formattedTitle, source: "url_parse", retrievedAt: now },
      canonicalUrl: { value: validation.canonicalUrl, source: "url_canonicalizer", retrievedAt: now },
      extraction: { value: { status: "failed", reason: "LinkedIn requires authentication to access the post body." }, source: "restricted_platform", retrievedAt: now },
    };

    const creator: Creator = {
      name: "Creator unavailable",
      handle: undefined, // Never fabricate missing usernames
      verified: false,
    };

    return {
      platform: "linkedin",
      canonicalUrl: validation.canonicalUrl,
      contentId: validation.contentId || validation.normalizedUrl,
      creator,
      title: formattedTitle,
      caption: "",
      description: "",
      bodyText: "",
      thumbnailUrl: "",
      contentType: validation.contentType,
      retrievedAt: now,
      isRestricted: true,
      restrictionReason:
        "LinkedIn requires authentication to view full post body and author details",
      provenance,
    };
  }
}
