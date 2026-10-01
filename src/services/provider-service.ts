import {
  ContentType,
  Creator,
  ItemMetadata,
  Platform,
  ContentProcessingStatus,
  FieldProvenance,
  VerifiedSourceMetadata,
  ExtractedContent,
  ContentValidationResult,
} from "@/types";

export interface CanonicalIdentity {
  platform: Platform;
  canonicalId: string;
  canonicalUrl: string;
  normalizedUrl: string;
}

export interface PlatformProvider {
  platform: Platform;
  canHandle(url: string): boolean;
  detect(url: string): boolean;
  normalizeUrl(url: string): string;
  extractContentId(url: string): string | null;
  getThumbnail(url: string, contentId?: string | null): string;
  fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata>;
  extractContent(url: string, contentId?: string | null): Promise<ExtractedContent>;
  validateContent(data: ExtractedContent): ContentValidationResult;
  getMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata>;
  extractMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata>;
}

/**
 * Base platform provider with common validation and backward-compatibility methods.
 */
export abstract class BasePlatformProvider implements PlatformProvider {
  abstract platform: Platform;

  canHandle(url: string): boolean {
    return this.detect(url);
  }

  abstract detect(url: string): boolean;
  abstract normalizeUrl(url: string): string;
  abstract extractContentId(url: string): string | null;
  abstract getThumbnail(url: string, contentId?: string | null): string;
  abstract fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata>;

  async extractContent(url: string, contentId?: string | null): Promise<ExtractedContent> {
    const meta = await this.fetchMetadata(url, contentId);
    return {
      ...meta,
      bodyText: meta.description || null,
      caption: null,
      transcript: null,
      hashtags: [],
    };
  }

  validateContent(data: ExtractedContent): ContentValidationResult {
    const missing: string[] = [];
    if (!data.title || data.title.trim().length === 0) missing.push("title");
    if (!data.creator?.name || data.creator.name.includes("Unknown")) missing.push("creator");
    if (!data.description || data.description.trim().length === 0) missing.push("description");

    const isLimited = data.isLimited || missing.length > 0;
    let status: ContentProcessingStatus = data.status;
    if (missing.length >= 2 && !data.bodyText && !data.transcript) {
      status = "INSUFFICIENT_CONTENT";
    }

    return {
      isValid: true,
      status,
      missingFields: missing,
      isLimited,
      limitedReason: data.limitedReason,
    };
  }

  async getMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    return this.fetchMetadata(url, contentId);
  }

  async extractMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    return this.fetchMetadata(url, contentId);
  }
}

// ---------------------------------------------------------------------------
// Deterministic Hash & URL Utilities
// ---------------------------------------------------------------------------

export function deterministicHash(str: string): number {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return Math.abs(hash);
}

export function normalizeUrl(rawUrl: string): string {
  try {
    const trimmed = rawUrl.trim();
    const urlObj = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    const host = urlObj.hostname.toLowerCase().replace(/^(?:www\.|m\.)/, "");
    const path = urlObj.pathname.replace(/\/+$/, "");

    // Strip tracking parameters
    const searchParams = new URLSearchParams(urlObj.search);
    const trackingParams = [
      "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
      "ref", "fbclid", "gclid", "si", "feature", "igsh", "_r", "is_from_webapp",
    ];
    trackingParams.forEach((param) => searchParams.delete(param));
    const cleanSearch = searchParams.toString();

    return `${host}${path}${cleanSearch ? `?${cleanSearch}` : ""}`;
  } catch {
    return rawUrl.trim().toLowerCase().replace(/\/+$/, "");
  }
}

export function formatSlugToTitle(slug: string): string {
  if (!slug) return "";
  return slug
    .replace(/[-_]+/g, " ")
    .replace(/\.[a-z0-9]+$/i, "")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export const FALLBACK_THUMBNAILS: Record<Platform, string[]> = {
  youtube: [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
  ],
  "youtube-shorts": [
    "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80",
  ],
  instagram: [
    "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&auto=format&fit=crop&q=80",
  ],
  tiktok: [
    "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1511497584788-87676104235f?w=800&auto=format&fit=crop&q=80",
  ],
  reddit: [
    "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1579621970563-ebec7560ff3e?w=800&auto=format&fit=crop&q=80",
  ],
  linkedin: [
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1557804506-669a67965ba0?w=800&auto=format&fit=crop&q=80",
  ],
  twitter: [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    "https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&auto=format&fit=crop&q=80",
  ],
  pinterest: [
    "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&auto=format&fit=crop&q=80",
  ],
  facebook: [
    "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=800&auto=format&fit=crop&q=80",
  ],
  threads: [
    "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
  ],
  github: [
    "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=800&auto=format&fit=crop&q=80",
  ],
  blog: [
    "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80",
  ],
  website: [
    "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80",
  ],
};

export function getDeterministicFallbackImage(platform: Platform, key: string): string {
  const list = FALLBACK_THUMBNAILS[platform] || FALLBACK_THUMBNAILS.website;
  const hash = deterministicHash(key);
  return list[hash % list.length];
}

// ---------------------------------------------------------------------------
// 1. YouTube Provider
// ---------------------------------------------------------------------------

export function extractYouTubeVideoId(rawUrl: string): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;

  try {
    const urlStr = trimmed.startsWith("http://") || trimmed.startsWith("https://")
      ? trimmed
      : `https://${trimmed}`;
    const parsed = new URL(urlStr);
    const host = parsed.hostname.toLowerCase().replace(/^(?:www\.|m\.)/, "");

    if (host === "youtu.be") {
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];
      const match = parsed.pathname.match(/^\/([a-zA-Z0-9_-]{11})/);
      if (match) return match[1];
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      const shortsMatch = parsed.pathname.match(/^\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1];

      const embedMatch = parsed.pathname.match(/^\/embed\/([a-zA-Z0-9_-]{11})/);
      if (embedMatch) return embedMatch[1];

      const vMatch = parsed.pathname.match(/^\/v\/([a-zA-Z0-9_-]{11})/);
      if (vMatch) return vMatch[1];

      const liveMatch = parsed.pathname.match(/^\/live\/([a-zA-Z0-9_-]{11})/);
      if (liveMatch) return liveMatch[1];

      const vParam = parsed.searchParams.get("v");
      if (vParam) {
        const match = vParam.match(/^[a-zA-Z0-9_-]{11}/);
        if (match) return match[0];
      }
    }
  } catch {
    // fallback regex below
  }

  const generalMatch = trimmed.match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/|embed\/|v\/|live\/))([a-zA-Z0-9_-]{11})/i
  );
  return generalMatch ? generalMatch[1] : null;
}

export function isYouTubeShort(url: string): boolean {
  return /youtube\.com\/shorts\/|youtu\.be\/shorts\//i.test(url);
}

export function getYouTubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function extractYouTubeDetails(url: string): {
  videoId: string | null;
  cleanVideoId: string | null;
  isShort: boolean;
  canonicalUrl: string;
} {
  const videoId = extractYouTubeVideoId(url);
  const isShort = isYouTubeShort(url);
  const canonicalUrl = videoId
    ? isShort
      ? `https://www.youtube.com/shorts/${videoId}`
      : `https://www.youtube.com/watch?v=${videoId}`
    : url.trim();

  return { videoId, cleanVideoId: videoId, isShort, canonicalUrl };
}

export class YouTubeProvider extends BasePlatformProvider {
  platform: Platform = "youtube";

  detect(url: string): boolean {
    const lower = url.toLowerCase().trim();
    return lower.includes("youtube.com") || lower.includes("youtu.be");
  }

