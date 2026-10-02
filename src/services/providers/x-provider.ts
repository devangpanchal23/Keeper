import {
  AuthoritativeSourceData,
  ContentType,
  Creator,
  FieldProvenance,
  Platform,
} from "@/types";
import { ContentProvider, UrlValidationResult } from "./content-provider.interface";
import { MetadataNormalizer } from "../normalizer/metadata-normalizer";

export interface XDetails {
  statusId: string | null;
  username: string | null;
  canonicalUrl: string;
  isStatusUrl: boolean;
}

export interface XMediaItem {
  type: "video" | "image" | "gif";
  url?: string;
  previewImageUrl?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

export class XProvider implements ContentProvider {
  readonly platform: Platform = "x";

  /**
   * Deterministically identifies if this URL is an X or Twitter URL.
   */
  canHandle(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    return /(?:twitter\.com|x\.com)/i.test(url);
  }

  /**
   * Extracts clean details (username, statusId, canonicalUrl) from any X / Twitter URL.
   */
  extractDetails(url: string): XDetails {
    try {
      const trimmed = url.trim();
      const match = trimmed.match(
        /(?:twitter\.com|x\.com)\/(?:(?:i\/web\/status|i\/status)\/([0-9]+)|([a-zA-Z0-9_]+)\/status\/([0-9]+))/i
      );
      if (match) {
        const statusId = match[1] || match[3] || null;
        const rawUsername = match[2] || null;
        const username = rawUsername ? rawUsername.replace(/^@/, "").trim() : null;
        const canonicalUrl = username
          ? `https://x.com/${username}/status/${statusId}`
          : `https://x.com/i/status/${statusId}`;
        return {
          statusId,
          username,
          canonicalUrl,
          isStatusUrl: true,
        };
      }

      // Check user profile URL (e.g. x.com/Dipanshu_AI)
      const profileMatch = trimmed.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)\/?$/i);
      if (
        profileMatch &&
        !["home", "explore", "notifications", "messages", "search", "i"].includes(
          profileMatch[1].toLowerCase()
        )
      ) {
        const username = profileMatch[1].replace(/^@/, "").trim();
        return {
          statusId: null,
          username,
          canonicalUrl: `https://x.com/${username}`,
          isStatusUrl: false,
        };
      }

