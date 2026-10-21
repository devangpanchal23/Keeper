/**
 * Central Production Metadata Normalizer
 *
 * Provides safe, idempotent decoding of:
 * 1. Hexadecimal HTML entities (e.g. &#x3042; -> あ)
 * 2. Decimal HTML entities (e.g. &#12354; -> あ)
 * 3. Named HTML entities (e.g. &amp;, &quot;, &apos;, &hellip;, &mdash;)
 * 4. Multi-level encoded entities (e.g. &amp;#x3042; -> あ)
 * 5. Unicode normalization (NFC) preserving all multilingual scripts (Japanese, Hindi, Gujarati, etc.) and emojis
 * 6. Whitespace and line-break normalization
 */

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  laquo: "«",
  raquo: "»",
  bull: "•",
  middot: "·",
  copy: "©",
  reg: "®",
  trade: "™",
  euro: "€",
  pound: "£",
  yen: "¥",
  cent: "¢",
  deg: "°",
  plusmn: "±",
  times: "×",
  divide: "÷",
  para: "¶",
  sect: "§",
  dagger: "†",
  Dagger: "‡",
  permil: "‰",
  prime: "′",
  Prime: "″",
  larr: "←",
  uarr: "↑",
  rarr: "→",
  darr: "↓",
  harr: "↔",
  crarr: "↵",
  infin: "∞",
  radic: "√",
  asymp: "≈",
  ne: "≠",
  le: "≤",
  ge: "≥",
  sub: "⊂",
  sup: "⊃",
  cap: "∩",
  cup: "∪",
  and: "∧",
  or: "∨",
  check: "✓",
  cross: "✗",
  spades: "♠",
  clubs: "♣",
  hearts: "♥",
  diams: "♦",
};

export class MetadataNormalizer {
  /**
   * Safely decodes a single entity match.
   */
  private static decodeEntity(fullMatch: string, entityBody: string): string {
    // Hexadecimal numeric entity: &#x3042; or &#X3042;
    if (entityBody.startsWith("#x") || entityBody.startsWith("#X")) {
      const hex = entityBody.slice(2);
      const codePoint = parseInt(hex, 16);
      if (!isNaN(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return fullMatch;
        }
      }
      return fullMatch;
    }

    // Decimal numeric entity: &#12354;
    if (entityBody.startsWith("#")) {
      const dec = entityBody.slice(1);
      const codePoint = parseInt(dec, 10);
      if (!isNaN(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff) {
        try {
          return String.fromCodePoint(codePoint);
        } catch {
          return fullMatch;
        }
      }
      return fullMatch;
    }

    // Named entity: &quot;, &amp;, &hellip;, etc.
    const lowerName = entityBody.toLowerCase();
    if (Object.prototype.hasOwnProperty.call(NAMED_HTML_ENTITIES, lowerName)) {
      return NAMED_HTML_ENTITIES[lowerName];
    }

    return fullMatch;
  }

  /**
   * Decodes all HTML entities in a text string.
   * Supports multi-level encoding (up to 3 passes).
   */
  public static decodeHtmlEntities(raw: string): string {
    if (!raw || typeof raw !== "string") return "";

    let current = raw;
    let prev = "";
    let pass = 0;
    const maxPasses = 3;

    // Pattern matches &...; or unclosed &#x... / &#...
    const entityRegex = /&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);?/g;

    while (current !== prev && pass < maxPasses) {
      prev = current;
      current = current.replace(entityRegex, (match, body) => this.decodeEntity(match, body));
      pass++;
    }

    return current;
  }