  extractContentId(url: string): string | null {
    return extractYouTubeVideoId(url);
  }

  getThumbnail(url: string, contentId?: string | null): string {
    const id = contentId || this.extractContentId(url);
    if (id) return getYouTubeThumbnail(id);
    return getDeterministicFallbackImage(isYouTubeShort(url) ? "youtube-shorts" : "youtube", url);
  }

  normalizeUrl(url: string): string {
    const videoId = this.extractContentId(url);
    if (videoId) {
      return isYouTubeShort(url) ? `youtube.com/shorts/${videoId}` : `youtube.com/watch?v=${videoId}`;
    }
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const videoId = contentId || this.extractContentId(url);
    const isShort = isYouTubeShort(url);
    const platform: Platform = isShort ? "youtube-shorts" : "youtube";
    const contentType: ContentType = isShort ? "short" : "video";
    const domain = "youtube.com";
    const canonicalUrl = videoId
      ? isShort
        ? `https://www.youtube.com/shorts/${videoId}`
        : `https://www.youtube.com/watch?v=${videoId}`
      : url.trim();

    const thumbnail = videoId
      ? getYouTubeThumbnail(videoId)
      : getDeterministicFallbackImage(platform, url);

    const provenance: Record<string, FieldProvenance> = {
      thumbnail: { value: thumbnail, source: "youtube_direct_id", retrievedAt: new Date().toISOString() },
    };

    // Try fetching YouTube oEmbed metadata
    let oEmbedData: { title?: string; author_name?: string; author_url?: string } | null = null;
    if (videoId) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 1800);
        const res = await fetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { signal: controller.signal }
        );
        clearTimeout(timeoutId);
        if (res.ok) {
          oEmbedData = await res.json();
        }
      } catch {
        // oEmbed failed / offline
      }
    }

    if (oEmbedData && oEmbedData.title) {
      const authorName = oEmbedData.author_name || "YouTube Creator";
      const cleanHandle = `@${authorName.toLowerCase().replace(/[^a-z0-9_]/g, "")}`;

      provenance.title = { value: oEmbedData.title, source: "youtube_oembed", retrievedAt: new Date().toISOString() };
      provenance.creator = { value: authorName, source: "youtube_oembed", retrievedAt: new Date().toISOString() };

      return {
        contentId: videoId,
        platform,
        contentType,
        url,
        canonicalUrl,
        title: oEmbedData.title,
        creator: {
          name: authorName,
          handle: cleanHandle || "@youtube",
          avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
          verified: true,
        },
        description: `YouTube ${isShort ? "Short" : "video"} published by ${authorName}.`,
        thumbnail,
        metadata: {
          domain,
          publishedAt: undefined, // YouTube oEmbed does not expose upload dates; never hallucinate today's date
          authorUrl: oEmbedData.author_url,
        },
        suggestedTags: isShort ? ["YouTubeShorts", "Video"] : ["YouTube", "Video"],
        suggestedCollectionName: isShort ? "UI Inspiration" : "Watch Later",
        status: "PARTIAL_CONTENT",
        isLimited: false,
        provenance,
      };
    }

    // Fallback when network oEmbed is unavailable: verified ID, honest status
    const title = videoId
      ? (isShort ? `YouTube Short • ${videoId}` : `YouTube Video • ${videoId}`)
      : "YouTube Video";

    provenance.title = { value: title, source: "url_parse", retrievedAt: new Date().toISOString() };
    provenance.creator = { value: "YouTube Channel", source: "url_parse", retrievedAt: new Date().toISOString() };

    return {
      contentId: videoId,
      platform,
      contentType,
      url,
      canonicalUrl,
      title,
      creator: {
        name: "YouTube Channel",
        handle: "@youtube",
        avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100&auto=format&fit=crop&q=80",
        verified: false,
      },
      description: videoId
        ? `YouTube ${isShort ? "Short" : "video"} (${videoId}) saved to Recall.`
        : "YouTube content saved to Recall.",
      thumbnail,
      metadata: {
        domain,
        publishedAt: undefined,
      },
      suggestedTags: isShort ? ["YouTubeShorts", "Video"] : ["YouTube", "Video"],
      suggestedCollectionName: isShort ? "UI Inspiration" : "Watch Later",
      status: "METADATA_ONLY",
      isLimited: true,
      limitedReason: "Channel details not accessible offline; video ID verified directly",
      provenance,
    };
  }

  async extractContent(url: string, contentId?: string | null): Promise<ExtractedContent> {
    const meta = await this.fetchMetadata(url, contentId);
    return {
      ...meta,
      bodyText: meta.description || null,
      caption: null,
      transcript: null,
      hashtags: meta.suggestedTags || [],
    };
  }
}

// ---------------------------------------------------------------------------
// 2. Instagram Provider
// ---------------------------------------------------------------------------

export function extractInstagramDetails(url: string): {
  code: string | null;
  username: string | null;
  isReel: boolean;
  canonicalUrl: string;
} {
  try {
    const trimmed = url.trim();
    const isReel = /instagram\.com\/reel\//i.test(trimmed);

    // Check for username in URL path: instagram.com/username/(p|reel)/code
    const userPathMatch = trimmed.match(/instagram\.com\/([a-zA-Z0-9_\.]+)\/(?:reel|reels|p)\/([a-zA-Z0-9_\-]+)/i);
    if (userPathMatch) {
      return {
        code: userPathMatch[2],
        username: userPathMatch[1],
        isReel,
        canonicalUrl: isReel
          ? `https://www.instagram.com/reel/${userPathMatch[2]}/`
          : `https://www.instagram.com/p/${userPathMatch[2]}/`,
      };
    }

    const codeMatch = trimmed.match(/instagram\.com\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_\-]+)/i);
    if (codeMatch && codeMatch[1]) {
      const code = codeMatch[1].split(/[?#&]/)[0];
      return {
        code,
        username: null,
        isReel,
        canonicalUrl: isReel
          ? `https://www.instagram.com/reel/${code}/`
          : `https://www.instagram.com/p/${code}/`,
      };
    }

    return { code: null, username: null, isReel, canonicalUrl: trimmed };
  } catch {
    return { code: null, username: null, isReel: false, canonicalUrl: url };
  }
}

export class InstagramProvider extends BasePlatformProvider {
  platform: Platform = "instagram";

  detect(url: string): boolean {
    return /instagram\.com|instagr\.am/i.test(url);
  }

  extractContentId(url: string): string | null {
    const details = extractInstagramDetails(url);
    return details.code;
  }

  getThumbnail(url: string, contentId?: string | null): string {
    const id = contentId || this.extractContentId(url);
    return getDeterministicFallbackImage("instagram", id || url);
  }

