/**
 * Production Reddit Content Provider for Keeper
 *
 * Implements authoritative extraction using official Reddit developer endpoints:
 * 1. Reddit Public Developer .json API with structured User-Agent
 * 2. Reddit Application-Only OAuth API (when client credentials configured)
 * 3. Reddit Official oEmbed API
 * 4. Resilient Canonical URL Fallback
 *
 * Features:
 * - Differentiates content types: Image, Video, Gallery, Text post, Link post, Crosspost
 * - Rate limit handling (HTTP 429, Retry-After header)
 * - Exponential backoff with jitter and circuit-breaker behavior (no retrying 404/deleted/private)
 * - Safe redirect resolution for Reddit share links (/r/.../s/...) and shortlinks (redd.it/...)
 * - Authoritative metadata separation (title, author, subreddit, flair, score, comments, media)
 * - Idempotent text normalization using MetadataNormalizer
 */

import {
  AuthoritativeSourceData,
  Community,
  ContentType,
  Creator,
  FieldProvenance,
  Platform,
} from "@/types";
import { ContentProvider, UrlValidationResult } from "./content-provider.interface";
import { MetadataNormalizer } from "../normalizer/metadata-normalizer";

export interface RedditDetails {
  subreddit: string | null;
  postId: string | null;
  slug: string | null;
  shareId: string | null;
  isShareUrl: boolean;
  canonicalUrl: string;
  normalizedUrl: string;
}

export interface RedditMediaItem {
  url: string;
  type: "image" | "video";
  width?: number;
  height?: number;
}

// Global in-memory cache to prevent redundant API calls
interface CacheEntry {
  data: AuthoritativeSourceData;
  expiresAt: number;
}

const REDDIT_CACHE = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Rate limit state
let rateLimitResetTime = 0;

export class RedditProvider implements ContentProvider {
  readonly platform: Platform = "reddit";

  public static clearCache(): void {
    REDDIT_CACHE.clear();
  }

  private readonly userAgent = "Keeper/1.0.0 (by /u/KeeperAppTeam; content-archiver)";

  canHandle(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    const lower = url.toLowerCase().trim();
    return (
      lower.includes("reddit.com") ||
      lower.includes("redd.it") ||
      lower.includes("reddit.app.link")
    );
  }

