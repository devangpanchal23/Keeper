import {
  AuthoritativeSourceData,
  ContentType,
  Creator,
  FieldProvenance,
  Platform,
} from "@/types";
import { ContentProvider, UrlValidationResult } from "./content-provider.interface";
import { MetadataNormalizer } from "../normalizer/metadata-normalizer";
import {
  InstagramThumbnailResolver,
} from "../media/instagram-thumbnail-resolver";
import {
  INSTAGRAM_REEL_PLACEHOLDER,
  INSTAGRAM_POST_PLACEHOLDER,
} from "../media/instagram-placeholders";

export class InstagramProvider implements ContentProvider {
  readonly platform: Platform = "instagram";

  canHandle(url: string): boolean {
    if (!url || typeof url !== "string") return false;
    const lower = url.toLowerCase().trim();
    return lower.includes("instagram.com") || lower.includes("instagr.am");
  }

  /**
   * Extracts clean shortcode, username if present in path, and content type.
   */
  extractDetails(url: string): {
    code: string | null;
    username: string | null;
    isReel: boolean;
    canonicalUrl: string;
    normalizedUrl: string;
  } {
    try {
      const trimmed = url.trim();
      const isReel = /instagram\.com\/(?:reel|reels)\//i.test(trimmed);

      // Check for username in URL path: instagram.com/username/(p|reel)/code
      const userPathMatch = trimmed.match(
        /instagram\.com\/([a-zA-Z0-9_\.]+)\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_\-]+)/i
      );
      if (userPathMatch) {
        const username = userPathMatch[1];
        const code = userPathMatch[2];
        const canonicalUrl = isReel
          ? `https://www.instagram.com/reel/${code}/`
          : `https://www.instagram.com/p/${code}/`;
        const normalizedUrl = isReel
          ? `instagram.com/reel/${code}`
          : `instagram.com/p/${code}`;
        return { code, username, isReel, canonicalUrl, normalizedUrl };
      }