  normalizeUrl(url: string): string {
    const { code, isReel } = extractInstagramDetails(url);
    if (code) {
      return isReel ? `instagram.com/reel/${code}` : `instagram.com/p/${code}`;
    }
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const { code, username, isReel, canonicalUrl } = extractInstagramDetails(url);
    const id = contentId || code;
    const thumbnail = this.getThumbnail(url, id);
    const contentType: ContentType = isReel ? "reel" : "post";
    const domain = "instagram.com";

    const provenance: Record<string, FieldProvenance> = {
      thumbnail: { value: thumbnail, source: "platform_preview", retrievedAt: new Date().toISOString() },
    };

    if (username) {
      const title = `Instagram ${isReel ? "Reel" : "Post"} by @${username}`;
      provenance.title = { value: title, source: "url_parse", retrievedAt: new Date().toISOString() };
      provenance.creator = { value: username, source: "url_parse", retrievedAt: new Date().toISOString() };

      return {
        contentId: id,
        platform: "instagram",
        contentType,
        url,
        canonicalUrl,
        title,
        creator: {
          name: `@${username}`,
          handle: `@${username}`,
          avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
          verified: false,
        },
        description: `Instagram ${isReel ? "Reel" : "Post"} from @${username} (${id || "post"}).`,
        thumbnail,
        metadata: {
          domain,
          publishedAt: undefined,
        },
        suggestedTags: isReel ? ["Instagram", "Reel"] : ["Instagram", "Post"],
        suggestedCollectionName: "UI Inspiration",
        status: "PARTIAL_CONTENT",
        isLimited: true,
        limitedReason: "Instagram requires login for full caption and audio transcript",
        provenance,
      };
    }

    // Never display fake "@instagram_user" or "Instagram Creator"!
    const title = id
      ? (isReel ? `Instagram Reel • ${id}` : `Instagram Post • ${id}`)
      : "Instagram Post";

    provenance.title = { value: title, source: "url_parse", retrievedAt: new Date().toISOString() };
    provenance.creator = { value: "Instagram User", source: "restricted_platform", retrievedAt: new Date().toISOString() };

    return {
      contentId: id,
      platform: "instagram",
      contentType,
      url,
      canonicalUrl,
      title,
      creator: {
        name: "Instagram User",
        handle: undefined, // Honest: no fabricated handle
        avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&auto=format&fit=crop&q=80",
        verified: false,
      },
      description: id
        ? `Instagram ${isReel ? "Reel" : "post"} (${id}) saved to Recall.`
        : "Instagram content saved to Recall.",
      thumbnail,
      metadata: {
        domain,
        publishedAt: undefined,
      },
      suggestedTags: isReel ? ["Instagram", "Reel"] : ["Instagram", "Post"],
      suggestedCollectionName: "UI Inspiration",
      status: "METADATA_ONLY",
      isLimited: true,
      limitedReason: "Instagram requires authentication to view creator profile and full caption",
      provenance,
    };
  }

  async extractContent(url: string, contentId?: string | null): Promise<ExtractedContent> {
    const meta = await this.fetchMetadata(url, contentId);
    return {
      ...meta,
      bodyText: meta.description || null,
      caption: meta.description || null,
      transcript: null,
      hashtags: meta.suggestedTags || [],
    };
  }
}

// ---------------------------------------------------------------------------
// 3. TikTok Provider
// ---------------------------------------------------------------------------

