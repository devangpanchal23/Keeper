import {
  AuthoritativeSourceData,
  ContentType,
  Creator,
  FieldProvenance,
  Platform,
} from "@/types";
import { ContentProvider, UrlValidationResult } from "./content-provider.interface";
import { MetadataNormalizer } from "../normalizer/metadata-normalizer";

export class YouTubeProvider implements ContentProvider {
  readonly platform: Platform = "youtube";

  canHandle(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    const lower = url.toLowerCase().trim();
    return (
      lower.includes("youtube.com") ||
      lower.includes("youtu.be") ||
      lower.includes("youtube-nocookie.com")
    );
  }

  /**
   * Extracts clean 11-character YouTube video ID.
   */
  extractVideoId(url: string): string | null {
    if (!url) return null;
    const trimmed = url.trim();

    // Standard watch URL: youtube.com/watch?v=ID
    const vParamMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/i);
    if (vParamMatch && vParamMatch[1]) return vParamMatch[1];

    // Shortened URL: youtu.be/ID
    const youtuBeMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/i);
    if (youtuBeMatch && youtuBeMatch[1]) return youtuBeMatch[1];

    // YouTube Shorts: youtube.com/shorts/ID
    const shortsMatch = trimmed.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);
    if (shortsMatch && shortsMatch[1]) return shortsMatch[1];

    // Embed URL: youtube.com/embed/ID
    const embedMatch = trimmed.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]{11})/i);
    if (embedMatch && embedMatch[1]) return embedMatch[1];

    // Live URL: youtube.com/live/ID
    const liveMatch = trimmed.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i);
    if (liveMatch && liveMatch[1]) return liveMatch[1];

    return null;
  }

  isShort(url: string): boolean {
    return /youtube\.com\/shorts\//i.test(url);
  }

  validateAndCanonicalize(url: string): UrlValidationResult {
    const trimmed = url.trim();
    const videoId = this.extractVideoId(trimmed);
    const isShorts = this.isShort(trimmed);
    const platform: Platform = isShorts ? "youtube-shorts" : "youtube";
    const contentType: ContentType = isShorts ? "short" : "video";

    if (!videoId) {
      return {
        isValid: false,
        normalizedUrl: trimmed,
        canonicalUrl: trimmed,
        contentId: null,
        platform,
        contentType,
        error: "Invalid YouTube URL: Could not extract a valid 11-character video ID.",
      };
    }

    const canonicalUrl = isShorts
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`;
    const normalizedUrl = isShorts
      ? `youtube.com/shorts/${videoId}`
      : `youtube.com/watch?v=${videoId}`;

    return {
      isValid: true,
      normalizedUrl,
      canonicalUrl,
      contentId: videoId,
      platform,
      contentType,
    };
  }

  getThumbnail(videoId: string): string {
    return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  }

  /**
   * Parses ISO 8601 duration string like "PT15M33S" or "PT1H2M10S" into "15:33" or "1:02:10"
   */
  private formatIsoDuration(durationStr?: string): string | undefined {
    if (!durationStr) return undefined;
    const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return undefined;
    const hours = parseInt(match[1] || "0", 10);
    const minutes = parseInt(match[2] || "0", 10);
    const seconds = parseInt(match[3] || "0", 10);

    const pad = (n: number) => n.toString().padStart(2, "0");
    if (hours > 0) {
      return `${hours}:${pad(minutes)}:${pad(seconds)}`;
    }
    return `${minutes}:${pad(seconds)}`;
  }

  async fetchAuthoritativeData(
    url: string,
    signal?: AbortSignal
  ): Promise<AuthoritativeSourceData> {
    const validation = this.validateAndCanonicalize(url);
    if (!validation.isValid || !validation.contentId) {
      throw new Error(validation.error || "Invalid YouTube URL");
    }

    const videoId = validation.contentId;
    const isShorts = validation.contentType === "short";
    const canonicalUrl = validation.canonicalUrl;
    const now = new Date().toISOString();
    const thumbnail = this.getThumbnail(videoId);

    const provenance: Record<string, FieldProvenance> = {
      thumbnail: { value: thumbnail, source: "youtube_cdn", retrievedAt: now },
      canonicalUrl: { value: canonicalUrl, source: "youtube_canonicalizer", retrievedAt: now },
      contentId: { value: videoId, source: "youtube_canonicalizer", retrievedAt: now },
    };

    // Strategy 1: YouTube Data API v3 (if server key configured)
    const apiKey = typeof process !== "undefined" ? process.env?.YOUTUBE_API_KEY : undefined;
    if (apiKey) {
      try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${apiKey}`;
        const res = await fetch(apiUrl, { signal });
        if (res.ok) {
          const data = await res.json();
          const item = data.items?.[0];
          if (item) {
            const snippet = item.snippet;
            const contentDetails = item.contentDetails;
            const stats = item.statistics;

            provenance.title = { value: snippet.title, source: "youtube_data_api_v3", retrievedAt: now };
            if (snippet.channelTitle) provenance.creator = { value: snippet.channelTitle, source: "youtube_data_api_v3", retrievedAt: now };
            provenance.description = { value: snippet.description, source: "youtube_data_api_v3", retrievedAt: now };

            const creator: Creator = {
              name: snippet.channelTitle || "Creator unavailable",
              ...(snippet.channelTitle ? { handle: `@${snippet.channelTitle.toLowerCase().replace(/[^a-z0-9_]/g, "")}` } : {}),
              verified: true,
            };

            const durationFormatted = this.formatIsoDuration(contentDetails?.duration);

            return {
              platform: validation.platform,
              canonicalUrl,
              contentId: videoId,
              creator,
              title: snippet.title,
              caption: "",
              description: snippet.description || "",
              bodyText: snippet.description || "",
              thumbnailUrl: thumbnail,
              publishedAt: snippet.publishedAt,
              contentType: validation.contentType,
              duration: durationFormatted,
              viewCount: stats?.viewCount,
              likeCount: stats?.likeCount,
              commentCount: stats?.commentCount,
              rawPlatformMetadata: item,
              retrievedAt: now,
              isRestricted: false,
              provenance,
            };
          }
        }
      } catch (err) {
        // Fall back to oEmbed
      }
    }

    // Strategy 2: YouTube oEmbed endpoint (public, reliable, lightweight)
    try {
      const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
      const res = await fetch(oembedUrl, { signal });
      if (res.ok) {
        const oembed = await res.json();
        const rawAuthor = typeof oembed.author_name === "string" ? oembed.author_name : "";
        const authorName = MetadataNormalizer.normalizeText(rawAuthor);
        const cleanHandle = `@${authorName.toLowerCase().replace(/[^a-z0-9_]/g, "")}`;

        const rawTitle = oembed.title || (isShorts ? `YouTube Short • ${videoId}` : `YouTube Video • ${videoId}`);
        const title = MetadataNormalizer.normalizeText(rawTitle);
        const description = "";

        provenance.title = { value: title, source: oembed.title ? "youtube_oembed" : "url_parse", retrievedAt: now };
        if (authorName) provenance.creator = { value: authorName, source: "youtube_oembed", retrievedAt: now };

        const creator: Creator = {
          name: authorName || "Creator unavailable",
          ...(authorName ? { handle: cleanHandle } : {}),
          verified: true,
        };

        return {
          platform: validation.platform,
          canonicalUrl,
          contentId: videoId,
          creator,
          title,
          caption: "",
          description,
          bodyText: description,
          thumbnailUrl: oembed.thumbnail_url || thumbnail,
          contentType: validation.contentType,
          rawPlatformMetadata: oembed,
          retrievedAt: now,
          isRestricted: false,
          provenance,
        };
      }
    } catch {
      // Network failed or offline fallback
    }

    // Strategy 3: Grounded fallback based strictly on validated Video ID
    const title = isShorts ? `YouTube Short • ${videoId}` : `YouTube Video • ${videoId}`;
    provenance.title = { value: title, source: "url_parse", retrievedAt: now };
    provenance.creator = { source: "unavailable", retrievedAt: now };
    provenance.extraction = { value: { status: "partial", reason: "The YouTube API and oEmbed endpoints did not return video metadata." }, source: "youtube_provider", retrievedAt: now };

    return {
      platform: validation.platform,
      canonicalUrl,
      contentId: videoId,
      creator: {
        name: "Creator unavailable",
        verified: false,
      },
      title,
      caption: "",
      description: "",
      bodyText: "",
      thumbnailUrl: thumbnail,
      contentType: validation.contentType,
      retrievedAt: now,
      isRestricted: true,
      restrictionReason: "Channel and full description could not be retrieved from oEmbed; video ID verified directly.",
      provenance,
    };
  }
}
