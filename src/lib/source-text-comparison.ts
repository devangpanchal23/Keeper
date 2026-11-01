import { ContentRepresentation } from "@/types";
import { MetadataNormalizer } from "@/services/normalizer/metadata-normalizer";

/**
 * Result of comparing a media item's Post Caption against its Source Text Analysis.
 */
export interface SourceTextComparisonResult {
  /** Whether the Source Text Analysis component should be displayed in the UI */
  shouldShow: boolean;
  /** Normalized similarity score between 0.0 and 1.0 (1.0 = 100% identical) */
  similarityScore: number;
  /** Whether the source text contains meaningful extra words, facts, or emojis missing from the caption */
  hasMeaningfulDifference: boolean;
  /** Programmatic reason explaining why the visibility decision was made */
  reason:
    | "empty_source_analysis"
    | "failed_media_extraction"
    | "missing_caption_with_source_content"
    | "identical_text"
    | "case_insensitive_identical"
    | "high_similarity_no_meaningful_difference"
    | "different_emojis_with_context"
    | "additional_numerical_information"
    | "additional_meaningful_information"
    | "meaningful_text_difference";
  /** Count of novel meaningful tokens present in source text but absent in caption */
  novelTokenCount: number;
  /** Specific novel emojis present in source text but absent in caption */
  novelEmojis: string[];
}

/**
 * Unicode Extended Pictographic regex matching single emojis, skin-tone modifiers,
 * variation selectors, and zero-width-joiner (ZWJ) sequences.
 */
export const EMOJI_REGEX =
  /\p{Extended_Pictographic}(?:\u200D\p{Extended_Pictographic}|[\uFE0E\uFE0F]|\uD83C[\uDFFB-\uDFFF])*/gu;

/**
 * Matches Unicode word and number tokens across all scripts (Latin, Han, Kana, Devanagari, Arabic, Cyrillic, etc.).
 */
export const WORD_TOKEN_REGEX = /[\p{L}\p{N}]+/gu;

/**
 * Extracts all Unicode emojis from a text string.
 */
export function extractEmojis(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMOJI_REGEX);
  return matches ? Array.from(matches) : [];
}

/**
 * Extracts normalized tokens from a text string for vocabulary and multiset comparison.
 */
export function extractTokens(text: string): string[] {
  if (!text) return [];
  const matches = text.match(WORD_TOKEN_REGEX);
  return matches ? matches.map((t) => t.toLowerCase()) : [];
}

/**
 * Checks whether a token is meaningful (e.g. at least 2 characters, a number, or a CJK character).
 */
export function isMeaningfulToken(token: string): boolean {
  if (!token) return false;
  if (token.length >= 2) return true;
  if (/\p{N}/u.test(token)) return true;
  // In Chinese, Japanese, and Korean, single characters are complete words/morphemes
  if (/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(token)) {
    return true;
  }
  return false;
}

/**
 * Normalizes text for structural similarity comparison:
 * 1. Decodes HTML entities and repairs UTF-8 mojibake.
 * 2. Normalizes to Unicode NFC.
 * 3. Strips Markdown formatting artifacts (*, _, `, ~, #).
 * 4. Normalizes smart quotes and dashes to standard ASCII forms.
 * 5. Collapses all whitespace and line breaks to single spaces.
 */