export function extractTikTokDetails(url: string): {
  username: string | null;
  videoId: string | null;
  canonicalUrl: string;
} {
  try {
    const trimmed = url.trim();
    const match = trimmed.match(/tiktok\.com\/@([a-zA-Z0-9_\-\.]+)\/video\/([0-9a-zA-Z_\-]+)/i);
    if (match) {
      const username = match[1];
      const videoId = match[2].split(/[?#&]/)[0];
      return {
        username,
        videoId,
        canonicalUrl: `https://www.tiktok.com/@${username}/video/${videoId}`,
      };
    }
    const shortMatch = trimmed.match(/(?:vm\.tiktok\.com|vt\.tiktok\.com)\/([a-zA-Z0-9_\-]+)/i);
    if (shortMatch) {
      const code = shortMatch[1].split(/[?#&]/)[0];
      return {
        username: null,
        videoId: code,
        canonicalUrl: `https://vm.tiktok.com/${code}`,
      };
    }
    return { username: null, videoId: null, canonicalUrl: trimmed };
  } catch {
    return { username: null, videoId: null, canonicalUrl: url };
  }
}

export class TikTokProvider extends BasePlatformProvider {
  platform: Platform = "tiktok";

  detect(url: string): boolean {
    return /tiktok\.com/i.test(url);
  }

  extractContentId(url: string): string | null {
    const { videoId } = extractTikTokDetails(url);
    return videoId;
  }

  getThumbnail(url: string, contentId?: string | null): string {
    const id = contentId || this.extractContentId(url);
    return getDeterministicFallbackImage("tiktok", id || url);
  }

  normalizeUrl(url: string): string {
    const { username, videoId } = extractTikTokDetails(url);
    if (username && videoId) {
      return `tiktok.com/@${username}/video/${videoId}`;
    }
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const { username, videoId, canonicalUrl } = extractTikTokDetails(url);
    const id = contentId || videoId;
    const thumbnail = this.getThumbnail(url, id);
    const domain = "tiktok.com";

    const provenance: Record<string, FieldProvenance> = {
      thumbnail: { value: thumbnail, source: "platform_preview", retrievedAt: new Date().toISOString() },
    };

    // Try fetching TikTok oEmbed metadata
    let oEmbedData: { title?: string; author_name?: string; author_unique_id?: string; thumbnail_url?: string } | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(
        `https://www.tiktok.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        oEmbedData = await res.json();
      }
    } catch {
      // offline / blocked
    }

    if (oEmbedData && oEmbedData.title) {
      const authorName = oEmbedData.author_name || username || "TikTok Creator";
      const authorHandle = oEmbedData.author_unique_id ? `@${oEmbedData.author_unique_id}` : (username ? `@${username}` : undefined);

      provenance.title = { value: oEmbedData.title, source: "tiktok_oembed", retrievedAt: new Date().toISOString() };
      provenance.creator = { value: authorName, source: "tiktok_oembed", retrievedAt: new Date().toISOString() };

      return {
        contentId: id,
        platform: "tiktok",
        contentType: "short",
        url,
        canonicalUrl,
        title: oEmbedData.title,
        creator: {
          name: authorName,
          handle: authorHandle,
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
          verified: false,
        },
        description: oEmbedData.title,
        thumbnail: oEmbedData.thumbnail_url || thumbnail,
        metadata: {
          domain,
          publishedAt: undefined,
        },
        suggestedTags: ["TikTok", "Video", "ShortForm"],
        suggestedCollectionName: "Healthy Recipes",
        status: "PARTIAL_CONTENT",
        isLimited: false,
        provenance,
      };
    }

    // Fallback using username extracted directly from URL
    const title = username
      ? `TikTok video by @${username}`
      : (id ? `TikTok Video • ${id}` : "TikTok Video");

    provenance.title = { value: title, source: "url_parse", retrievedAt: new Date().toISOString() };
    provenance.creator = { value: username || "TikTok User", source: "url_parse", retrievedAt: new Date().toISOString() };

    return {
      contentId: id,
      platform: "tiktok",
      contentType: "short",
      url,
      canonicalUrl,
      title,
      creator: {
        name: username ? `@${username}` : "TikTok User",
        handle: username ? `@${username}` : undefined,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        verified: false,
      },
      description: username ? `TikTok video from @${username}.` : "TikTok short video saved to Recall.",
      thumbnail,
      metadata: {
        domain,
        publishedAt: undefined,
      },
      suggestedTags: ["TikTok", "Video"],
      suggestedCollectionName: "Healthy Recipes",
      status: username ? "PARTIAL_CONTENT" : "METADATA_ONLY",
      isLimited: !username,
      limitedReason: !username ? "TikTok short-link requires redirect resolution" : undefined,
      provenance,
    };
  }
}

// ---------------------------------------------------------------------------
// 4. Reddit Provider
// ---------------------------------------------------------------------------

export function extractRedditDetails(url: string): {
  subreddit: string | null;
  postId: string | null;
  slug: string | null;
  canonicalUrl: string;
} {
  try {
    const trimmed = url.trim();
    const match = trimmed.match(/reddit\.com\/r\/([a-zA-Z0-9_\-]+)\/comments\/([a-zA-Z0-9_\-]+)(?:\/([a-zA-Z0-9_\-]+))?/i);
    if (match) {
      const subreddit = match[1];
      const postId = match[2];
      const slug = match[3] || null;
      return {
        subreddit,
        postId,
        slug,
        canonicalUrl: `https://www.reddit.com/r/${subreddit}/comments/${postId}`,
      };
    }
    const shortMatch = trimmed.match(/redd\.it\/([a-zA-Z0-9_\-]+)/i);
    if (shortMatch) {
      return {
        subreddit: null,
        postId: shortMatch[1],
        slug: null,
        canonicalUrl: `https://redd.it/${shortMatch[1]}`,
      };
    }
    return { subreddit: null, postId: null, slug: null, canonicalUrl: trimmed };
  } catch {
    return { subreddit: null, postId: null, slug: null, canonicalUrl: url };
  }
}

export class RedditProvider extends BasePlatformProvider {
  platform: Platform = "reddit";

  detect(url: string): boolean {
    return /reddit\.com|redd\.it/i.test(url);
  }

  extractContentId(url: string): string | null {
    const { postId } = extractRedditDetails(url);
    return postId;
  }

  getThumbnail(url: string, contentId?: string | null): string {
    const id = contentId || this.extractContentId(url);
    return getDeterministicFallbackImage("reddit", id || url);
  }

  normalizeUrl(url: string): string {
    const { subreddit, postId } = extractRedditDetails(url);
    if (subreddit && postId) {
      return `reddit.com/r/${subreddit}/comments/${postId}`;
    }
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const { subreddit, postId, slug, canonicalUrl } = extractRedditDetails(url);
    const id = contentId || postId;
    let thumbnail = this.getThumbnail(url, id);
    const domain = "reddit.com";

    const provenance: Record<string, FieldProvenance> = {
      thumbnail: { value: thumbnail, source: "platform_preview", retrievedAt: new Date().toISOString() },
    };

    // 1. Primary Strategy: Try Reddit public .json API for full post data (body, real author, timestamp, score)
    let redditPostData: {
      title?: string;
      author?: string;
      selftext?: string;
      created_utc?: number;
      subreddit?: string;
      ups?: number;
      score?: number;
      num_comments?: number;
      thumbnail?: string;
      url?: string;
      link_flair_text?: string;
    } | null = null;

    if (id) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2400);
        const jsonEndpoint = subreddit
          ? `https://www.reddit.com/r/${subreddit}/comments/${id}.json`
          : `https://www.reddit.com/comments/${id}.json`;
        const res = await fetch(jsonEndpoint, {
          signal: controller.signal,
          headers: { Accept: "application/json" },
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (Array.isArray(json) && json[0]?.data?.children?.[0]?.data) {
            redditPostData = json[0].data.children[0].data;
          }
        }
      } catch {
        // Proceed to oEmbed fallback
      }
    }

    if (redditPostData && redditPostData.title) {
      const realSubreddit = redditPostData.subreddit || subreddit || "reddit";
      const author = redditPostData.author
        ? (redditPostData.author.startsWith("u/") ? redditPostData.author : `u/${redditPostData.author}`)
        : `r/${realSubreddit}`;

      const rawBody = (redditPostData.selftext || "").trim();
      const realPublishedAt = redditPostData.created_utc
        ? new Date(redditPostData.created_utc * 1000).toISOString().split("T")[0]
        : undefined;

      const upvotes = redditPostData.ups !== undefined ? String(redditPostData.ups) : (redditPostData.score !== undefined ? String(redditPostData.score) : undefined);
      const comments = redditPostData.num_comments !== undefined ? String(redditPostData.num_comments) : undefined;

      if (redditPostData.thumbnail && redditPostData.thumbnail.startsWith("http")) {
        thumbnail = redditPostData.thumbnail;
      }

      provenance.title = { value: redditPostData.title, source: "reddit_api", retrievedAt: new Date().toISOString() };
      provenance.creator = { value: author, source: "reddit_api", retrievedAt: new Date().toISOString() };
      if (rawBody) {
        provenance.body = { value: rawBody.slice(0, 100) + "...", source: "reddit_api", retrievedAt: new Date().toISOString() };
      }
      if (realPublishedAt) {
        provenance.publishedAt = { value: realPublishedAt, source: "reddit_api", retrievedAt: new Date().toISOString() };
      }

      return {
        contentId: id,
        platform: "reddit",
        contentType: "post",
        url,
        canonicalUrl,
        title: redditPostData.title,
        creator: {
          name: author,
          handle: author,
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
          verified: false,
        },
        description: rawBody || `Reddit discussion in r/${realSubreddit}: ${redditPostData.title}`,
        thumbnail,
        metadata: {
          domain,
          publishedAt: realPublishedAt,
          upvotes,
          comments,
          authorUrl: redditPostData.author ? `https://www.reddit.com/user/${redditPostData.author}` : undefined,
        },
        suggestedTags: [realSubreddit, "Reddit", "Discussion"],
        suggestedCollectionName: "Business Ideas",
        status: rawBody ? "FULL_CONTENT" : "PARTIAL_CONTENT",
        isLimited: false,
        provenance,
      };
    }

    // 2. Secondary Strategy: Try fetching Reddit oEmbed metadata
    let oEmbedData: { title?: string; author_name?: string; author_url?: string } | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1800);
      const res = await fetch(
        `https://www.reddit.com/oembed?url=${encodeURIComponent(canonicalUrl)}`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        oEmbedData = await res.json();
      }
    } catch {
      // offline / blocked
    }

    if (oEmbedData && oEmbedData.title) {
      const author = oEmbedData.author_name ? `u/${oEmbedData.author_name}` : (subreddit ? `r/${subreddit}` : "Reddit User");
      provenance.title = { value: oEmbedData.title, source: "reddit_oembed", retrievedAt: new Date().toISOString() };
      provenance.creator = { value: author, source: "reddit_oembed", retrievedAt: new Date().toISOString() };

      return {
        contentId: id,
        platform: "reddit",
        contentType: "post",
        url,
        canonicalUrl,
        title: oEmbedData.title,
        creator: {
          name: author,
          handle: author,
          avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
          verified: false,
        },
        description: `Reddit discussion in ${subreddit ? `r/${subreddit}` : "community"}: ${oEmbedData.title}`,
        thumbnail,
        metadata: {
          domain,
          publishedAt: undefined, // oEmbed does not expose dates; never fabricate today's date
          authorUrl: oEmbedData.author_url,
        },
        suggestedTags: subreddit ? [subreddit, "Reddit", "Discussion"] : ["Reddit", "Discussion"],
        suggestedCollectionName: "Business Ideas",
        status: "PARTIAL_CONTENT",
        isLimited: false,
        provenance,
      };
    }

    // 3. Fallback using URL slug
    let title: string;
    if (slug) {
      title = formatSlugToTitle(slug);
    } else if (subreddit) {
      title = `Discussion on r/${subreddit}`;
    } else if (id) {
      title = `Reddit Post • ${id}`;
    } else {
      title = "Reddit Community Discussion";
    }

    const creatorName = subreddit ? `r/${subreddit}` : "Reddit Community";
    provenance.title = { value: title, source: "url_parse", retrievedAt: new Date().toISOString() };
    provenance.creator = { value: creatorName, source: "url_parse", retrievedAt: new Date().toISOString() };

    return {
      contentId: id,
      platform: "reddit",
      contentType: "post",
      url,
      canonicalUrl,
      title,
      creator: {
        name: creatorName,
        handle: subreddit ? `r/${subreddit}` : undefined,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        verified: false,
      },
      description: `Community post on Reddit ${subreddit ? `in r/${subreddit}` : ""}: ${title}.`,
      thumbnail,
      metadata: {
        domain,
        publishedAt: undefined,
      },
      suggestedTags: subreddit ? [subreddit, "Reddit", "Discussion"] : ["Reddit", "Discussion"],
      suggestedCollectionName: "Business Ideas",
      status: slug ? "PARTIAL_CONTENT" : "METADATA_ONLY",
      isLimited: !slug,
      limitedReason: !slug ? "Reddit post body requires network access" : undefined,
      provenance,
    };
  }

  async extractContent(url: string, contentId?: string | null): Promise<ExtractedContent> {
    const meta = await this.fetchMetadata(url, contentId);
    const { subreddit } = extractRedditDetails(url);
    return {
      ...meta,
      bodyText: meta.description || null,
      caption: null,
      transcript: null,
      hashtags: [],
      subreddit: subreddit || undefined,
    };
  }
}