      return { statusId: null, username: null, canonicalUrl: trimmed, isStatusUrl: false };
    } catch {
      return { statusId: null, username: null, canonicalUrl: url, isStatusUrl: false };
    }
  }

  /**
   * Validates and canonicalizes the URL.
   */
  validateAndCanonicalize(url: string): UrlValidationResult {
    const details = this.extractDetails(url);

    if (details.statusId) {
      return {
        isValid: true,
        normalizedUrl: details.username
          ? `x.com/${details.username}/status/${details.statusId}`
          : `x.com/i/status/${details.statusId}`,
        canonicalUrl: details.canonicalUrl,
        contentId: details.statusId,
        platform: "x",
        contentType: "post",
      };
    }

    if (details.username) {
      return {
        isValid: true,
        normalizedUrl: `x.com/${details.username}`,
        canonicalUrl: details.canonicalUrl,
        contentId: details.username,
        platform: "x",
        contentType: "post",
      };
    }

    return {
      isValid: false,
      normalizedUrl: url,
      canonicalUrl: url,
      contentId: null,
      platform: "x",
      contentType: "post",
      error: "Invalid X/Twitter URL. Please provide a valid post or profile link.",
    };
  }

  /**
   * Generates a clean display title from post text.
   * X posts do not have native titles; we never fabricate or use 'Author on X'.
   */
  public generateDisplayTitle(
    text?: string | null,
    creatorName?: string,
    creatorUsername?: string
  ): string {
    if (text && text.trim()) {
      // Strip URLs from title headline consideration
      const cleaned = text
        .replace(/https?:\/\/\S+/gi, "")
        .replace(/\s+/g, " ")
        .trim();

      if (cleaned) {
        // Take first sentence or first 85 chars
        const firstSentence = cleaned.split(/(?<=[.?!])\s+/)[0] || cleaned;
        if (firstSentence.length <= 85) {
          return firstSentence;
        }
        return `${firstSentence.slice(0, 82).trim()}...`;
      }
    }

    if (creatorName && creatorUsername && creatorName.toLowerCase() !== creatorUsername.toLowerCase()) {
      return `Post by ${creatorName} (@${creatorUsername})`;
    }
    if (creatorUsername) {
      return `Post by @${creatorUsername}`;
    }
    return "X Post";
  }

  /**
   * Fetches authoritative X data using a resilient multi-tier strategy.
   * NEVER sets creator = "X (formerly Twitter)".
   * Stores canonical username without "@".
   */
  async fetchAuthoritativeData(
    url: string,
    signal?: AbortSignal
  ): Promise<AuthoritativeSourceData> {
    const details = this.extractDetails(url);
    const now = new Date().toISOString();
    const id = details.statusId || details.username || "x_post";
    const canonicalUrl = details.canonicalUrl;

    const provenance: Record<string, FieldProvenance> = {
      canonicalUrl: { value: canonicalUrl, source: "x_canonicalizer", retrievedAt: now },
    };

    // -------------------------------------------------------------------------
    // Strategy 1: Public Embed API (api.fxtwitter.com)
    // Provides rich JSON with video media, real metrics, and author details.
    // -------------------------------------------------------------------------
    if (details.statusId) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        const combinedSignal = signal;

        const fxUrl = `https://api.fxtwitter.com/${details.username || "i"}/status/${details.statusId}`;
        const res = await fetch(fxUrl, {
          signal: combinedSignal || controller.signal,
          headers: {
            "User-Agent": "Keeper/2.0 (Platform Ingestion Metadata Verifier)",
          },
        });
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          if (data && data.tweet) {
            return this.mapFxTweetToSourceData(data.tweet, canonicalUrl, details);
          }
        }
      } catch {
        // Strategy 1 failed or timed out, gracefully continue to Strategy 2
      }
    }

    // -------------------------------------------------------------------------
    // Strategy 2: Official Twitter oEmbed API (publish.twitter.com/oembed)
    // -------------------------------------------------------------------------
    if (details.statusId) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2500);

        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(canonicalUrl)}&omit_script=true`;
        const res = await fetch(oembedUrl, {
          signal: signal || controller.signal,
        });
        clearTimeout(timeout);

        if (res.ok) {
          const json = await res.json();
          const authorName = MetadataNormalizer.normalizeText(json.author_name || "X User");
          let authorUsername = details.username || "";

          if (json.author_url) {
            const urlMatch = json.author_url.match(/(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i);
            if (urlMatch && urlMatch[1]) {
              authorUsername = urlMatch[1].replace(/^@/, "");
            }
          }

          let postText = "";
          let publishedDate: string | undefined = undefined;

          if (json.html) {
            const pMatch = json.html.match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);
            if (pMatch && pMatch[1]) {
              postText = pMatch[1]
                .replace(/<br\s*\/?>/gi, "\n")
                .replace(/<[^>]+>/g, "")
                .trim();
              postText = MetadataNormalizer.normalizeText(postText);
            }

            const dateMatch = json.html.match(/<a\b[^>]*>([A-Za-z]+\s+\d{1,2},\s+\d{4})<\/a>/i);
            if (dateMatch && dateMatch[1]) {
              const d = new Date(dateMatch[1]);
              if (!isNaN(d.getTime())) {
                publishedDate = d.toISOString();
              }
            }

            if (!authorUsername) {
              const handleMatch = json.html.match(/\(@([A-Za-z0-9_]+)\)/i);
              if (handleMatch && handleMatch[1]) {
                authorUsername = handleMatch[1].replace(/^@/, "");
              }
            }
          }

          const cleanUsername = authorUsername || details.username || "x_user";
          const displayTitle = this.generateDisplayTitle(postText, authorName, cleanUsername);

          // Detect video from text cues
          const hasVideoCue = /\b(video|watch|course|lecture|recording)\b/i.test(postText);
          const contentType: ContentType = hasVideoCue ? "video" : "post";

          const creator: Creator = {
            id: null,
            name: authorName,
            username: cleanUsername,
            displayName: authorName,
            handle: `@${cleanUsername}`,
            profileUrl: `https://x.com/${cleanUsername}`,
            avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80",
            verified: false,
            source: "x",
          };

          provenance.title = { value: displayTitle, source: "generated", retrievedAt: now };
          provenance.creator = { value: cleanUsername, source: "twitter_oembed", retrievedAt: now };
          provenance.text = { value: postText.slice(0, 200), source: "twitter_oembed", retrievedAt: now };

          return {
            platform: "x",
            canonicalUrl,
            contentId: details.statusId,
            creator,
            title: displayTitle,
            caption: postText,
            description: postText,
            bodyText: postText,
            thumbnailUrl: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800&auto=format&fit=crop&q=80",
            contentType,
            publishedAt: publishedDate || now,
            rawPlatformMetadata: {
              platformName: "X",
              authorName,
              authorUsername: cleanUsername,
            },
            retrievedAt: now,
            isRestricted: false,
            provenance,
          };
        }
      } catch {
        // Strategy 2 failed, continue to Strategy 3
      }
    }

    // -------------------------------------------------------------------------
    // Strategy 3: HTML Scrape / OpenGraph Parsing with strict regex
    // -------------------------------------------------------------------------
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(canonicalUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        signal: signal || controller.signal,
      });
      clearTimeout(timeout);

      if (res.ok) {
        const html = await res.text();

        // 1. Author & Username regex extraction
        // Match: "Dipanshu Kushwaha (@Dipanshu_AI) on X"
        let authorName = "";
        let authorUsername = details.username || "";

        const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const titleContent = titleTagMatch ? titleTagMatch[1].trim() : "";

        const authorTitleRegex = /^(.*?)\s*\(@([a-zA-Z0-9_]+)\)\s+(?:on\s+X|on\s+Twitter|\/\s*X)/i;
        const authorMatch = titleContent.match(authorTitleRegex);

        if (authorMatch) {
          authorName = MetadataNormalizer.normalizeText(authorMatch[1]);
          authorUsername = authorMatch[2].replace(/^@/, "").trim();
        } else {
          // Check og:title e.g. "Dipanshu Kushwaha on X: ..."
          const ogTitleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
          if (ogTitleMatch) {
            const ogMatch = ogTitleMatch[1].match(/^(.*?)\s+on\s+X:\s*["“](.*?)["”]?/i);
            if (ogMatch) {
              authorName = MetadataNormalizer.normalizeText(ogMatch[1]);
            }
          }
        }

        // Prevent platform name from ever becoming creator name
        if (
          !authorName ||
          authorName.toLowerCase().includes("twitter") ||
          authorName.toLowerCase() === "x" ||
          authorName === "x.com"
        ) {
          authorName = details.username || "X User";
        }

        const cleanUsername = authorUsername || details.username || "x_user";

        // 2. Post Text Extraction from description
        const descMatch =
          html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
          html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        const postText = descMatch ? MetadataNormalizer.normalizeText(descMatch[1]) : "";

        // 3. Media & ContentType
        const isVideo = html.includes("twitter:player") || html.includes("og:video") || /\b(video|watch)\b/i.test(postText);
        const contentType: ContentType = isVideo ? "video" : "post";

        const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        const thumbnailUrl = imgMatch
          ? imgMatch[1].replace(/&amp;/g, "&")
          : "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800&auto=format&fit=crop&q=80";

        const displayTitle = this.generateDisplayTitle(postText, authorName, cleanUsername);

        const creator: Creator = {
          id: null,
          name: authorName,
          username: cleanUsername,
          displayName: authorName,
          handle: `@${cleanUsername}`,
          profileUrl: `https://x.com/${cleanUsername}`,
          avatar: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100&auto=format&fit=crop&q=80",
          verified: false,
          source: "x",
        };

        provenance.title = { value: displayTitle, source: "generated", retrievedAt: now };
        provenance.creator = { value: cleanUsername, source: "html_metadata", retrievedAt: now };
        provenance.text = { value: postText.slice(0, 200), source: "html_metadata", retrievedAt: now };

        return {
          platform: "x",
          canonicalUrl,
          contentId: id,
          creator,
          title: displayTitle,
          caption: postText,
          description: postText,
          bodyText: postText,
          thumbnailUrl,
          contentType,
          publishedAt: now,
          rawPlatformMetadata: {
            platformName: "X",
            authorName,
            authorUsername: cleanUsername,
          },
          retrievedAt: now,
          isRestricted: false,
          provenance,
        };
      }
    } catch {
      // Continue to Strategy 4
    }

    // -------------------------------------------------------------------------
    // Strategy 4: Fallback
    // -------------------------------------------------------------------------
    const cleanUsername = details.username || "x_user";
    const authorName = details.username || "X User";
    const displayTitle = `Post by @${cleanUsername}`;

    provenance.title = { value: displayTitle, source: "generated", retrievedAt: now };
    provenance.creator = { value: cleanUsername, source: "url_parse", retrievedAt: now };

    return {
      platform: "x",
      canonicalUrl,
      contentId: id,
      creator: {
        id: null,
        name: authorName,
        username: cleanUsername,
        displayName: authorName,
        handle: `@${cleanUsername}`,
        profileUrl: `https://x.com/${cleanUsername}`,
        source: "x",
        verified: false,
      },
      title: displayTitle,
      caption: "",
      description: `X post by @${cleanUsername}.`,
      bodyText: "",
      thumbnailUrl: "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800&auto=format&fit=crop&q=80",
      contentType: "post",
      publishedAt: now,
      rawPlatformMetadata: {
        platformName: "X",
        authorUsername: cleanUsername,
        fallbackParsed: true,
      },
      retrievedAt: now,
      isRestricted: true,
      restrictionReason: "X post details could not be retrieved from public endpoints; canonical identity saved.",
      provenance,
    };
  }

  /**
   * Deterministically maps a tweet payload to AuthoritativeSourceData.
   * Authoritative creator, canonical username without '@', media extraction,
   * numeric engagement metrics, quoted post author isolation, and clean display title.
   */
  public mapFxTweetToSourceData(
    tweet: any,
    canonicalUrl: string,
    details?: XDetails
  ): AuthoritativeSourceData {
    const now = new Date().toISOString();
    const id = tweet.id || details?.statusId || "x_post";
    const provenance: Record<string, FieldProvenance> = {
      canonicalUrl: { value: canonicalUrl, source: "x_canonicalizer", retrievedAt: now },
    };

    // 1. Authoritative Creator
    const rawAuthorName = tweet.author?.name || details?.username || "X User";
    const authorName = MetadataNormalizer.normalizeText(rawAuthorName);
    const rawUsername = tweet.author?.screen_name || details?.username || "x_user";
    const cleanUsername = rawUsername.replace(/^@/, "").trim();

    const creator: Creator = {
      id: tweet.author?.id ? String(tweet.author.id) : null,
      name: authorName,
      username: cleanUsername, // Canonical: NO "@"
      displayName: authorName,
      handle: `@${cleanUsername}`,
      profileUrl: `https://x.com/${cleanUsername}`,
      avatar: tweet.author?.avatar_url || undefined,
      verified: Boolean(tweet.author?.verified),
      source: "x",
    };

    // 2. Post Text & Encoding
    const postText = MetadataNormalizer.normalizeText(tweet.text || "");

    // 3. Media & ContentType
    let contentType: ContentType = "post";
    let thumbnailUrl = "https://images.unsplash.com/photo-1611605698335-8b1569810432?w=800&auto=format&fit=crop&q=80";
    let mediaUrl: string | undefined = undefined;
    const mediaItems: XMediaItem[] = [];

    if (tweet.media?.videos && tweet.media.videos.length > 0) {
      contentType = "video";
      const v = tweet.media.videos[0];
      mediaUrl = v.url;
      thumbnailUrl = v.thumbnail_url || thumbnailUrl;
      for (const vid of tweet.media.videos) {
        mediaItems.push({
          type: "video",
          url: vid.url,
          previewImageUrl: vid.thumbnail_url,
          durationMs: vid.durationMs,
        });
      }
    } else if (tweet.media?.photos && tweet.media.photos.length > 0) {
      contentType = "image";
      thumbnailUrl = tweet.media.photos[0].url;
      for (const p of tweet.media.photos) {
        mediaItems.push({
          type: "image",
          url: p.url,
          width: p.width,
          height: p.height,
        });
      }
    } else if (tweet.media?.all && tweet.media.all.some((m: any) => m.type === "gif")) {
      contentType = "image";
      const g = tweet.media.all.find((m: any) => m.type === "gif");
      if (g?.thumbnail_url) thumbnailUrl = g.thumbnail_url;
      mediaItems.push({
        type: "gif",
        url: g?.url,
        previewImageUrl: g?.thumbnail_url,
      });
    }

    // 4. Clean Display Title
    const displayTitle = this.generateDisplayTitle(postText, authorName, cleanUsername);

    // 5. Engagement Metrics (Store as stringified numbers without 'K' or 'M')
    const likeCount = tweet.likes !== undefined ? String(tweet.likes) : undefined;
    const commentCount = tweet.replies !== undefined ? String(tweet.replies) : undefined;
    const viewCount = tweet.views !== undefined ? String(tweet.views) : undefined;

    provenance.title = { value: displayTitle, source: "generated", retrievedAt: now };
    provenance.creator = { value: cleanUsername, source: "x_api", retrievedAt: now };
    provenance.text = { value: postText.slice(0, 200), source: "x_api", retrievedAt: now };

    return {
      platform: "x",
      canonicalUrl: tweet.url || canonicalUrl,
      contentId: id,
      creator,
      title: displayTitle,
      caption: postText,
      description: postText,
      bodyText: postText,
      thumbnailUrl,
      mediaUrl,
      contentType,
      publishedAt: tweet.created_at ? new Date(tweet.created_at).toISOString() : now,
      likeCount,
      commentCount,
      viewCount,
      rawPlatformMetadata: {
        platformName: "X",
        id: tweet.id,
        language: tweet.lang,
        repostCount: tweet.retweets,
        bookmarkCount: tweet.bookmarks,
        quoteCount: tweet.quotes,
        quotedPost: tweet.quote
          ? {
              id: tweet.quote.id,
              text: tweet.quote.text,
              creator: {
                name: tweet.quote.author?.name,
                username: (tweet.quote.author?.screen_name || "").replace(/^@/, ""),
              },
            }
          : undefined,
        mediaItems,
      },
      retrievedAt: now,
      isRestricted: false,
      provenance,
    };
  }
}
