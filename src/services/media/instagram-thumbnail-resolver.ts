/**
 * Unified Authentic Instagram Thumbnail Resolver
 *
 * Implements the single, canonical thumbnail acquisition and validation architecture
 * shared by both Single URL Import ("Add Content") and Bulk Import.
 *
 * SOURCE PRIORITY:
 * 1. Actual image/media included in Instagram export archive (ZIP entry)
 * 2. Actual thumbnail URL explicitly supplied by export metadata
 * 3. Existing authorized Instagram / Meta provider response (oEmbed API)
 * 4. Legitimately accessible Instagram captioned embed metadata (verified media)
 * 5. Legitimately accessible OpenGraph image (verified media, not login/logo)
 * 6. Existing valid cached authentic thumbnail
 * 7. Clearly recognizable generic Instagram placeholder (NEVER misleading stock photos!)
 *
 * NON-NEGOTIABLE RULE:
 * The resolver must NEVER return a generic fallback as status = "authentic".
 */

export type InstagramThumbnailStatus = "authentic" | "unavailable" | "failed";

export type InstagramThumbnailSource =
  | "export_archive"
  | "export"
  | "provider"
  | "instagram_embed"
  | "instagram_opengraph"
  | "media_frame"
  | "cache"
  | "fallback";

export interface InstagramThumbnailResult {
  status: InstagramThumbnailStatus;
  url: string;
  source: InstagramThumbnailSource;
  reason?: string;
}

export interface ResolveInstagramThumbnailOptions {
  canonicalUrl: string;
  shortcode?: string;
  isReel?: boolean;
  exportMetadata?: {
    thumbnailUrl?: string;
    media?: any[];
    archivePath?: string;
    fbid?: string;
    caption?: string;
    [key: string]: any;
  };
  archiveFileResolver?: (pathOrPattern: string) => string | null;
  providerMetadata?: {
    thumbnailUrl?: string;
    hasAuthenticThumb?: boolean;
    rawPlatformMetadata?: any;
    [key: string]: any;
  };
  signal?: AbortSignal;
}

import {
  MediaPreviewResolver,
  BANNED_STOCK_THUMBNAILS,
} from "./media-preview-resolver";
import {
  INSTAGRAM_REEL_PLACEHOLDER as REEL_PLACEHOLDER,
  INSTAGRAM_POST_PLACEHOLDER as POST_PLACEHOLDER,
} from "./instagram-placeholders";

export { BANNED_STOCK_THUMBNAILS };
export {
  INSTAGRAM_REEL_PLACEHOLDER,
  INSTAGRAM_POST_PLACEHOLDER,
} from "./instagram-placeholders";

export const INSTAGRAM_GENERIC_PLACEHOLDER = REEL_PLACEHOLDER;

export class InstagramThumbnailResolver {
  public static isAuthenticMediaUrl(url: string | undefined | null): boolean {
    return MediaPreviewResolver.isAuthenticMediaUrl(url);
  }

  public static extractShortcode(url: string): string | null {
    const identity = MediaPreviewResolver.getCanonicalIdentity(url);
    return identity.shortcode || null;
  }

  /**
   * Resolves an authentic Instagram thumbnail according to strict source priority
   * by delegating to canonical MediaPreviewResolver.
   */
  public static async resolveInstagramThumbnail(
    options: ResolveInstagramThumbnailOptions
  ): Promise<InstagramThumbnailResult> {
    try {
      const res = await MediaPreviewResolver.resolvePreview(options.canonicalUrl, {
        archiveFileResolver: options.archiveFileResolver,
        exportMetadata: options.exportMetadata,
        providerMetadata: options.providerMetadata,
        signal: options.signal,
      });

      let mappedStatus: InstagramThumbnailStatus = "unavailable";
      if (res.status === "resolved") mappedStatus = "authentic";
      else if (res.status === "failed") mappedStatus = "failed";

      let mappedSource: InstagramThumbnailSource = "fallback";
      if (res.source === "export_metadata") mappedSource = "export";
      else if (res.source === "export_archive_image") mappedSource = "export_archive";
      else if (res.source === "export_archive_video_frame") mappedSource = "media_frame";
      else if (res.source === "durable_cache") mappedSource = "cache";
      else if (res.source === "authorized_api") mappedSource = "provider";
      else if (res.source === "verified_embed") mappedSource = "instagram_embed";
      else if (res.source === "provider_media") mappedSource = "provider";

      return {
        status: mappedStatus,
        url: res.previewUrl,
        source: mappedSource,
        reason: res.failureReason,
      };
    } catch (err: any) {
      const isReel = options.canonicalUrl.includes("/reel/") || options.canonicalUrl.includes("/reels/");
      return {
        status: "failed",
        url: isReel ? REEL_PLACEHOLDER : POST_PLACEHOLDER,
        source: "fallback",
        reason: `Enrichment error: ${err?.message || "provider_timeout"}`,
      };
    }
  }

  public static setCached(key: string, url: string): void {
    const identity = MediaPreviewResolver.getCanonicalIdentity(key);
    MediaPreviewResolver.setDurableCache(identity.cacheKey, url);
  }

  public static clearCache(): void {
    MediaPreviewResolver.clearCache();
  }
}