// ---------------------------------------------------------------------------
// 5. LinkedIn Provider
// ---------------------------------------------------------------------------

export function extractLinkedInDetails(url: string): {
  id: string | null;
  slug: string | null;
  isPulse: boolean;
  canonicalUrl: string;
} {
  try {
    const trimmed = url.trim();
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
    const postMatch = trimmed.match(/linkedin\.com\/(?:posts|feed\/update\/urn:li:activity:)([a-zA-Z0-9_\-]+)/i);
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

export class LinkedInProvider extends BasePlatformProvider {
  platform: Platform = "linkedin";

  detect(url: string): boolean {
    return /linkedin\.com/i.test(url);
  }

  extractContentId(url: string): string | null {
    const { id } = extractLinkedInDetails(url);
    return id;
  }

  getThumbnail(url: string, contentId?: string | null): string {
    const id = contentId || this.extractContentId(url);
    return getDeterministicFallbackImage("linkedin", id || url);
  }

  normalizeUrl(url: string): string {
    const { id, isPulse } = extractLinkedInDetails(url);
    if (id) {
      return isPulse ? `linkedin.com/pulse/${id}` : `linkedin.com/posts/${id}`;
    }
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const { id, slug, isPulse, canonicalUrl } = extractLinkedInDetails(url);
    const thumbnail = this.getThumbnail(url, id);
    const domain = "linkedin.com";

    const title = slug
      ? formatSlugToTitle(slug)
      : (id ? `LinkedIn Post • ${id}` : "LinkedIn Post");

    const provenance: Record<string, FieldProvenance> = {
      title: { value: title, source: "url_parse", retrievedAt: new Date().toISOString() },
      creator: { value: "LinkedIn Member", source: "restricted_platform", retrievedAt: new Date().toISOString() },
      thumbnail: { value: thumbnail, source: "platform_preview", retrievedAt: new Date().toISOString() },
    };

    return {
      contentId: id,
      platform: "linkedin",
      contentType: isPulse ? "article" : "post",
      url,
      canonicalUrl,
      title,
      creator: {
        name: "LinkedIn Member",
        handle: undefined, // Do not fabricate unavailable author
        avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&auto=format&fit=crop&q=80",
        verified: false,
      },
      description: isPulse
        ? `LinkedIn Pulse article: ${title}.`
        : `LinkedIn professional update (${id || "post"}).`,
      thumbnail,
      metadata: {
        domain,
        publishedAt: undefined,
      },
      suggestedTags: ["LinkedIn", "Professional", "Career"],
      suggestedCollectionName: "Business Ideas",
      status: "METADATA_ONLY",
      isLimited: true,
      limitedReason: "LinkedIn requires authentication to view full post body and author details",
      provenance,
    };
  }
}

// ---------------------------------------------------------------------------
// 6. Twitter / X Provider
// ---------------------------------------------------------------------------

export function extractTwitterDetails(url: string): {
  statusId: string | null;
  username: string | null;
  canonicalUrl: string;
} {
  try {
    const trimmed = url.trim();
    const match = trimmed.match(/(?:twitter\.com|x\.com)\/(?:(?:i\/web\/status|i\/status)\/([0-9]+)|([a-zA-Z0-9_]+)\/status\/([0-9]+))/i);
    if (match) {
      const statusId = match[1] || match[3];
      const username = match[2] || null;
      const canonicalUrl = username
        ? `https://x.com/${username}/status/${statusId}`
        : `https://x.com/i/status/${statusId}`;
      return {
        username,
        statusId,
        canonicalUrl,
      };
    }
    return { statusId: null, username: null, canonicalUrl: trimmed };
  } catch {
    return { statusId: null, username: null, canonicalUrl: url };
  }
}

export class TwitterProvider extends BasePlatformProvider {
  platform: Platform = "twitter";

  detect(url: string): boolean {
    return /twitter\.com|x\.com/i.test(url);
  }

  extractContentId(url: string): string | null {
    const { statusId } = extractTwitterDetails(url);
    return statusId;
  }

  getThumbnail(url: string, contentId?: string | null): string {
    const id = contentId || this.extractContentId(url);
    return getDeterministicFallbackImage("twitter", id || url);
  }

  normalizeUrl(url: string): string {
    const { username, statusId } = extractTwitterDetails(url);
    if (username && statusId) {
      return `x.com/${username}/status/${statusId}`;
    }
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const { username, statusId, canonicalUrl } = extractTwitterDetails(url);
    const id = contentId || statusId;
    const thumbnail = this.getThumbnail(url, id);
    const domain = "x.com";

    const provenance: Record<string, FieldProvenance> = {
      thumbnail: { value: thumbnail, source: "platform_preview", retrievedAt: new Date().toISOString() },
    };

    // Try Twitter oEmbed via reliable publish.twitter.com endpoint
    let oEmbedData: { author_name?: string; author_url?: string; html?: string } | null = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2500);
      const oembedTarget = `https://twitter.com/${username || "twitter"}/status/${id || ""}`;
      const res = await fetch(
        `https://publish.twitter.com/oembed?url=${encodeURIComponent(oembedTarget)}&omit_script=true`,
        { signal: controller.signal }
      );
      clearTimeout(timeoutId);
      if (res.ok) {
        oEmbedData = await res.json();
      }
    } catch {
      // offline / blocked / rate limited
    }

    if (oEmbedData) {
      let postText = "";
      let publishedDate: string | undefined = undefined;
      let authorHandle = username ? `@${username}` : undefined;

      if (oEmbedData.html) {
        // 1. Extract tweet body text from <p lang="..." dir="...">...</p>
        const pMatch = oEmbedData.html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
        if (pMatch && pMatch[1]) {
          let rawText = pMatch[1];
          rawText = rawText.replace(/<br\s*\/?>/gi, "\n");
          rawText = rawText.replace(/<[^>]+>/g, "");
          rawText = rawText
            .replace(/&amp;/g, "&")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&quot;/g, '"')
            .replace(/&#39;/g, "'")
            .replace(/&mdash;/g, "—")
            .trim();
          postText = rawText;
        }

        // 2. Extract published date from date anchor tag in blockquote (e.g. <a href="...">March 18, 2024</a>)
        const dateMatch = oEmbedData.html.match(/<a\b[^>]*>([A-Za-z]+\s+\d{1,2},\s+\d{4})<\/a>/i);
        if (dateMatch && dateMatch[1]) {
          const parsedDate = new Date(dateMatch[1]);
          if (!isNaN(parsedDate.getTime())) {
            publishedDate = parsedDate.toISOString().split("T")[0];
          }
        }

        // 3. Extract handle if present in text attribution (&mdash; Name (@handle))
        const handleMatch = oEmbedData.html.match(/\(@([A-Za-z0-9_]+)\)/i);
        if (handleMatch && handleMatch[1]) {
          authorHandle = `@${handleMatch[1]}`;
        }
      }

      const authorName = oEmbedData.author_name || (authorHandle ? authorHandle : "X User");

      let title = "";
      if (postText) {
        const firstLine = postText.split("\n")[0].trim();
        title = firstLine.length > 90 ? `${firstLine.slice(0, 87)}...` : firstLine;
      }
      if (!title) {
        title = `Post by ${authorName}`;
      }

      provenance.title = { value: title, source: "twitter_oembed", retrievedAt: new Date().toISOString() };
      provenance.creator = { value: authorName, source: "twitter_oembed", retrievedAt: new Date().toISOString() };

      return {
        contentId: id,
        platform: "twitter",
        contentType: "post",
        url,
        canonicalUrl,
        title,
        creator: {
          name: authorName,
          handle: authorHandle,
          avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80",
          verified: true,
        },
        description: postText || `X (Twitter) post by ${authorName}.`,
        thumbnail,
        metadata: {
          domain,
          publishedAt: publishedDate, // Honest: real extracted date or undefined
          authorUrl: oEmbedData.author_url,
        },
        suggestedTags: ["X", "Twitter", "Tech"],
        suggestedCollectionName: "AI & Automation",
        status: "FULL_CONTENT",
        isLimited: false,
        provenance,
      };
    }

    // Fallback using real username from URL
    const title = username ? `Post by @${username}` : (id ? `Post on X • ${id}` : "X Post");
    provenance.title = { value: title, source: "url_parse", retrievedAt: new Date().toISOString() };
    provenance.creator = { value: username || "X User", source: "url_parse", retrievedAt: new Date().toISOString() };

    return {
      contentId: id,
      platform: "twitter",
      contentType: "post",
      url,
      canonicalUrl,
      title,
      creator: {
        name: username ? `@${username}` : "X User",
        handle: username ? `@${username}` : undefined,
        avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80",
        verified: false,
      },
      description: username ? `Post shared by @${username} on X.` : "Post shared on X (Twitter).",
      thumbnail,
      metadata: {
        domain,
        publishedAt: undefined, // Honest: do NOT fake today's date
      },
      suggestedTags: ["X", "Twitter"],
      suggestedCollectionName: "AI & Automation",
      status: username ? "PARTIAL_CONTENT" : "METADATA_ONLY",
      isLimited: !username,
      limitedReason: !username ? "Post author requires platform network access" : undefined,
      provenance,
    };
  }

  async extractContent(url: string, contentId?: string | null): Promise<ExtractedContent> {
    const meta = await this.fetchMetadata(url, contentId);
    return {
      ...meta,
      bodyText: meta.description || null,
      caption: meta.description || null,
      transcript: null,
      hashtags: meta.suggestedTags || [],
    };
  }
}