  /**
   * Parses Reddit URL variants into structured submission details.
   * Handles:
   * - https://www.reddit.com/r/subreddit/comments/id/slug/
   * - https://reddit.com/r/subreddit/comments/id
   * - https://old.reddit.com/r/subreddit/comments/id/slug/
   * - https://new.reddit.com/...
   * - https://np.reddit.com/...
   * - https://redd.it/id
   * - https://www.reddit.com/comments/id
   * - https://www.reddit.com/r/subreddit/s/shareId (share links)
   */
  extractDetails(url: string): RedditDetails {
    try {
      const trimmed = url.trim();
      const urlObj = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const hostname = urlObj.hostname.toLowerCase().replace(/^(?:www\.|m\.|old\.|new\.|np\.)/, "");
      const pathname = urlObj.pathname;

      // 1. Short domain: redd.it/{id}
      if (hostname === "redd.it") {
        const shortMatch = pathname.match(/^\/([a-zA-Z0-9_\-]+)/);
        if (shortMatch) {
          const postId = shortMatch[1];
          return {
            subreddit: null,
            postId,
            slug: null,
            shareId: null,
            isShareUrl: false,
            canonicalUrl: `https://redd.it/${postId}`,
            normalizedUrl: `redd.it/${postId}`,
          };
        }
      }

      // 2. Share URL: /r/{subreddit}/s/{shareId}
      const shareMatch = pathname.match(/^\/r\/([a-zA-Z0-9_\-]+)\/s\/([a-zA-Z0-9_\-]+)/i);
      if (shareMatch) {
        const subreddit = shareMatch[1];
        const shareId = shareMatch[2];
        return {
          subreddit,
          postId: null,
          slug: null,
          shareId,
          isShareUrl: true,
          canonicalUrl: `https://www.reddit.com/r/${subreddit}/s/${shareId}`,
          normalizedUrl: `reddit.com/r/${subreddit}/s/${shareId}`,
        };
      }

      // 3. Standard post: /r/{subreddit}/comments/{postId}(/{slug})?
      const standardMatch = pathname.match(
        /^\/r\/([a-zA-Z0-9_\-]+)\/comments\/([a-zA-Z0-9_\-]+)(?:\/([a-zA-Z0-9_\-]+))?/i
      );
      if (standardMatch) {
        const subreddit = standardMatch[1];
        const postId = standardMatch[2];
        const slug = standardMatch[3] || null;
        const canonicalUrl = `https://www.reddit.com/r/${subreddit}/comments/${postId}/`;
        const normalizedUrl = `reddit.com/r/${subreddit}/comments/${postId}`;
        return {
          subreddit,
          postId,
          slug,
          shareId: null,
          isShareUrl: false,
          canonicalUrl,
          normalizedUrl,
        };
      }

      // 4. Comments without subreddit: /comments/{postId}
      const directCommentsMatch = pathname.match(/^\/comments\/([a-zA-Z0-9_\-]+)/i);
      if (directCommentsMatch) {
        const postId = directCommentsMatch[1];
        return {
          subreddit: null,
          postId,
          slug: null,
          shareId: null,
          isShareUrl: false,
          canonicalUrl: `https://www.reddit.com/comments/${postId}/`,
          normalizedUrl: `reddit.com/comments/${postId}`,
        };
      }

      // Fallback
      return {
        subreddit: null,
        postId: null,
        slug: null,
        shareId: null,
        isShareUrl: false,
        canonicalUrl: trimmed,
        normalizedUrl: trimmed.replace(/^https?:\/\/(?:www\.)?/, "").replace(/\/+$/, ""),
      };
    } catch {
      return {
        subreddit: null,
        postId: null,
        slug: null,
        shareId: null,
        isShareUrl: false,
        canonicalUrl: url,
        normalizedUrl: url,
      };
    }
  }

  validateAndCanonicalize(url: string): UrlValidationResult {
    const details = this.extractDetails(url);

    // Valid if we have a postId or a share link to resolve
    if (!details.postId && !details.isShareUrl) {
      return {
        isValid: false,
        normalizedUrl: details.normalizedUrl,
        canonicalUrl: details.canonicalUrl,
        contentId: null,
        platform: "reddit",
        contentType: "post",
        error: "Invalid Reddit URL: Could not extract a valid post ID or submission path.",
      };
    }

    return {
      isValid: true,
      normalizedUrl: details.normalizedUrl,
      canonicalUrl: details.canonicalUrl,
      contentId: details.postId || details.shareId,
      platform: "reddit",
      contentType: "post",
    };
  }

  /**
   * Safely resolves redirects for share links (/r/.../s/...) and shortlinks.
   */
  private async resolveRedirect(url: string, signal?: AbortSignal): Promise<RedditDetails> {
    const initial = this.extractDetails(url);
    if (!initial.isShareUrl && initial.postId) {
      return initial;
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(initial.canonicalUrl, {
        method: "GET",
        redirect: "follow",
        headers: {
          "User-Agent": this.userAgent,
          Accept: "text/html,application/xhtml+xml",
        },
        signal: signal || controller.signal,
      });
      clearTimeout(timeout);

      if (res.url && res.url !== initial.canonicalUrl) {
        const resolved = this.extractDetails(res.url);
        if (resolved.postId) {
          return resolved;
        }
      }
    } catch {
      // Fall through to initial details
    }

    return initial;
  }

  /**
   * Helper to fetch application-only OAuth token if credentials are provided in env.
   */
  private async getOAuthToken(signal?: AbortSignal): Promise<string | null> {
    const clientId = typeof process !== "undefined" ? process.env?.REDDIT_CLIENT_ID : undefined;
    const clientSecret = typeof process !== "undefined" ? process.env?.REDDIT_CLIENT_SECRET : undefined;

    if (!clientId || !clientSecret) return null;

    try {
      const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
      const res = await fetch("https://www.reddit.com/api/v1/access_token", {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": this.userAgent,
        },
        body: "grant_type=client_credentials",
        signal,
      });

      if (res.ok) {
        const json = await res.json();
        return json.access_token || null;
      }
    } catch {
      // Fall through
    }