export function normalizeForComparison(text: string): string {
  if (!text || typeof text !== "string") return "";

  const decoded = MetadataNormalizer.decodeHtmlEntities(text);
  const fixed = MetadataNormalizer.fixMojibake(decoded);

  return fixed
    .normalize("NFC")
    // Strip markdown emphasis & code formatting
    .replace(/[*_~`#]+/g, " ")
    // Strip markdown blockquotes and list bullets
    .replace(/^[ \t]*[>•\-*]+[ \t]+/gm, "")
    // Normalize quotation marks
    .replace(/[""„«»]/g, '"')
    .replace(/[''‚‹›]/g, "'")
    // Normalize dashes
    .replace(/[—–―]/g, "-")
    // Collapse all whitespace and line-break variations
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Memory-efficient Levenshtein distance computation with common prefix and suffix stripping.
 */
export function computeLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  // 1. Strip common prefix
  let start = 0;
  while (start < a.length && start < b.length && a.charCodeAt(start) === b.charCodeAt(start)) {
    start++;
  }

  // 2. Strip common suffix
  let endA = a.length - 1;
  let endB = b.length - 1;
  while (endA >= start && endB >= start && a.charCodeAt(endA) === b.charCodeAt(endB)) {
    endA--;
    endB--;
  }

  const sliceA = a.slice(start, endA + 1);
  const sliceB = b.slice(start, endB + 1);

  if (!sliceA.length) return sliceB.length;
  if (!sliceB.length) return sliceA.length;

  // Use the shorter string for O(min(N, M)) memory footprint
  const s1 = sliceA.length < sliceB.length ? sliceA : sliceB;
  const s2 = sliceA.length < sliceB.length ? sliceB : sliceA;

  const prevRow = new Int32Array(s1.length + 1);
  const currRow = new Int32Array(s1.length + 1);

  for (let i = 0; i <= s1.length; i++) {
    prevRow[i] = i;
  }

  for (let j = 1; j <= s2.length; j++) {
    currRow[0] = j;
    const char2 = s2.charCodeAt(j - 1);
    for (let i = 1; i <= s1.length; i++) {
      const cost = s1.charCodeAt(i - 1) === char2 ? 0 : 1;
      currRow[i] = Math.min(
        currRow[i - 1] + 1,     // insertion
        prevRow[i] + 1,         // deletion
        prevRow[i - 1] + cost   // substitution
      );
    }
    prevRow.set(currRow);
  }

  return prevRow[s1.length];
}

/**
 * Computes token multiset overlap using Sørensen-Dice similarity coefficient.
 */
export function computeTokenDiceSimilarity(tokensA: string[], tokensB: string[]): number {
  if (!tokensA.length && !tokensB.length) return 1.0;
  if (!tokensA.length || !tokensB.length) return 0.0;

  const countsA = new Map<string, number>();
  for (const t of tokensA) {
    countsA.set(t, (countsA.get(t) || 0) + 1);
  }

  let intersection = 0;
  for (const t of tokensB) {
    const count = countsA.get(t) || 0;
    if (count > 0) {
      intersection++;
      countsA.set(t, count - 1);
    }
  }

  return (2 * intersection) / (tokensA.length + tokensB.length);
}

/**
 * Compares the Post Caption against the Source Text Analysis to determine
 * whether the Source Text Analysis component provides meaningful extra information
 * or is a redundant duplicate.
 *
 * Rules:
 * - HIDE if source text is empty or extraction failed.
 * - HIDE if source text is identical to caption (or differs only by whitespace/formatting).
 * - HIDE if normalized similarity is >= 99% and no meaningful extra words, numbers, or emojis exist.
 * - SHOW if source text contains additional information (transcript, OCR, extra sentences, facts).
 * - SHOW if source text contains novel emojis with context.
 * - SHOW if caption is missing but source text is available.
 */
export function compareSourceTextWithCaption(
  rawCaption: string | null | undefined,
  sourceInput: string | ContentRepresentation | null | undefined
): SourceTextComparisonResult {
  let sourceText: string | null = null;
  let isFailedOrUnavailable = false;

  if (sourceInput && typeof sourceInput === "object") {
    if (sourceInput.status === "failed" || sourceInput.type === "unavailable") {
      isFailedOrUnavailable = true;
    }
    sourceText = sourceInput.text || null;
  } else if (typeof sourceInput === "string") {
    sourceText = sourceInput;
  }

  const cleanSource = (sourceText || "").trim();
  const cleanCaption = (rawCaption || "").trim();

  // 1. Empty source analysis -> Hide
  if (!cleanSource) {
    return {
      shouldShow: false,
      similarityScore: 0,
      hasMeaningfulDifference: false,
      reason: "empty_source_analysis",
      novelTokenCount: 0,
      novelEmojis: [],
    };
  }

  // 2. Failed media extraction -> Hide safely
  if (isFailedOrUnavailable && !cleanSource) {
    return {
      shouldShow: false,
      similarityScore: 0,
      hasMeaningfulDifference: false,
      reason: "failed_media_extraction",
      novelTokenCount: 0,
      novelEmojis: [],
    };
  }

  // 3. Missing caption but meaningful source analysis -> Show
  if (!cleanCaption && cleanSource.length > 0) {
    const sourceTokens = extractTokens(cleanSource);
    const sourceEmojis = extractEmojis(cleanSource);
    return {
      shouldShow: true,
      similarityScore: 0,
      hasMeaningfulDifference: true,
      reason: "missing_caption_with_source_content",
      novelTokenCount: sourceTokens.length,
      novelEmojis: sourceEmojis,
    };
  }

  // 4. Normalize both strings for comparison
  const normCaption = normalizeForComparison(cleanCaption);
  const normSource = normalizeForComparison(cleanSource);

  // 5. 100% Exact match after normalization -> Hide
  if (normCaption === normSource) {
    return {
      shouldShow: false,
      similarityScore: 1.0,
      hasMeaningfulDifference: false,
      reason: "identical_text",
      novelTokenCount: 0,
      novelEmojis: [],
    };
  }

  // 6. Case-insensitive exact match -> Hide
  if (normCaption.toLowerCase() === normSource.toLowerCase()) {
    return {
      shouldShow: false,
      similarityScore: 1.0,
      hasMeaningfulDifference: false,
      reason: "case_insensitive_identical",
      novelTokenCount: 0,
      novelEmojis: [],
    };
  }

  // 7. Emoji comparison
  const captionEmojis = extractEmojis(normCaption);
  const sourceEmojis = extractEmojis(normSource);
  const captionEmojiSet = new Set(captionEmojis);
  const novelEmojis = sourceEmojis.filter((e) => !captionEmojiSet.has(e));

  // 8. Token multiset comparison
  const captionTokens = extractTokens(normCaption);
  const sourceTokens = extractTokens(normSource);

  const captionTokenSet = new Set(captionTokens);
  const novelTokens = sourceTokens.filter(
    (token) => !captionTokenSet.has(token) && isMeaningfulToken(token)
  );

  // Check specifically for numerical additions (e.g. statistics, quantities, metrics)
  const captionNumberTokens = new Set(captionTokens.filter((t) => /\d/.test(t)));
  const novelNumbers = sourceTokens.filter(
    (t) => /\d/.test(t) && !captionNumberTokens.has(t)
  );

  // 9. Similarity calculations
  const tokenDiceSim = computeTokenDiceSimilarity(captionTokens, sourceTokens);

  // Character-level Levenshtein similarity
  const maxLen = Math.max(normCaption.length, normSource.length);
  const levDistance = computeLevenshteinDistance(
    normCaption.toLowerCase(),
    normSource.toLowerCase()
  );
  const charLevSim = maxLen > 0 ? 1 - levDistance / maxLen : 1;

  // Overall similarity score
  const similarityScore = Math.max(0, Math.min(1, Math.max(tokenDiceSim, charLevSim)));

  // Meaningful difference evaluation
  const hasNovelEmojis = novelEmojis.length > 0;
  const hasNovelNumbers = novelNumbers.length > 0;
  const hasNovelTokens = novelTokens.length > 0;
  const hasMeaningfulDifference = hasNovelEmojis || hasNovelNumbers || hasNovelTokens;

  // 10. High similarity gate (>= 99%)
  if (similarityScore >= 0.99 && !hasMeaningfulDifference) {
    return {
      shouldShow: false,
      similarityScore,
      hasMeaningfulDifference: false,
      reason: "high_similarity_no_meaningful_difference",
      novelTokenCount: 0,
      novelEmojis: [],
    };
  }

  // 11. Meaningful additions detected -> Show
  if (hasMeaningfulDifference) {
    return {
      shouldShow: true,
      similarityScore,
      hasMeaningfulDifference: true,
      reason: hasNovelEmojis
        ? "different_emojis_with_context"
        : hasNovelNumbers
        ? "additional_numerical_information"
        : "additional_meaningful_information",
      novelTokenCount: novelTokens.length,
      novelEmojis,
    };
  }

  // 12. If similarity is below 99%, show as content differs meaningfully
  if (similarityScore < 0.99) {
    return {
      shouldShow: true,
      similarityScore,
      hasMeaningfulDifference: true,
      reason: "meaningful_text_difference",
      novelTokenCount: novelTokens.length,
      novelEmojis,
    };
  }

  // Default fallback: Hide redundant content
  return {
    shouldShow: false,
    similarityScore,
    hasMeaningfulDifference: false,
    reason: "high_similarity_no_meaningful_difference",
    novelTokenCount: 0,
    novelEmojis: [],
  };
}

/**
 * Boolean convenience helper to determine if the Source Text Analysis section
 * should be rendered in UI components.
 */
export function shouldShowSourceTextAnalysis(
  caption: string | null | undefined,
  contentRepresentation: ContentRepresentation | null | undefined
): boolean {
  return compareSourceTextWithCaption(caption, contentRepresentation).shouldShow;
}