// ---------------------------------------------------------------------------
// 7. Pinterest Provider
// ---------------------------------------------------------------------------

export function extractPinterestDetails(url: string): {
  pinId: string | null;
  canonicalUrl: string;
} {
  try {
    const trimmed = url.trim();
    const match = trimmed.match(/pinterest\.com\/pin\/([0-9a-zA-Z_-]+)/i);
    if (match) {
      return { pinId: match[1], canonicalUrl: `https://www.pinterest.com/pin/${match[1]}/` };
    }
    return { pinId: null, canonicalUrl: trimmed };
  } catch {
    return { pinId: null, canonicalUrl: url };
  }
}

export class PinterestProvider extends BasePlatformProvider {
  platform: Platform = "pinterest";

  detect(url: string): boolean {
    return /pinterest\.com|pin\.it/i.test(url);
  }

  extractContentId(url: string): string | null {
    const { pinId } = extractPinterestDetails(url);
    return pinId;
  }

  getThumbnail(url: string, contentId?: string | null): string {
    const id = contentId || this.extractContentId(url);
    return getDeterministicFallbackImage("pinterest", id || url);
  }

  normalizeUrl(url: string): string {
    const { pinId } = extractPinterestDetails(url);
    if (pinId) return `pinterest.com/pin/${pinId}`;
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const { pinId, canonicalUrl } = extractPinterestDetails(url);
    const id = contentId || pinId;
    const thumbnail = this.getThumbnail(url, id);
    const title = id ? `Pinterest Pin • ${id}` : "Pinterest Pin";

    const provenance: Record<string, FieldProvenance> = {
      title: { value: title, source: "url_parse", retrievedAt: new Date().toISOString() },
      creator: { value: "Pinterest Creator", source: "restricted_platform", retrievedAt: new Date().toISOString() },
      thumbnail: { value: thumbnail, source: "platform_preview", retrievedAt: new Date().toISOString() },
    };

    return {
      contentId: id,
      platform: "pinterest",
      contentType: "image",
      url,
      canonicalUrl,
      title,
      creator: {
        name: "Pinterest Creator",
        handle: undefined,
        avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80",
        verified: false,
      },
      description: id ? `Visual pin (${id}) saved from Pinterest.` : "Visual pin saved from Pinterest.",
      thumbnail,
      metadata: {
        domain: "pinterest.com",
        publishedAt: undefined,
      },
      suggestedTags: ["Pinterest", "Visuals", "Design"],
      suggestedCollectionName: "UI Inspiration",
      status: "METADATA_ONLY",
      isLimited: true,
      limitedReason: "Pinterest requires login to view high-resolution image details and creator board",
      provenance,
    };
  }
}

// ---------------------------------------------------------------------------
// 8. Facebook & Threads Providers
// ---------------------------------------------------------------------------

export function extractFacebookDetails(url: string): {
  id: string | null;
  canonicalUrl: string;
} {
  try {
    const trimmed = url.trim();
    const match = trimmed.match(/(?:facebook\.com|fb\.watch|fb\.com)\/(?:watch\/\?v=|videos\/|posts\/)?([0-9a-zA-Z_-]+)/i);
    return { id: match ? match[1] : null, canonicalUrl: trimmed };
  } catch {
    return { id: null, canonicalUrl: url };
  }
}

export class FacebookProvider extends BasePlatformProvider {
  platform: Platform = "facebook";

  detect(url: string): boolean {
    return /facebook\.com|fb\.watch|fb\.com/i.test(url);
  }

  extractContentId(url: string): string | null {
    const { id } = extractFacebookDetails(url);
    return id;
  }

  getThumbnail(url: string, contentId?: string | null): string {
    const id = contentId || this.extractContentId(url);
    return getDeterministicFallbackImage("facebook", id || url);
  }

