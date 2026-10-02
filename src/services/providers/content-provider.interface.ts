import { AuthoritativeSourceData, ContentType, Platform } from "@/types";

export interface UrlValidationResult {
  isValid: boolean;
  normalizedUrl: string;
  canonicalUrl: string;
  contentId: string | null;
  platform: Platform;
  contentType: ContentType;
  error?: string;
}

export interface ContentProvider {
  readonly platform: Platform;

  /**
   * Returns true if this provider is responsible for handling the given URL.
   */
  canHandle(url: string): boolean;

  /**
   * Validates and parses the URL into canonical form and extracts the content ID.
   */
  validateAndCanonicalize(url: string): UrlValidationResult;

  /**
   * Fetches authoritative, groundable platform metadata without hallucination.
   */
  fetchAuthoritativeData(url: string, signal?: AbortSignal): Promise<AuthoritativeSourceData>;
}