  /**
   * Strips HTML tags (<p>, <br>, <a>, etc.) while preserving inner text.
   */
  public static stripHtmlTags(html: string): string {
    if (!html || typeof html !== "string") return "";
    return html
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p\s*>/gi, "\n\n")
      .replace(/<\/div\s*>/gi, "\n")
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]+>/g, "");
  }

  /**
   * Normalizes whitespace and line breaks without destroying meaningful paragraphs.
   */
  public static normalizeWhitespace(text: string): string {
    if (!text || typeof text !== "string") return "";
    return text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .replace(/[ \t]+/g, " ")
      .replace(/\n\s+\n/g, "\n\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  }

  /**
   * Fixes Latin-1 / UTF-8 mojibake commonly present in Meta / Instagram JSON exports.
   * e.g. "Ã©" -> "é", "â\u0080\u0099" -> "’", "\u00f0\u009f\u0094\u00a5" -> "🔥".
   * Isomorphic: runs safely in both Node.js and modern Browser runtimes via TextDecoder.
   * Safe and idempotent: does not corrupt genuine UTF-8, Japanese, Cyrillic, Hindi, or emojis.
   */
  public static fixMojibake(text: string): string {
    if (!text || typeof text !== "string") return "";
    // Fast check: look for byte sequence patterns where 0xC2-0xF4 is followed by 0x80-0xBF
    if (!/[\u00c0-\u00f4][\u0080-\u00bf]/.test(text)) {
      return text;
    }

    try {
      const bytes = new Uint8Array(text.length);
      for (let i = 0; i < text.length; i++) {
        bytes[i] = text.charCodeAt(i) & 0xff;
      }
      const decoded = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
      // Ensure decoding didn't produce replacement characters or empty output
      if (decoded && !decoded.includes("\ufffd") && decoded !== text) {
        return decoded;
      }
    } catch {
      // If decoding fails, fall back to original text
    }

    return text;
  }

  /**
   * Master text normalizer:
   * Fixes Mojibake -> Strips tags -> Decodes all entities -> Normalizes Unicode NFC -> Normalizes whitespace.
   * Completely idempotent: normalizeText(normalizeText(x)) === normalizeText(x).
   */
  public static normalizeText(text: string): string {
    if (!text || typeof text !== "string") return "";
    const mojibakeFixed = this.fixMojibake(text);
    const stripped = this.stripHtmlTags(mojibakeFixed);
    const decoded = this.decodeHtmlEntities(stripped);
    const unicodeNormalized = decoded.normalize("NFC");
    return this.normalizeWhitespace(unicodeNormalized);
  }

  /**
   * Extracts clean hashtags from text.
   * Preserves multilingual hashtag letters (e.g. #あらゆる, #ગુજરાતી, #हिन्दी).
   */
  public static extractHashtags(text: string): string[] {
    if (!text || typeof text !== "string") return [];
    const normalized = this.normalizeText(text);

    // Unicode combining marks are part of many scripts' written characters
    // (for example Gujarati vowel signs), even though they are not letters.
    const regex = /#([\p{L}\p{M}\p{N}_]+)/gu;
    const tags: string[] = [];
    let match: RegExpExecArray | null;

    while ((match = regex.exec(normalized)) !== null) {
      const tag = match[1].trim();
      if (tag && !tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        tags.push(tag);
      }
    }

    return tags;
  }

  /**
   * Derives a clean display headline/title from an Instagram caption.
   * Strips leading/trailing hashtag blocks to produce human-readable titles.
   */
  public static deriveDisplayTitleFromCaption(
    caption: string,
    creatorName?: string,
    platform: string = "Instagram",
    contentType: string = "Reel"
  ): string {
    const clean = this.normalizeText(caption);
    if (!clean) {
      return creatorName
        ? `${platform} ${contentType} by ${creatorName}`
        : `${platform} ${contentType}`;
    }

    // Split by line or sentence
    const lines = clean.split("\n").map((l) => l.trim()).filter(Boolean);

    // Find the first line that isn't purely hashtags
    for (const line of lines) {
      const nonHashtags = line.replace(/#[\p{L}\p{N}_]+/gu, "").trim();
      if (nonHashtags.length > 5) {
        return nonHashtags.length > 80 ? `${nonHashtags.slice(0, 77)}...` : nonHashtags;
      }
    }

    // If the entire caption is hashtags, take the first 2-3 hashtags cleanly formatted
    const hashtags = this.extractHashtags(clean);
    if (hashtags.length > 0) {
      const tagSnippet = hashtags.slice(0, 3).map((t) => `#${t}`).join(" ");
      return tagSnippet.length > 80 ? `${tagSnippet.slice(0, 77)}...` : tagSnippet;
    }

    return creatorName
      ? `${platform} ${contentType} by ${creatorName}`
      : `${platform} ${contentType}`;
  }

  /**
   * Sanitizes and validates tags.
   * Ensures no raw HTML entities, valid length, deduplication.
   */
  public static sanitizeTags(rawTags: string[], maxTags: number = 8): string[] {
    if (!Array.isArray(rawTags)) return [];

    const cleanList: string[] = [];
    const seen = new Set<string>();

    for (const raw of rawTags) {
      if (!raw || typeof raw !== "string") continue;
      const clean = this.normalizeText(raw)
        .replace(/^#+/, "")
        .replace(/^[^\p{L}\p{M}\p{N}]+|[^\p{L}\p{M}\p{N}]+$/gu, "")
        .trim();

      // Reject corrupted entity residues or dummy values
      if (
        !clean ||
        clean.length < 2 ||
        clean.length > 35 ||
        /^(?:x[0-9a-f]{4,6}){1,}$/i.test(clean) ||
        clean.includes("&#") ||
        clean.includes("&amp;") ||
        clean === "undefined" ||
        clean === "null" ||
        clean === "[object Object]"
      ) {
        continue;
      }

      const key = clean.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        cleanList.push(clean);
        if (cleanList.length >= maxTags) break;
      }
    }

    return cleanList;
  }

  /**
   * Authoritative normalization of Reddit creator/author.
   * Strips any "u/" or "/u/" prefix.
   * Identifies deleted/removed authors without fabricating fake usernames.
   */
  public static normalizeRedditAuthor(rawAuthor?: string | null): {
    username: string | null;
    displayName: string;
    status: "active" | "deleted";
  } {
    if (!rawAuthor || typeof rawAuthor !== "string") {
      return { username: null, displayName: "Deleted user", status: "deleted" };
    }

    const trimmed = rawAuthor.trim();
    if (
      !trimmed ||
      trimmed === "[deleted]" ||
      trimmed === "[removed]" ||
      trimmed.toLowerCase() === "deleted" ||
      trimmed.toLowerCase() === "null" ||
      trimmed.toLowerCase() === "undefined"
    ) {
      return { username: null, displayName: "Deleted user", status: "deleted" };
    }

    // Strip leading /u/ or u/
    const clean = trimmed.replace(/^[\/]?u\//i, "").trim();
    const normalized = this.normalizeText(clean);

    if (!normalized || normalized === "[deleted]" || normalized === "[removed]") {
      return { username: null, displayName: "Deleted user", status: "deleted" };
    }

    return {
      username: normalized,
      displayName: normalized,
      status: "active",
    };
  }

  /**
   * Authoritative normalization of Instagram author & account attribution.
   *
   * Invariants:
   * 1. Valid Instagram handles MUST match /^[a-zA-Z0-9_\.]+$/ (NO SPACES).
   * 2. NEVER prefix '@' to a display name with spaces (e.g. '@Nikitha M S' is INVALID).
   * 3. Distinguishes verified creator handle from mentioned people in the caption.
   * 4. Accurately attributes known handles (e.g. 'niki.webinns') from URL paths or embed links.
   */
  public static normalizeInstagramAuthor(input: {
    rawUsername?: string | null;
    rawDisplayName?: string | null;
    caption?: string | null;
    urlPathUsername?: string | null;
    source?: string;
  }): {
    username: string | null;
    displayName: string;
    handle?: string;
    confidence: number;
    attributionSource: "url_path" | "verified_metadata" | "embed_username" | "opengraph_handle" | "display_name_only" | "unknown";
    mentionedAccounts: string[];
  } {
    const caption = input.caption || "";
    const mentionedAccounts: string[] = [];
    const mentionRegex = /@([a-zA-Z0-9_\.]{2,30})/g;
    let mentionMatch: RegExpExecArray | null;
    while ((mentionMatch = mentionRegex.exec(caption)) !== null) {
      const handle = mentionMatch[1].trim();
      if (!mentionedAccounts.includes(handle)) {
        mentionedAccounts.push(handle);
      }
    }

    const cleanUrlUsername = input.urlPathUsername
      ? this.normalizeText(input.urlPathUsername).replace(/^@/, "").trim()
      : null;
    const isUrlUsernameValid = cleanUrlUsername && /^[a-zA-Z0-9_\.]+$/.test(cleanUrlUsername);

    const cleanRawUsername = input.rawUsername
      ? this.normalizeText(input.rawUsername).replace(/^@/, "").trim()
      : null;
    const isRawUsernameValid = cleanRawUsername && /^[a-zA-Z0-9_\.]+$/.test(cleanRawUsername);

    const cleanRawDisplayName = input.rawDisplayName
      ? this.normalizeText(input.rawDisplayName).trim()
      : null;

    // 1. Authoritative URL-path or embed username wins for the creator's handle
    if (isUrlUsernameValid) {
      const dispName = cleanRawDisplayName || cleanUrlUsername;
      return {
        username: cleanUrlUsername,
        displayName: dispName,
        handle: `@${cleanUrlUsername}`,
        confidence: 0.95,
        attributionSource: input.source === "embed" ? "embed_username" : "url_path",
        mentionedAccounts: mentionedAccounts.filter((m) => m.toLowerCase() !== cleanUrlUsername.toLowerCase()),
      };
    }

    // 2. Verified handle from metadata (e.g. oEmbed or OpenGraph @handle)
    if (isRawUsernameValid) {
      const dispName = cleanRawDisplayName && cleanRawDisplayName !== cleanRawUsername ? cleanRawDisplayName : cleanRawUsername;
      return {
        username: cleanRawUsername,
        displayName: dispName,
        handle: `@${cleanRawUsername}`,
        confidence: 0.9,
        attributionSource: "opengraph_handle",
        mentionedAccounts: mentionedAccounts.filter((m) => m.toLowerCase() !== cleanRawUsername.toLowerCase()),
      };
    }

    // 3. Display name without handle available (e.g. "Nikitha M S")
    // Strictly preserve display name WITHOUT fabricating an invalid handle like '@Nikitha M S'
    if (cleanRawDisplayName) {
      return {
        username: null,
        displayName: cleanRawDisplayName,
        handle: undefined,
        confidence: 0.5,
        attributionSource: "display_name_only",
        mentionedAccounts,
      };
    }

    return {
      username: null,
      displayName: "Instagram Creator",
      handle: undefined,
      confidence: 0.2,
      attributionSource: "unknown",
      mentionedAccounts,
    };
  }

  /**
   * Timezone-safe authoritative publication date parser.
   *
   * Invariants:
   * 1. Calendar dates without time (e.g. "October 18, 2026" or "18 October 2026" or "2026-10-18")
   *    are parsed using UTC noon to prevent cross-midnight shifts in any local timezone.
   * 2. Preserves exact YYYY-MM-DD components.
   * 3. Never substitutes import date or current date for the original publication date.
   */
  public static parseAuthoritativeDate(dateStr?: string | null): {
    iso: string | null;
    formattedDate: string | null;
    confidence: "verified" | "extracted" | "unavailable";
    raw: string | null;
  } {
    if (!dateStr || typeof dateStr !== "string" || !dateStr.trim()) {
      return { iso: null, formattedDate: null, confidence: "unavailable", raw: null };
    }

    const trimmed = dateStr.trim();
    const MONTH_MAP: Record<string, number> = {
      january: 0, jan: 0,
      february: 1, feb: 1,
      march: 2, mar: 2,
      april: 3, apr: 3,
      may: 4,
      june: 5, jun: 5,
      july: 6, jul: 6,
      august: 7, aug: 7,
      september: 8, sep: 8, sept: 8,
      october: 9, oct: 9,
      november: 10, nov: 10,
      december: 11, dec: 11,
    };

    // Pattern A: "Month DD, YYYY" or "Month DD YYYY" (e.g. "October 18, 2026")
    const mdyMatch = trimmed.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
    if (mdyMatch) {
      const monthIdx = MONTH_MAP[mdyMatch[1].toLowerCase()];
      const day = parseInt(mdyMatch[2], 10);
      const year = parseInt(mdyMatch[3], 10);
      if (monthIdx !== undefined && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        const utcDate = new Date(Date.UTC(year, monthIdx, day, 12, 0, 0));
        const mm = String(monthIdx + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        return {
          iso: utcDate.toISOString(),
          formattedDate: `${year}-${mm}-${dd}`,
          confidence: "extracted",
          raw: trimmed,
        };
      }
    }

    // Pattern B: "DD Month YYYY" (e.g. "18 October 2026" or "14 October 2026")
    const dmyMatch = trimmed.match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/);
    if (dmyMatch) {
      const day = parseInt(dmyMatch[1], 10);
      const monthIdx = MONTH_MAP[dmyMatch[2].toLowerCase()];
      const year = parseInt(dmyMatch[3], 10);
      if (monthIdx !== undefined && day >= 1 && day <= 31 && year >= 2000 && year <= 2100) {
        const utcDate = new Date(Date.UTC(year, monthIdx, day, 12, 0, 0));
        const mm = String(monthIdx + 1).padStart(2, "0");
        const dd = String(day).padStart(2, "0");
        return {
          iso: utcDate.toISOString(),
          formattedDate: `${year}-${mm}-${dd}`,
          confidence: "extracted",
          raw: trimmed,
        };
      }
    }

    // Pattern C: ISO date "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm:ss..."
    const isoPrefixMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)?$/);
    if (isoPrefixMatch) {
      const year = parseInt(isoPrefixMatch[1], 10);
      const month = parseInt(isoPrefixMatch[2], 10);
      const day = parseInt(isoPrefixMatch[3], 10);
      if (year >= 2000 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        if (!isoPrefixMatch[4]) {
          // Pure date string: parse at midday UTC
          const utcDate = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
          const mm = String(month).padStart(2, "0");
          const dd = String(day).padStart(2, "0");
          return {
            iso: utcDate.toISOString(),
            formattedDate: `${year}-${mm}-${dd}`,
            confidence: "verified",
            raw: trimmed,
          };
        }
        // Timestamp with time component
        const parsed = new Date(trimmed);
        if (!isNaN(parsed.getTime())) {
          return {
            iso: parsed.toISOString(),
            formattedDate: parsed.toISOString().split("T")[0],
            confidence: "verified",
            raw: trimmed,
          };
        }
      }
    }

    // Fallback: Attempt standard parsing
    const fallbackParsed = new Date(trimmed);
    if (!isNaN(fallbackParsed.getTime())) {
      return {
        iso: fallbackParsed.toISOString(),
        formattedDate: fallbackParsed.toISOString().split("T")[0],
        confidence: "extracted",
        raw: trimmed,
      };
    }

    return { iso: null, formattedDate: null, confidence: "unavailable", raw: trimmed };
  }
}