  normalizeUrl(url: string): string {
    const { id } = extractFacebookDetails(url);
    if (id) return `facebook.com/posts/${id}`;
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const { id, canonicalUrl } = extractFacebookDetails(url);
    const thumbnail = this.getThumbnail(url, id);
    const title = id ? `Facebook Post • ${id}` : "Facebook Post";

    const provenance: Record<string, FieldProvenance> = {
      title: { value: title, source: "url_parse", retrievedAt: new Date().toISOString() },
      creator: { value: "Facebook User", source: "restricted_platform", retrievedAt: new Date().toISOString() },
      thumbnail: { value: thumbnail, source: "platform_preview", retrievedAt: new Date().toISOString() },
    };

    return {
      contentId: id,
      platform: "facebook",
      contentType: "post",
      url,
      canonicalUrl,
      title,
      creator: {
        name: "Facebook User",
        handle: undefined,
        avatar: "https://images.unsplash.com/photo-1542744094-3a31f272c490?w=100&auto=format&fit=crop&q=80",
        verified: false,
      },
      description: id ? `Facebook post (${id}) saved to Recall.` : "Facebook post saved to Recall.",
      thumbnail,
      metadata: {
        domain: "facebook.com",
        publishedAt: undefined,
      },
      suggestedTags: ["Facebook", "Post"],
      suggestedCollectionName: "Useful Tools",
      status: "METADATA_ONLY",
      isLimited: true,
      limitedReason: "Facebook requires authentication to access post contents",
      provenance,
    };
  }
}

export function extractThreadsDetails(url: string): {
  username: string | null;
  postId: string | null;
  canonicalUrl: string;
} {
  try {
    const trimmed = url.trim();
    const match = trimmed.match(/threads\.net\/@([a-zA-Z0-9_\.]+)\/post\/([a-zA-Z0-9_\-]+)/i);
    if (match) {
      return {
        username: match[1],
        postId: match[2],
        canonicalUrl: `https://www.threads.net/@${match[1]}/post/${match[2]}`,
      };
    }
    return { username: null, postId: null, canonicalUrl: trimmed };
  } catch {
    return { username: null, postId: null, canonicalUrl: url };
  }
}

export class ThreadsProvider extends BasePlatformProvider {
  platform: Platform = "threads";

  detect(url: string): boolean {
    return /threads\.net/i.test(url);
  }

  extractContentId(url: string): string | null {
    const { postId } = extractThreadsDetails(url);
    return postId;
  }

  getThumbnail(url: string, contentId?: string | null): string {
    const id = contentId || this.extractContentId(url);
    return getDeterministicFallbackImage("threads", id || url);
  }

  normalizeUrl(url: string): string {
    const { username, postId } = extractThreadsDetails(url);
    if (username && postId) {
      return `threads.net/@${username}/post/${postId}`;
    }
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const { username, postId, canonicalUrl } = extractThreadsDetails(url);
    const id = contentId || postId;
    const thumbnail = this.getThumbnail(url, id);

    const title = username ? `Thread by @${username}` : (id ? `Thread • ${id}` : "Threads Post");

    const provenance: Record<string, FieldProvenance> = {
      title: { value: title, source: "url_parse", retrievedAt: new Date().toISOString() },
      creator: { value: username || "Threads User", source: "url_parse", retrievedAt: new Date().toISOString() },
      thumbnail: { value: thumbnail, source: "platform_preview", retrievedAt: new Date().toISOString() },
    };

    return {
      contentId: id,
      platform: "threads",
      contentType: "post",
      url,
      canonicalUrl,
      title,
      creator: {
        name: username ? `@${username}` : "Threads User",
        handle: username ? `@${username}` : undefined,
        avatar: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=100&auto=format&fit=crop&q=80",
        verified: false,
      },
      description: username ? `Thread by @${username} on Threads.` : "Thread saved from Threads.",
      thumbnail,
      metadata: {
        domain: "threads.net",
        publishedAt: undefined,
      },
      suggestedTags: ["Threads", "Post"],
      suggestedCollectionName: "UI Inspiration",
      status: username ? "PARTIAL_CONTENT" : "METADATA_ONLY",
      isLimited: !username,
      limitedReason: !username ? "Threads requires login to view thread body" : undefined,
      provenance,
    };
  }
}

// ---------------------------------------------------------------------------
// 9. GitHub & Generic Website Providers
// ---------------------------------------------------------------------------

export function extractGitHubDetails(url: string): {
  owner: string | null;
  repo: string | null;
  canonicalUrl: string;
} {
  try {
    const trimmed = url.trim();
    const match = trimmed.match(/github\.com\/([a-zA-Z0-9_\-]+)\/([a-zA-Z0-9_\-\.]+)/i);
    if (match) {
      const owner = match[1];
      const repo = match[2].replace(/\.git$/i, "");
      return {
        owner,
        repo,
        canonicalUrl: `https://github.com/${owner}/${repo}`,
      };
    }
    return { owner: null, repo: null, canonicalUrl: trimmed };
  } catch {
    return { owner: null, repo: null, canonicalUrl: url };
  }
}

export class GitHubProvider extends BasePlatformProvider {
  platform: Platform = "github";

  detect(url: string): boolean {
    return /github\.com/i.test(url);
  }

  extractContentId(url: string): string | null {
    const { owner, repo } = extractGitHubDetails(url);
    return owner && repo ? `${owner}/${repo}` : null;
  }

  getThumbnail(url: string, contentId?: string | null): string {
    const id = contentId || this.extractContentId(url);
    return getDeterministicFallbackImage("github", id || url);
  }

  normalizeUrl(url: string): string {
    const { owner, repo } = extractGitHubDetails(url);
    if (owner && repo) return `github.com/${owner}/${repo}`;
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const { owner, repo, canonicalUrl } = extractGitHubDetails(url);
    const id = contentId || (owner && repo ? `${owner}/${repo}` : null);
    const thumbnail = this.getThumbnail(url, id);
    const title = owner && repo ? `${owner} / ${repo}` : "GitHub Repository";

    const provenance: Record<string, FieldProvenance> = {
      title: { value: title, source: "url_parse", retrievedAt: new Date().toISOString() },
      creator: { value: owner || "GitHub User", source: "url_parse", retrievedAt: new Date().toISOString() },
      thumbnail: { value: thumbnail, source: "platform_preview", retrievedAt: new Date().toISOString() },
    };

    return {
      contentId: id,
      platform: "github",
      contentType: "product",
      url,
      canonicalUrl,
      title,
      creator: {
        name: owner ? `@${owner}` : "GitHub Developer",
        handle: owner ? `@${owner}` : undefined,
        avatar: "https://images.unsplash.com/photo-1618401471353-b98afee0b2eb?w=100&auto=format&fit=crop&q=80",
        verified: true,
      },
      description: owner && repo ? `Open source repository ${owner}/${repo} hosted on GitHub.` : "GitHub repository.",
      thumbnail,
      metadata: {
        domain: "github.com",
        publishedAt: undefined,
      },
      suggestedTags: ["GitHub", "OpenSource", "Code"],
      suggestedCollectionName: "Useful Tools",
      status: "PARTIAL_CONTENT",
      isLimited: false,
      provenance,
    };
  }
}

export class GenericWebsiteProvider extends BasePlatformProvider {
  platform: Platform = "website";

  detect(): boolean {
    return true; // Fallback
  }

  extractContentId(url: string): string | null {
    return normalizeUrl(url);
  }

  getThumbnail(url: string, contentId?: string | null): string {
    return getDeterministicFallbackImage("website", contentId || url);
  }

  normalizeUrl(url: string): string {
    return normalizeUrl(url);
  }

