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
}