      // Check for shortcode: instagram.com/(reel|reels|p|tv)/code
      const codeMatch = trimmed.match(
        /instagram\.com\/(?:reel|reels|p|tv)\/([a-zA-Z0-9_\-]+)/i
      );
      if (codeMatch && codeMatch[1]) {
        const code = codeMatch[1].split(/[?#&]/)[0];
        const canonicalUrl = isReel
          ? `https://www.instagram.com/reel/${code}/`
          : `https://www.instagram.com/p/${code}/`;
        const normalizedUrl = isReel
          ? `instagram.com/reel/${code}`
          : `instagram.com/p/${code}`;
        return { code, username: null, isReel, canonicalUrl, normalizedUrl };
      }

      // Short domain: instagr.am/p/code
      const shortDomainMatch = trimmed.match(/instagr\.am\/p\/([a-zA-Z0-9_\-]+)/i);
      if (shortDomainMatch && shortDomainMatch[1]) {
        const code = shortDomainMatch[1].split(/[?#&]/)[0];
        return {
          code,
          username: null,
          isReel: false,
          canonicalUrl: `https://www.instagram.com/p/${code}/`,
          normalizedUrl: `instagram.com/p/${code}`,
        };
      }

      return {
        code: null,
        username: null,
        isReel,
        canonicalUrl: trimmed,
        normalizedUrl: trimmed.replace(/^https?:\/\/(?:www\.)?/, "").replace(/\/+$/, ""),
      };
    } catch {
      return {
        code: null,
        username: null,
        isReel: false,
        canonicalUrl: url,
        normalizedUrl: url,
      };
    }
  }

  validateAndCanonicalize(url: string): UrlValidationResult {
    const details = this.extractDetails(url);
    const contentType: ContentType = details.isReel ? "reel" : "post";

    if (!details.code) {
      return {
        isValid: false,
        normalizedUrl: details.normalizedUrl,
        canonicalUrl: details.canonicalUrl,
        contentId: null,
        platform: "instagram",
        contentType,
        error: "Invalid Instagram URL: Could not extract a valid Reel or Post shortcode.",
      };
    }

    return {
      isValid: true,
      normalizedUrl: details.normalizedUrl,
      canonicalUrl: details.canonicalUrl,
      contentId: details.code,
      platform: "instagram",
      contentType,
    };
  }

  /**
   * Validates if a discovered thumbnail string is an authentic, non-generic image URL or path.
   */
  public isValidThumbnailUrl(url: string | undefined | null): boolean {
    return InstagramThumbnailResolver.isAuthenticMediaUrl(url);
  }

  /**
   * Clearly generic Instagram placeholder when authentic thumbnail cannot be obtained.
   * NEVER returns misleading stock photography (no laptops, offices, or Matrix code)!
   */
  public getFallbackThumbnail(isReel: boolean, _code?: string): string {
    return isReel ? INSTAGRAM_REEL_PLACEHOLDER : INSTAGRAM_POST_PLACEHOLDER;
  }

  /**
   * Helper to parse Instagram captioned embed HTML.
   */
  private parseEmbedHtml(html: string, code: string): {
    username?: string;
    caption?: string;
    avatarUrl?: string;
    thumbnailUrl?: string;
    likes?: string;
    comments?: string;
  } {
    const result: {
      username?: string;
      caption?: string;
      avatarUrl?: string;
      thumbnailUrl?: string;
      likes?: string;
      comments?: string;
    } = {};

    // 1. Extract username: <a class="CaptionUsername" ...>username</a> or <div class="Username"><a ...>username</a>
    const usernameMatch =
      html.match(/class=["']CaptionUsername["'][^>]*>([^<]+)<\/a>/i) ||
      html.match(/class=["']UsernameText["'][^>]*>([^<]+)<\/span>/i) ||
      html.match(/class=["']Username["'][^>]*><a[^>]*>([^<]+)<\/a>/i) ||
      html.match(/href=["']\/([a-zA-Z0-9_\.]+)\/["']\s+class=["'][^"']*Username/i);
    if (usernameMatch && usernameMatch[1]) {
      result.username = MetadataNormalizer.normalizeText(usernameMatch[1]).replace(/^@/, "");
    }

    // 2. Extract avatar URL: <div class="Avatar"><img src="..."/>
    const avatarMatch =
      html.match(/class=["']Avatar["'][^>]*><img[^>]+src=["']([^"']+)["']/i) ||
      html.match(/class=["']AvatarImage["'][^>]+src=["']([^"']+)["']/i);
    if (avatarMatch && avatarMatch[1]) {
      result.avatarUrl = avatarMatch[1].replace(/&amp;/g, "&");
    }

    // 3. Extract thumbnail:
    // Pattern 3a: EmbeddedMediaImage with class before or after src
    const classFirstMatch = html.match(/<img[^>]*class=["'][^"']*EmbeddedMediaImage[^"']*["'][^>]*src=["']([^"']+)["']/i);
    const srcFirstMatch = html.match(/<img[^>]*src=["']([^"']+)["'][^>]*class=["'][^"']*EmbeddedMediaImage[^"']*["']/i);
    const embeddedMediaWrapper = html.match(/class=["']EmbeddedMedia["'][^>]*>[\s\S]*?<img[^>]*src=["']([^"']+)["']/i);

    // Pattern 3b: srcset candidate with largest resolution
    let srcsetThumb: string | undefined;
    const srcsetMatch =
      html.match(/class=["'][^"']*EmbeddedMediaImage[^"']*["'][^>]*srcset=["']([^"']+)["']/i) ||
      html.match(/srcset=["']([^"']+)["'][^>]*class=["'][^"']*EmbeddedMediaImage[^"']*["']/i);
    if (srcsetMatch && srcsetMatch[1]) {
      const candidates = srcsetMatch[1].split(",").map((s) => s.trim().split(" ")[0]).filter(Boolean);
      if (candidates.length > 0) {
        srcsetThumb = candidates[candidates.length - 1];
      }
    }

    // Pattern 3c: JSON in script tags (display_url, thumbnail_src)
    let jsonThumb: string | undefined;
    const displayUrlMatch =
      html.match(/"display_url"\s*:\s*"([^"]+)"/i) ||
      html.match(/"thumbnail_src"\s*:\s*"([^"]+)"/i) ||
      html.match(/"display_resources"\s*:\s*\[[\s\S]*?"src"\s*:\s*"([^"]+)"/i);
    if (displayUrlMatch && displayUrlMatch[1]) {
      jsonThumb = displayUrlMatch[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
    }

    // Pattern 3d: OpenGraph meta tags in embed HTML
    let ogThumb: string | undefined;
    const ogImgMatch =
      html.match(/<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    if (ogImgMatch && ogImgMatch[1]) {
      ogThumb = ogImgMatch[1].replace(/&amp;/g, "&");
    }

    const rawThumb = classFirstMatch?.[1] || srcFirstMatch?.[1] || srcsetThumb || jsonThumb || ogThumb || embeddedMediaWrapper?.[1];
    if (rawThumb && this.isValidThumbnailUrl(rawThumb)) {
      result.thumbnailUrl = rawThumb.replace(/&amp;/g, "&");
    }

    // 4. Extract Caption text: <div class="Caption">...</div>
    const captionMatch = html.match(/<div class=["']Caption["']>([\s\S]*?)<\/div>/i);
    if (captionMatch && captionMatch[1]) {
      // Decode all HTML entities (hex, dec, named) and normalize text
      const cleanCaption = MetadataNormalizer.normalizeText(captionMatch[1]);

      // If caption starts with the username, remove it
      if (result.username && cleanCaption.startsWith(result.username)) {
        result.caption = cleanCaption.slice(result.username.length).trim();
      } else {
        result.caption = cleanCaption;
      }
    }

    return result;
  }

  /**
   * Helper to parse OpenGraph meta tags from Instagram HTML.
   */
  private parseOpenGraph(html: string): {
    ogTitle?: string;
    ogDescription?: string;
    ogImage?: string;
    parsedCreator?: string;
    parsedHandle?: string;
    parsedCaption?: string;
    likes?: string;
    comments?: string;
    publishedDate?: string;
  } {
    const titleMatch =
      html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
    const descMatch =
      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
    const imageMatch =
      html.match(/<meta[^>]*property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i) ||
      html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i) ||
      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);

    let jsonImage: string | undefined;
    const jsonMatch =
      html.match(/"display_url"\s*:\s*"([^"]+)"/i) ||
      html.match(/"thumbnail_src"\s*:\s*"([^"]+)"/i);
    if (jsonMatch && jsonMatch[1]) {
      jsonImage = jsonMatch[1].replace(/\\u0026/g, "&").replace(/\\\//g, "/");
    }

    const ogTitle = titleMatch ? MetadataNormalizer.normalizeText(titleMatch[1]) : undefined;
    const ogDescription = descMatch ? MetadataNormalizer.normalizeText(descMatch[1]) : undefined;
    const rawOgImage = (imageMatch ? imageMatch[1].replace(/&amp;/g, "&") : undefined) || jsonImage;
    const ogImage = rawOgImage && this.isValidThumbnailUrl(rawOgImage) ? rawOgImage : undefined;

    let parsedCreator: string | undefined;
    let parsedHandle: string | undefined;
    let parsedCaption: string | undefined;
    let likes: string | undefined;
    let comments: string | undefined;
    let publishedDate: string | undefined;

    // Pattern A: "Name (@handle) on Instagram: "Caption text...""
    if (ogTitle) {
      const titleWithHandle = ogTitle.match(/^(.*?)\s+\(@([a-zA-Z0-9_\.]+)\)\s+on Instagram:\s*["“]([\s\S]*?)["”]?$/);
      if (titleWithHandle) {
        parsedCreator = MetadataNormalizer.normalizeText(titleWithHandle[1]);
        parsedHandle = `@${titleWithHandle[2].trim()}`;
        parsedCaption = MetadataNormalizer.normalizeText(titleWithHandle[3]);
      } else {
        const titleWithoutHandle = ogTitle.match(/^(.*?)\s+on Instagram:\s*["“]([\s\S]*?)["”]?$/);
        if (titleWithoutHandle) {
          parsedCreator = MetadataNormalizer.normalizeText(titleWithoutHandle[1]);
          parsedCaption = MetadataNormalizer.normalizeText(titleWithoutHandle[2]);
        }
      }
    }

    // Pattern B: "X likes, Y comments - Author on Month DD, YYYY: "Caption""
    if (ogDescription) {
      const descStats = ogDescription.match(
        /^([0-9,KMkm\.\+]+)\s+likes?,\s+([0-9,KMkm\.\+]+)\s+comments?\s+-\s+(.*?)\s+on\s+([A-Za-z]+ \d+, \d{4}):\s*["“]?([\s\S]*?)["”]?$/
      );
      if (descStats) {
        likes = descStats[1];
        comments = descStats[2];
        if (!parsedCreator) parsedCreator = MetadataNormalizer.normalizeText(descStats[3]);
        publishedDate = descStats[4];
        if (!parsedCaption && descStats[5]) {
          parsedCaption = MetadataNormalizer.normalizeText(descStats[5]);
        }
      }
    }

    return {
      ogTitle,
      ogDescription,
      ogImage,
      parsedCreator,
      parsedHandle,
      parsedCaption,
      likes,
      comments,
      publishedDate,
    };
  }

  async fetchAuthoritativeData(
    url: string,
    signal?: AbortSignal
  ): Promise<AuthoritativeSourceData> {
    const validation = this.validateAndCanonicalize(url);
    if (!validation.isValid || !validation.contentId) {
      throw new Error(validation.error || "Invalid Instagram URL");
    }

    const code = validation.contentId;
    const details = this.extractDetails(url);
    const isReel = validation.contentType === "reel";
    const canonicalUrl = validation.canonicalUrl;
    const now = new Date().toISOString();

    const fallbackThumbnail = this.getFallbackThumbnail(isReel, code);

    const provenance: Record<string, FieldProvenance> = {
      canonicalUrl: { value: canonicalUrl, source: "instagram_canonicalizer", retrievedAt: now },
      contentId: { value: code, source: "instagram_canonicalizer", retrievedAt: now },
    };

    // Strategy 1: Meta Official oEmbed API (if access token configured in server env)
    const oembedToken =
      typeof process !== "undefined"
        ? process.env?.INSTAGRAM_OEMBED_TOKEN || process.env?.META_APP_ACCESS_TOKEN
        : undefined;

    if (oembedToken) {
      try {
        const oembedEndpoint = `https://graph.facebook.com/v19.0/instagram_oembed?url=${encodeURIComponent(
          canonicalUrl
        )}&access_token=${oembedToken}`;
        const res = await fetch(oembedEndpoint, { signal });
        if (res.ok) {
          const data = await res.json();
          const authorName = MetadataNormalizer.normalizeText(data.author_name || details.username || "Instagram Creator");
          const caption = MetadataNormalizer.normalizeText(data.title || "");
          const hasAuthenticThumb = this.isValidThumbnailUrl(data.thumbnail_url);
          const thumbnail = hasAuthenticThumb ? data.thumbnail_url : fallbackThumbnail;
          const authorDisplay = authorName ? (authorName.startsWith("@") ? authorName : `@${authorName}`) : "@instagram_creator";
          const title = MetadataNormalizer.deriveDisplayTitleFromCaption(
            caption,
            authorDisplay,
            "Instagram",
            isReel ? "Reel" : "Post"
          );

          provenance.title = { value: title, source: "instagram_oembed", retrievedAt: now };
          provenance.creator = { value: authorDisplay, source: "instagram_oembed", retrievedAt: now };
          provenance.thumbnail = {
            value: thumbnail,
            source: hasAuthenticThumb ? "instagram_oembed" : "fallback_preview",
            retrievedAt: now,
          };
          provenance.caption = { value: caption, source: "instagram_oembed", retrievedAt: now };

          const creator: Creator = {
            name: authorDisplay,
            handle: authorDisplay,
            verified: true,
          };

          return {
            platform: "instagram",
            canonicalUrl,
            contentId: code,
            creator,
            title,
            caption: caption || undefined,
            description: caption || `Instagram ${isReel ? "Reel" : "Post"} by ${authorDisplay}`,
            bodyText: caption,
            thumbnailUrl: thumbnail,
            contentType: validation.contentType,
            rawPlatformMetadata: data,
            retrievedAt: now,
            isRestricted: false,
            provenance,
          };
        }
      } catch {
        // Fall through to embed/html parsing
      }
    }

    // Strategy 2: Captioned Embed Page Parsing (Server-side fetch with browser headers)
    try {
      const embedUrl = isReel
        ? `https://www.instagram.com/reel/${code}/embed/captioned/`
        : `https://www.instagram.com/p/${code}/embed/captioned/`;
      const res = await fetch(embedUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.9",
        },
        signal,
      });

      if (res.ok) {
        const html = await res.text();

        // Phase 6 Audit: If Instagram responds with login page, challenge page, consent page,
        // or authentication requirement, DO NOT parse arbitrary images.
        const isLoginOrRestricted =
          html.includes('action="/accounts/login') ||
          html.includes('class="login-container"') ||
          html.includes("challenge_required") ||
          html.includes("consent_page") ||
          html.includes("Log In • Instagram") ||
          html.includes("Login • Instagram");

        if (!isLoginOrRestricted) {
          const parsed = this.parseEmbedHtml(html, code);

        const rawUsername = parsed.username || details.username;
        const username = rawUsername ? MetadataNormalizer.normalizeText(rawUsername) : undefined;
        const caption = parsed.caption ? MetadataNormalizer.normalizeText(parsed.caption) : undefined;
        const hasAuthenticThumb = this.isValidThumbnailUrl(parsed.thumbnailUrl);
        const thumbnail = hasAuthenticThumb ? parsed.thumbnailUrl! : fallbackThumbnail;
        const avatar = parsed.avatarUrl;

        if (username || caption || hasAuthenticThumb) {
          const authorDisplay = username ? `@${username.replace(/^@/, "")}` : "Instagram Creator";
          const title = MetadataNormalizer.deriveDisplayTitleFromCaption(
            caption || "",
            authorDisplay,
            "Instagram",
            isReel ? "Reel" : "Post"
          );

          provenance.title = { value: title, source: "instagram_embed", retrievedAt: now };
          provenance.creator = { value: authorDisplay, source: "instagram_embed", retrievedAt: now };
          provenance.thumbnail = {
            value: thumbnail,
            source: hasAuthenticThumb ? "instagram_embed" : "fallback_preview",
            retrievedAt: now,
          };
          if (caption) {
            provenance.caption = { value: caption, source: "instagram_embed", retrievedAt: now };
          }

          const creator: Creator = {
            name: authorDisplay,
            handle: username ? `@${username.replace(/^@/, "")}` : undefined,
            avatar,
            verified: false,
          };

          return {
            platform: "instagram",
            canonicalUrl,
            contentId: code,
            creator,
            title,
            caption: caption || undefined,
            description: caption || `Instagram ${isReel ? "Reel" : "Post"} by ${authorDisplay}.`,
            bodyText: caption || "",
            thumbnailUrl: thumbnail,
            contentType: validation.contentType,
            rawPlatformMetadata: { embedParsed: true, username, likes: parsed.likes },
            retrievedAt: now,
            isRestricted: false,
            provenance,
          };
        }
      }
    }
  } catch {
      // Fall through to OpenGraph / fallback
    }

    // Strategy 3: OpenGraph direct scraping (Server-side fetch with browser headers)
    try {
      const postUrl = isReel
        ? `https://www.instagram.com/reel/${code}/`
        : `https://www.instagram.com/p/${code}/`;
      const res = await fetch(postUrl, {
        headers: {
          "User-Agent":
            "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal,
      });

      if (res.ok) {
        const html = await res.text();

        const isLoginOrRestricted =
          html.includes('action="/accounts/login') ||
          html.includes("Log In • Instagram") ||
          html.includes("Login • Instagram") ||
          html.includes("challenge_required");

        if (!isLoginOrRestricted) {
          const og = this.parseOpenGraph(html);

          const rawUsername = og.parsedHandle ? og.parsedHandle.replace(/^@/, "") : (og.parsedCreator || details.username);
          const username = rawUsername ? MetadataNormalizer.normalizeText(rawUsername) : undefined;
          const caption = og.parsedCaption ? MetadataNormalizer.normalizeText(og.parsedCaption) : undefined;
          const hasAuthenticThumb = this.isValidThumbnailUrl(og.ogImage);
          const thumbnail = hasAuthenticThumb ? og.ogImage! : fallbackThumbnail;

          if (username || caption || hasAuthenticThumb) {
          const authorDisplay = username ? `@${username.replace(/^@/, "")}` : "Instagram Creator";
          const title = MetadataNormalizer.deriveDisplayTitleFromCaption(
            caption || "",
            authorDisplay,
            "Instagram",
            isReel ? "Reel" : "Post"
          );

          provenance.title = { value: title, source: "instagram_opengraph", retrievedAt: now };
          provenance.creator = { value: authorDisplay, source: "instagram_opengraph", retrievedAt: now };
          provenance.thumbnail = {
            value: thumbnail,
            source: hasAuthenticThumb ? "instagram_opengraph" : "fallback_preview",
            retrievedAt: now,
          };
          if (caption) {
            provenance.caption = { value: caption, source: "instagram_opengraph", retrievedAt: now };
          }

          const creator: Creator = {
            name: authorDisplay,
            handle: og.parsedHandle || (username ? `@${username.replace(/^@/, "")}` : undefined),
            verified: false,
          };

          return {
            platform: "instagram",
            canonicalUrl,
            contentId: code,
            creator,
            title,
            caption: caption || undefined,
            description: caption || og.ogDescription || `Instagram ${isReel ? "Reel" : "Post"} (${code}).`,
            bodyText: caption || "",
            thumbnailUrl: thumbnail,
            contentType: validation.contentType,
            likeCount: og.likes,
            commentCount: og.comments,
            publishedAt: og.publishedDate,
            rawPlatformMetadata: { ogParsed: true, ogTitle: og.ogTitle },
            retrievedAt: now,
            isRestricted: false,
            provenance,
          };
        }
      }
    }
  } catch {
      // Fall through to fallback
    }

    // Strategy 4: Honest restricted-mode fallback when Instagram restricts guest access
    // NEVER invent fake usernames or fake handles!
    const verifiedUsername = details.username;
    const authorName = verifiedUsername ? `@${verifiedUsername}` : "Instagram Creator";
    const title = verifiedUsername
      ? `Instagram ${isReel ? "Reel" : "Post"} by @${verifiedUsername}`
      : `Instagram ${isReel ? "Reel" : "Post"} • ${code}`;

    provenance.title = { value: title, source: "url_parse", retrievedAt: now };
    provenance.creator = {
      value: authorName,
      source: verifiedUsername ? "url_parse" : "restricted_platform",
      retrievedAt: now,
    };
    provenance.thumbnail = { value: fallbackThumbnail, source: "fallback_preview", retrievedAt: now };

    return {
      platform: "instagram",
      canonicalUrl,
      contentId: code,
      creator: {
        name: authorName,
        handle: verifiedUsername ? `@${verifiedUsername}` : undefined,
        verified: false,
      },
      title,
      caption: undefined,
      description: `Instagram ${isReel ? "Reel" : "Post"} (${code}) saved to Keeper.`,
      bodyText: "",
      thumbnailUrl: fallbackThumbnail,
      contentType: validation.contentType,
      retrievedAt: now,
      isRestricted: true,
      restrictionReason:
        "Instagram restricted public guest access for this media; full caption and audio transcript require authentication.",
      provenance,
    };
  }
}