  async fetchMetadata(url: string, contentId?: string | null): Promise<VerifiedSourceMetadata> {
    const trimmed = url.trim();
    let domain = "website";
    let slug = "";
    try {
      const parsed = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      domain = parsed.hostname.replace(/^www\./, "");
      const segments = parsed.pathname.split("/").filter(Boolean);
      slug = segments[segments.length - 1] || "";
    } catch {
      // fallback
    }

    const title = slug ? formatSlugToTitle(slug) : `Resource from ${domain}`;
    const thumbnail = this.getThumbnail(url, contentId);

    const provenance: Record<string, FieldProvenance> = {
      title: { value: title, source: "url_parse", retrievedAt: new Date().toISOString() },
      creator: { value: domain, source: "domain_extract", retrievedAt: new Date().toISOString() },
      thumbnail: { value: thumbnail, source: "platform_preview", retrievedAt: new Date().toISOString() },
    };

    return {
      contentId: contentId || normalizeUrl(trimmed),
      platform: "website",
      contentType: "article",
      url: trimmed,
      canonicalUrl: trimmed,
      title,
      creator: {
        name: domain,
        handle: domain,
        avatar: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=100&auto=format&fit=crop&q=80",
        verified: false,
      },
      description: `Online article or resource from ${domain}.`,
      thumbnail,
      metadata: {
        domain,
        publishedAt: undefined,
      },
      suggestedTags: [domain.split(".")[0] || "Web", "Article"],
      suggestedCollectionName: "Useful Tools",
      status: slug ? "PARTIAL_CONTENT" : "METADATA_ONLY",
      isLimited: !slug,
      limitedReason: !slug ? "Direct HTML scrape unavailable in client runtime" : undefined,
      provenance,
    };
  }
}

// ---------------------------------------------------------------------------
// Centralized Provider Service Facade
// ---------------------------------------------------------------------------

export class ProviderService {
  private static providers: PlatformProvider[] = [
    new YouTubeProvider(),
    new InstagramProvider(),
    new TikTokProvider(),
    new RedditProvider(),
    new LinkedInProvider(),
    new TwitterProvider(),
    new PinterestProvider(),
    new FacebookProvider(),
    new ThreadsProvider(),
    new GitHubProvider(),
    new GenericWebsiteProvider(), // fallback
  ];

  static getProviders(): PlatformProvider[] {
    return this.providers;
  }

  static getProvider(url: string): PlatformProvider {
    return this.providers.find((p) => p.canHandle(url)) || this.providers[this.providers.length - 1];
  }

  static detectPlatform(url: string): Platform {
    const cleanUrl = url.toLowerCase().trim();
    if (cleanUrl.includes("youtube.com/shorts") || cleanUrl.includes("youtu.be/shorts")) return "youtube-shorts";
    if (cleanUrl.includes("youtube.com") || cleanUrl.includes("youtu.be")) return "youtube";
    if (cleanUrl.includes("instagram.com") || cleanUrl.includes("instagr.am")) return "instagram";
    if (cleanUrl.includes("reddit.com") || cleanUrl.includes("redd.it")) return "reddit";
    if (cleanUrl.includes("linkedin.com")) return "linkedin";
    if (cleanUrl.includes("twitter.com") || cleanUrl.includes("x.com")) return "twitter";
    if (cleanUrl.includes("tiktok.com")) return "tiktok";
    if (cleanUrl.includes("pinterest.com") || cleanUrl.includes("pin.it")) return "pinterest";
    if (cleanUrl.includes("facebook.com") || cleanUrl.includes("fb.watch") || cleanUrl.includes("fb.com")) return "facebook";
    if (cleanUrl.includes("threads.net")) return "threads";
    if (cleanUrl.includes("github.com")) return "github";
    if (cleanUrl.includes("medium.com") || cleanUrl.includes("dev.to") || cleanUrl.includes("substack.com") || cleanUrl.includes("blog")) return "blog";
    return "website";
  }

  static extractYouTubeVideoId(url: string): string | null {
    return extractYouTubeVideoId(url);
  }

  static normalizeUrl(url: string): string {
    const provider = this.getProvider(url);
    return provider.normalizeUrl(url);
  }

  static extractContentId(url: string): string | null {
    const provider = this.getProvider(url);
    return provider.extractContentId(url);
  }

  static getThumbnail(url: string, contentId?: string | null): string {
    const provider = this.getProvider(url);
    return provider.getThumbnail(url, contentId);
  }

  static async fetchMetadata(url: string): Promise<VerifiedSourceMetadata> {
    const provider = this.getProvider(url);
    const contentId = provider.extractContentId(url);
    return await provider.fetchMetadata(url, contentId);
  }

  static async extractContent(url: string): Promise<ExtractedContent> {
    const provider = this.getProvider(url);
    const contentId = provider.extractContentId(url);
    return await provider.extractContent(url, contentId);
  }

  static validateContent(data: ExtractedContent): ContentValidationResult {
    const provider = this.getProvider(data.url);
    return provider.validateContent(data);
  }

  static async extractMetadata(url: string): Promise<VerifiedSourceMetadata> {
    return this.fetchMetadata(url);
  }

  static async getMetadata(url: string): Promise<VerifiedSourceMetadata> {
    return this.fetchMetadata(url);
  }

  static getCanonicalIdentity(url: string): CanonicalIdentity {
    const trimmed = url.trim();
    const platform = this.detectPlatform(trimmed);
    const normalizedUrl = normalizeUrl(trimmed);

    if (platform === "youtube" || platform === "youtube-shorts") {
      const { cleanVideoId, videoId, canonicalUrl } = extractYouTubeDetails(trimmed);
      return {
        platform,
        canonicalId: cleanVideoId || videoId || normalizedUrl,
        canonicalUrl,
        normalizedUrl,
      };
    }

    if (platform === "twitter") {
      const { statusId, canonicalUrl } = extractTwitterDetails(trimmed);
      return {
        platform,
        canonicalId: statusId || normalizedUrl,
        canonicalUrl,
        normalizedUrl,
      };
    }

    if (platform === "instagram") {
      const { code, canonicalUrl } = extractInstagramDetails(trimmed);
      return {
        platform,
        canonicalId: code || normalizedUrl,
        canonicalUrl,
        normalizedUrl,
      };
    }

    if (platform === "reddit") {
      const { postId, canonicalUrl } = extractRedditDetails(trimmed);
      return {
        platform,
        canonicalId: postId || normalizedUrl,
        canonicalUrl,
        normalizedUrl,
      };
    }

    if (platform === "github") {
      const { owner, repo, canonicalUrl } = extractGitHubDetails(trimmed);
      return {
        platform,
        canonicalId: owner && repo ? `${owner}/${repo}`.toLowerCase() : normalizedUrl,
        canonicalUrl,
        normalizedUrl,
      };
    }

    if (platform === "tiktok") {
      const { videoId, canonicalUrl } = extractTikTokDetails(trimmed);
      return {
        platform,
        canonicalId: videoId || normalizedUrl,
        canonicalUrl,
        normalizedUrl,
      };
    }

    if (platform === "pinterest") {
      const { pinId, canonicalUrl } = extractPinterestDetails(trimmed);
      return {
        platform,
        canonicalId: pinId || normalizedUrl,
        canonicalUrl,
        normalizedUrl,
      };
    }

    if (platform === "facebook") {
      const { id, canonicalUrl } = extractFacebookDetails(trimmed);
      return {
        platform,
        canonicalId: id || normalizedUrl,
        canonicalUrl,
        normalizedUrl,
      };
    }

    if (platform === "threads") {
      const { postId, canonicalUrl } = extractThreadsDetails(trimmed);
      return {
        platform,
        canonicalId: postId || normalizedUrl,
        canonicalUrl,
        normalizedUrl,
      };
    }

    return {
      platform,
      canonicalId: normalizedUrl,
      canonicalUrl: trimmed,
      normalizedUrl,
    };
  }
}