    return null;
  }

  /**
   * Core metadata retrieval with bounded retries, exponential backoff,
   * rate limit handling, and multi-tier fallbacks.
   */
  async fetchAuthoritativeData(
    url: string,
    signal?: AbortSignal
  ): Promise<AuthoritativeSourceData> {
    const now = new Date().toISOString();

    // 1. Resolve redirect if share link
    const details = await this.resolveRedirect(url, signal);
    const { postId, subreddit, canonicalUrl, slug } = details;

    if (!postId && !details.isShareUrl) {
      throw new Error("Invalid Reddit URL: Could not extract a valid post ID.");
    }

    // 2. Check Memory Cache
    const cacheKey = postId ? `reddit_${postId.toLowerCase()}` : `reddit_url_${encodeURIComponent(canonicalUrl.toLowerCase())}`;
    const cached = REDDIT_CACHE.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }

    // Check circuit breaker / rate-limit backoff
    if (Date.now() < rateLimitResetTime) {
      const waitSeconds = Math.ceil((rateLimitResetTime - Date.now()) / 1000);
      console.warn(`[RedditProvider] Currently in rate-limit backoff window (${waitSeconds}s remaining)`);
    }

    const fallbackThumbnail = "";

    const provenance: Record<string, FieldProvenance> = {
      canonicalUrl: { value: canonicalUrl, source: "reddit_canonicalizer", retrievedAt: now },
      contentId: { value: postId || "unknown", source: "reddit_canonicalizer", retrievedAt: now },
    };

    // Strategy 1 & 2: Fetch structured JSON from Reddit API (OAuth or Public Developer endpoint)
    if (postId) {
      let rawPost: any = null;
      let isRateLimited = false;

      // Check for OAuth token
      const oauthToken = await this.getOAuthToken(signal);
      const apiEndpoint = oauthToken
        ? (subreddit
            ? `https://oauth.reddit.com/r/${subreddit}/comments/${postId}?raw_json=1`
            : `https://oauth.reddit.com/comments/${postId}?raw_json=1`)
        : (subreddit
            ? `https://www.reddit.com/r/${subreddit}/comments/${postId}.json?raw_json=1`
            : `https://www.reddit.com/comments/${postId}.json?raw_json=1`);

      const headers: Record<string, string> = {
        "User-Agent": this.userAgent,
        Accept: "application/json",
      };

      if (oauthToken) {
        headers["Authorization"] = `Bearer ${oauthToken}`;
      }

      // Bounded retry with exponential backoff & jitter
      const maxRetries = 2;
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const res = await fetch(apiEndpoint, { headers, signal });

          // Handle Rate Limiting (HTTP 429)
          if (res.status === 429) {
            isRateLimited = true;
            const retryAfterHeader = res.headers.get("retry-after");
            const retrySeconds = retryAfterHeader ? parseInt(retryAfterHeader, 10) : 30;
            rateLimitResetTime = Date.now() + (retrySeconds * 1000);
            break; // Do not hammer on 429
          }

          // Do NOT retry 404 (Not Found) or 403 (Private / Subreddit restricted)
          if (res.status === 404 || res.status === 403) {
            break;
          }

          if (res.ok) {
            const json = await res.json();
            if (Array.isArray(json) && json[0]?.data?.children?.[0]?.data) {
              rawPost = json[0].data.children[0].data;
              break;
            }
          }
        } catch {
          if (attempt < maxRetries) {
            // Exponential backoff + jitter (200ms, 600ms + random 0-100ms)
            const jitter = Math.floor(Math.random() * 100);
            await new Promise((r) => setTimeout(r, 200 * Math.pow(3, attempt) + jitter));
          }
        }
      }

      // If structured data was successfully retrieved:
      if (rawPost && rawPost.title) {
        const result = this.mapPostToSourceData(rawPost, canonicalUrl, now);
        // Cache result
        REDDIT_CACHE.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
        return result;
      }

      // If rate limited, record reason
      if (isRateLimited) {
        provenance.rateLimit = { value: "429 Too Many Requests", source: "reddit_api", retrievedAt: now };
      }
    }

    // Strategy 3: Official Reddit oEmbed API (lightweight, unauthenticated, reliable fallback)
    try {
      const oembedUrl = `https://www.reddit.com/oembed?url=${encodeURIComponent(canonicalUrl)}`;
      const res = await fetch(oembedUrl, {
        headers: { "User-Agent": this.userAgent },
        signal,
      });

      if (res.ok) {
        const oembed = await res.json();
        if (oembed && oembed.title) {
          const title = MetadataNormalizer.normalizeText(oembed.title);
          const authorInfo = MetadataNormalizer.normalizeRedditAuthor(oembed.author_name);
          const cleanSubreddit = (subreddit || "reddit").replace(/^r\//i, "").toLowerCase();

          provenance.title = { value: title, source: "reddit_oembed", retrievedAt: now };
          provenance.creator = { value: authorInfo.displayName, source: "reddit_oembed", retrievedAt: now };
          provenance.community = { value: cleanSubreddit, source: "reddit_oembed", retrievedAt: now };

          const community: Community = {
            id: null,
            name: cleanSubreddit,
            displayName: `r/${cleanSubreddit}`,
            url: `https://www.reddit.com/r/${cleanSubreddit}`,
          };

          const isDeleted = authorInfo.status === "deleted";
          const creator: Creator = {
            id: null,
            username: authorInfo.username,
            displayName: authorInfo.displayName,
            name: authorInfo.displayName,
            status: authorInfo.status,
            handle: undefined,
            profileUrl: authorInfo.username ? `https://www.reddit.com/user/${authorInfo.username}` : null,
            source: "reddit",
            avatar: undefined,
            verified: false,
          };

          const authorText = isDeleted ? "a deleted user" : `u/${authorInfo.username}`;
          const result: AuthoritativeSourceData = {
            platform: "reddit",
            canonicalUrl,
            contentId: postId || "unknown",
            creator,
            community,
            title,
            caption: title,
            description: `Reddit discussion in r/${cleanSubreddit}: "${title}" by ${authorText}.`,
            bodyText: "",
            thumbnailUrl: fallbackThumbnail,
            contentType: "post",
            rawPlatformMetadata: {
              oembedParsed: true,
              oembedTitle: oembed.title,
              subreddit: cleanSubreddit,
              author: authorInfo.username,
            },
            retrievedAt: now,
            isRestricted: isDeleted,
            restrictionReason: isDeleted ? "DELETED" : undefined,
            provenance,
          };

          REDDIT_CACHE.set(cacheKey, { data: result, expiresAt: Date.now() + CACHE_TTL_MS });
          return result;
        }
      }
    } catch {
      // Fall through to honest canonical fallback
    }

    // Strategy 4: Honest Canonical Fallback (NEVER fabricate "Website / Reddit / reddit.com"!)
    let title: string;
    if (slug) {
      title = slug
        .replace(/[-_]+/g, " ")
        .replace(/\.[a-z0-9]+$/i, "")
        .trim()
        .split(" ")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    } else if (subreddit) {
      title = `Discussion on r/${subreddit}`;
    } else if (postId) {
      title = `Reddit Post • ${postId}`;
    } else {
      title = "Reddit Community Discussion";
    }

    const cleanSubreddit = (subreddit || "reddit").replace(/^r\//i, "").toLowerCase();
    provenance.title = { value: title, source: "url_parse", retrievedAt: now };
    provenance.creator = { value: "Reddit User", source: "url_parse", retrievedAt: now };
    provenance.community = { value: cleanSubreddit, source: "url_parse", retrievedAt: now };

    const community: Community = {
      id: null,
      name: cleanSubreddit,
      displayName: `r/${cleanSubreddit}`,
      url: `https://www.reddit.com/r/${cleanSubreddit}`,
    };

    const fallbackResult: AuthoritativeSourceData = {
      platform: "reddit",
      canonicalUrl,
      contentId: postId || "unknown",
      creator: {
        id: null,
        username: null,
        displayName: "Reddit User",
        name: "Reddit User",
        status: "active",
        handle: undefined,
        source: "reddit",
        avatar: undefined,
        verified: false,
      },
      community,
      title,
      caption: title,
      description: `Reddit post in r/${cleanSubreddit} saved to Keeper.`,
      bodyText: "",
      thumbnailUrl: fallbackThumbnail,
      contentType: "post",
      rawPlatformMetadata: {
        fallbackParsed: true,
        subreddit: cleanSubreddit,
        slug,
      },
      retrievedAt: now,
      isRestricted: true,
      restrictionReason: "Reddit API response restricted or rate-limited; verified canonical metadata stored.",
      provenance,
    };

    return fallbackResult;
  }

  /**
   * Determines specific Reddit post type based on Reddit API post fields.
   */
  determinePostType(rawPost: any): {
    contentType: ContentType;
    postType: "text" | "image" | "gallery" | "video" | "link" | "crosspost";
    mediaUrl?: string;
    mediaItems: RedditMediaItem[];
  } {
    let contentType: ContentType = "post";
    let postType: "text" | "image" | "gallery" | "video" | "link" | "crosspost" = "text";
    let mediaUrl: string | undefined = undefined;
    const mediaItems: RedditMediaItem[] = [];

    const isCrosspost = Array.isArray(rawPost.crosspost_parent_list) && rawPost.crosspost_parent_list.length > 0;
    const parentPost = isCrosspost ? rawPost.crosspost_parent_list[0] : null;

    // 1. Check Video on rawPost or parent
    const videoSource = (rawPost.is_video === true || rawPost.domain === "v.redd.it" || rawPost.media?.reddit_video?.fallback_url || rawPost.secure_media?.reddit_video?.fallback_url)
      ? rawPost
      : (parentPost && (parentPost.is_video === true || parentPost.domain === "v.redd.it" || parentPost.media?.reddit_video?.fallback_url || parentPost.secure_media?.reddit_video?.fallback_url) ? parentPost : null);

    if (videoSource) {
      contentType = "video";
      postType = isCrosspost ? "crosspost" : "video";
      mediaUrl = videoSource.secure_media?.reddit_video?.fallback_url || videoSource.media?.reddit_video?.fallback_url;
      if (mediaUrl) {
        mediaItems.push({ url: mediaUrl, type: "video" });
      }
      return { contentType, postType, mediaUrl, mediaItems };
    }

    // 2. Check Gallery on rawPost or parent
    const gallerySource = (rawPost.is_gallery === true || rawPost.gallery_data || rawPost.media_metadata)
      ? rawPost
      : (parentPost && (parentPost.is_gallery === true || parentPost.gallery_data || parentPost.media_metadata) ? parentPost : null);

    if (gallerySource) {
      contentType = "image";
      postType = isCrosspost ? "crosspost" : "gallery";
      if (gallerySource.media_metadata) {
        for (const key of Object.keys(gallerySource.media_metadata)) {
          const item = gallerySource.media_metadata[key];
          const imgUrl = item?.s?.u || item?.s?.gif;
          if (imgUrl) {
            const cleanImgUrl = imgUrl.replace(/&amp;/g, "&");
            mediaItems.push({
              url: cleanImgUrl,
              type: "image",
              width: item?.s?.x,
              height: item?.s?.y,
            });
            if (!mediaUrl) mediaUrl = cleanImgUrl;
          }
        }
      }
      return { contentType, postType, mediaUrl, mediaItems };
    }

    // 3. Check Image on rawPost or parent
    const imageSource = (rawPost.post_hint === "image" || rawPost.domain === "i.redd.it" || /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(rawPost.url || ""))
      ? rawPost
      : (parentPost && (parentPost.post_hint === "image" || parentPost.domain === "i.redd.it" || /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(parentPost.url || "")) ? parentPost : null);

    if (imageSource) {
      contentType = "image";
      postType = isCrosspost ? "crosspost" : "image";
      mediaUrl = imageSource.url;
      if (mediaUrl) {
        mediaItems.push({ url: mediaUrl, type: "image" });
      }
      return { contentType, postType, mediaUrl, mediaItems };
    }

    // 4. Check Outbound Link
    if (rawPost.url && !rawPost.is_self && !rawPost.url.includes("reddit.com")) {
      contentType = "website";
      postType = "link";
      mediaUrl = rawPost.url;
      return { contentType, postType, mediaUrl, mediaItems };
    }

    if (isCrosspost) {
      postType = "crosspost";
      contentType = "post";
      return { contentType, postType, mediaUrl, mediaItems };
    }

    return { contentType, postType, mediaUrl, mediaItems };
  }

  /**
   * Maps an authoritative Reddit API post object into Keeper's AuthoritativeSourceData schema.
   */
  mapPostToSourceData(
    rawPost: any,
    originalUrl: string,
    now: string = new Date().toISOString()
  ): AuthoritativeSourceData {
    const details = this.extractDetails(originalUrl);
    const canonicalUrl = rawPost.permalink
      ? `https://www.reddit.com${rawPost.permalink}`
      : details.canonicalUrl;
    const postId = rawPost.id || details.postId || "unknown";

    // 1. Subreddit & Community Normalization:
    // Extract authoritative subreddit from rawPost or URL details. NEVER infer from domain/reddit.com.
    const rawSub = rawPost.subreddit || details.subreddit || "reddit";
    const canonicalSubreddit = String(rawSub).replace(/^r\//i, "").trim().toLowerCase();

    const community: Community = {
      id: rawPost.subreddit_id || null,
      name: canonicalSubreddit,
      displayName: rawPost.subreddit_name_prefixed || `r/${canonicalSubreddit}`,
      url: `https://www.reddit.com/r/${canonicalSubreddit}`,
    };

    // 2. Author & Creator Normalization:
    // Store canonical username WITHOUT "u/"
    // NEVER infer from subreddit, domain, comment, or AI!
    const authorInfo = MetadataNormalizer.normalizeRedditAuthor(rawPost.author);
    const isAuthorDeleted = authorInfo.status === "deleted";

    const creator: Creator = {
      id: rawPost.author_fullname || null,
      username: authorInfo.username, // Canonical: "Medical-Monk4137" (WITHOUT "u/"), or null if deleted
      displayName: authorInfo.displayName, // "Deleted user" if deleted
      name: authorInfo.displayName,
      status: authorInfo.status,
      handle: undefined, // Defensive: never duplicate handle with username
      profileUrl: authorInfo.username ? `https://www.reddit.com/user/${authorInfo.username}` : null,
      source: "reddit",
      avatar: undefined,
      verified: false,
    };

    // 3. Post Content & Media Extraction:
    const title = MetadataNormalizer.normalizeText(
      rawPost.title || (details.slug ? details.slug.replace(/_/g, " ") : "Reddit Post")
    );
    const bodyText = rawPost.selftext && rawPost.selftext !== "[removed]" && rawPost.selftext !== "[deleted]"
      ? MetadataNormalizer.normalizeText(rawPost.selftext)
      : "";

    const { contentType, postType, mediaUrl, mediaItems } = this.determinePostType(rawPost);

    // Crosspost parent extraction:
    const isCrosspost = Array.isArray(rawPost.crosspost_parent_list) && rawPost.crosspost_parent_list.length > 0;
    const parentPost = isCrosspost ? rawPost.crosspost_parent_list[0] : null;
    let crosspostMeta: any = undefined;

    if (parentPost) {
      const parentAuthorInfo = MetadataNormalizer.normalizeRedditAuthor(parentPost.author);
      const parentSub = String(parentPost.subreddit || "").replace(/^r\//i, "").trim().toLowerCase();
      crosspostMeta = {
        id: parentPost.id,
        title: MetadataNormalizer.normalizeText(parentPost.title || ""),
        subreddit: parentSub,
        creator: {
          id: parentPost.author_fullname || null,
          username: parentAuthorInfo.username,
          displayName: parentAuthorInfo.displayName,
          name: parentAuthorInfo.displayName,
          status: parentAuthorInfo.status,
          profileUrl: parentAuthorInfo.username ? `https://www.reddit.com/user/${parentAuthorInfo.username}` : null,
          source: "reddit",
        },
        permalink: parentPost.permalink ? `https://www.reddit.com${parentPost.permalink}` : undefined,
      };
    }

    // Thumbnail extraction:
    let thumbnailUrl = "";
    if (rawPost.preview?.images?.[0]?.source?.url) {
      thumbnailUrl = rawPost.preview.images[0].source.url.replace(/&amp;/g, "&");
    } else if (rawPost.thumbnail && !["default", "self", "nsfw", "spoiler"].includes(rawPost.thumbnail)) {
      thumbnailUrl = rawPost.thumbnail.replace(/&amp;/g, "&");
    } else if (mediaUrl && (contentType === "image" || postType === "image" || postType === "gallery")) {
      thumbnailUrl = mediaUrl;
    } else if (parentPost) {
      if (parentPost.preview?.images?.[0]?.source?.url) {
        thumbnailUrl = parentPost.preview.images[0].source.url.replace(/&amp;/g, "&");
      } else if (parentPost.thumbnail && !["default", "self", "nsfw", "spoiler"].includes(parentPost.thumbnail)) {
        thumbnailUrl = parentPost.thumbnail.replace(/&amp;/g, "&");
      } else if (parentPost.url && /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(parentPost.url)) {
        thumbnailUrl = parentPost.url;
      }
    }

    if (!thumbnailUrl) {
      thumbnailUrl = "";
    }

    const publishedAt = rawPost.created_utc
      ? new Date(rawPost.created_utc * 1000).toISOString()
      : now;
    const score = rawPost.score !== undefined ? String(rawPost.score) : undefined;
    const commentCount = rawPost.num_comments !== undefined ? String(rawPost.num_comments) : undefined;
    const flair = rawPost.link_flair_text || undefined;

    const isRestricted = isAuthorDeleted || rawPost.selftext === "[removed]" || rawPost.removed_by_category !== undefined;
    const restrictionReason = isRestricted
      ? (isAuthorDeleted ? "DELETED" : "REMOVED")
      : undefined;

    const provenance: Record<string, FieldProvenance> = {
      title: { value: title, source: "reddit_api", retrievedAt: now },
      creator: { value: authorInfo.displayName, source: "reddit_api", retrievedAt: now },
      community: { value: canonicalSubreddit, source: "reddit_api", retrievedAt: now },
      thumbnail: { value: thumbnailUrl, source: "reddit_api", retrievedAt: now },
    };
    if (bodyText) {
      provenance.bodyText = { value: bodyText.slice(0, 200), source: "reddit_api", retrievedAt: now };
    }

    const authorText = isAuthorDeleted ? "a deleted user" : `u/${authorInfo.username}`;
    const description = bodyText
      ? bodyText
      : `Reddit ${postType} in r/${canonicalSubreddit} by ${authorText}${flair ? ` [${flair}]` : ""}.`;

    return {
      platform: "reddit",
      canonicalUrl,
      contentId: postId,
      creator,
      community,
      title,
      caption: bodyText || title,
      description,
      bodyText,
      thumbnailUrl,
      mediaUrl,
      contentType,
      publishedAt,
      likeCount: score,
      commentCount,
      rawPlatformMetadata: {
        ...rawPost,
        postType,
        subreddit: canonicalSubreddit,
        author: authorInfo.username,
        crosspost: crosspostMeta,
        flair,
        mediaItems,
      },
      retrievedAt: now,
      isRestricted,
      restrictionReason,
      provenance,
    };
  }
}
