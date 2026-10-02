import {
  AuthoritativeSourceData,
  Collection,
  FieldProvenance,
  GroundedAIEnrichment,
} from "@/types";
import { MetadataNormalizer } from "./normalizer/metadata-normalizer";
import { ContentIntelligenceService } from "./content-intelligence";
import { ContentAnalysisService } from "./content-analysis-service";
import { CollectionMatchingService } from "./collection-matching-service";

export interface GroundedAIEvidence {
  platform: string;
  type: string;
  creator?: {
    name: string;
    handle?: string;
    username?: string;
    status?: string;
  };
  canonicalUrl: string;
  caption: string;
  hashtags: string[];
  description: string;
  transcript: string;
  semanticText: string;
  isRestricted: boolean;
  // Reddit-specific structured evidence
  postType?: string;
  subreddit?: string;
  flair?: string;
  author?: string;
  availableMediaContext?: string;
  outboundContext?: string;
  score?: string;
  commentCount?: string;
}

export class AIPipeline {
  /**
   * Calculates collection relevance score and finds the best matching collection.
   * Requires a minimum threshold (0.35) so unrelated collections are never forced.
   */
  public static calculateCollectionMatch(
    content: {
      category?: string;
      topics?: string[];
      tags?: string[];
      subreddit?: string;
      description?: string;
    },
    collections: Collection[],
    threshold: number = 0.35
  ): { collection: Collection; confidence: number } | null {
    if (!collections || collections.length === 0) return null;

    // Tokenize all relevant content keywords
    const contentTokens = new Set<string>();
    const addTokens = (str?: string) => {
      if (!str) return;
      str
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .forEach((w) => contentTokens.add(w));
    };

    addTokens(content.category);
    content.topics?.forEach(addTokens);
    content.tags?.forEach(addTokens);
    addTokens(content.subreddit);
    addTokens(content.description);

    let bestMatch: Collection | null = null;
    let highestScore = 0;

    for (const col of collections) {
      const colTokens = new Set<string>();
      col.name
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .filter((w) => w.length > 2)
        .forEach((w) => colTokens.add(w));

      if (col.description) {
        col.description
          .toLowerCase()
          .replace(/[^\p{L}\p{N}\s]/gu, " ")
          .split(/\s+/)
          .filter((w) => w.length > 2)
          .forEach((w) => colTokens.add(w));
      }

      // Check name direct substring or match
      const colNameLower = col.name.toLowerCase();
      let matchCount = 0;

      // Exact category or tag match gives strong signal
      if (content.category && colNameLower.includes(content.category.toLowerCase())) {
        matchCount += 3;
      }
      if (content.tags?.some((t) => colNameLower.includes(t.toLowerCase()))) {
        matchCount += 2;
      }

      // Overlap with collection tokens
      for (const t of colTokens) {
        if (contentTokens.has(t)) {
          matchCount += 1;
        }
      }

      const score = matchCount / Math.max(colTokens.size, 3);
      if (score > highestScore && score >= threshold) {
        highestScore = score;
        bestMatch = col;
      }
    }

    if (bestMatch && highestScore >= threshold) {
      return { collection: bestMatch, confidence: Math.min(highestScore, 1) };
    }

    return null;
  }

  /**
   * Builds structured, normalized evidence object from authoritative source data.
   */
  public static buildStructuredEvidence(sourceData: AuthoritativeSourceData): GroundedAIEvidence {
    const rawCaption = sourceData.caption || "";
    const rawDesc = sourceData.description || "";
    const rawTranscript = sourceData.transcript || "";
    const rawBody = sourceData.bodyText || "";

    const caption = MetadataNormalizer.normalizeText(rawCaption);
    const description = MetadataNormalizer.normalizeText(rawDesc);
    const transcript = MetadataNormalizer.normalizeText(rawTranscript);
    const bodyText = MetadataNormalizer.normalizeText(rawBody);

    // Extract hashtags cleanly from caption & description
    const hashtags = MetadataNormalizer.extractHashtags(`${caption} ${description}`);

    // Distinguish real source content from fallback boilerplate
    const isBoilerplate = (text: string) =>
      text.includes("saved to Keeper") ||
      text.includes("saved to Recall") ||
      text.includes("published by") ||
      text.length === 0;

    // Semantic text excluding pure hashtag blocks and boilerplate
    const nonHashtagCaption = caption.replace(/#[\p{L}\p{N}_]+/gu, "").trim();
    const candidateTexts = [
      nonHashtagCaption,
      transcript,
      bodyText,
      isBoilerplate(description) ? "" : description,
    ].filter(Boolean);

    const semanticText = candidateTexts.join("\n\n").trim();

    // Reddit-specific fields: canonical extraction
    const rawMeta = sourceData.rawPlatformMetadata || {};
    const rawSub = sourceData.community?.name || rawMeta.subreddit;
    const subreddit = rawSub ? String(rawSub).replace(/^r\//i, "").trim().toLowerCase() : undefined;

    const rawAuthor = sourceData.creator?.username
      || (sourceData.creator?.name ? sourceData.creator.name.replace(/^u\//i, "") : undefined)
      || (rawMeta.author ? String(rawMeta.author).replace(/^u\//i, "") : undefined);
    const author = rawAuthor ? MetadataNormalizer.normalizeText(rawAuthor) : undefined;

    const flair = rawMeta.flair || rawMeta.link_flair_text || undefined;
    const postType = rawMeta.postType || (sourceData.contentType === "image" ? "image" : (sourceData.contentType === "video" ? "video" : "post"));
    const availableMediaContext = rawMeta.mediaItems?.length
      ? `${rawMeta.mediaItems.length} media item(s)`
      : (sourceData.mediaUrl ? "Media attachment" : undefined);
    const outboundContext = rawMeta.url && !rawMeta.is_self ? rawMeta.url : undefined;

    // Structured development diagnostic payload
    const structuredPayload = {
      contentId: sourceData.contentId,
      platform: sourceData.platform,
      contentType: sourceData.contentType,
      title: MetadataNormalizer.normalizeText(sourceData.title || ""),
      creator: {
        username: author || null,
        displayName: sourceData.creator?.displayName || author || null,
      },
      community: subreddit ? {
        name: subreddit,
        displayName: `r/${subreddit}`,
      } : undefined,
      body: bodyText || undefined,
      flair: flair ? MetadataNormalizer.normalizeText(flair) : undefined,
      mediaContext: availableMediaContext,
    };

    if (process.env.NODE_ENV === "development") {
      console.log("[AI Input Payload Builder]", JSON.stringify(structuredPayload, null, 2));
    }

    return {
      platform: sourceData.platform,
      type: sourceData.contentType || "content",
      creator: sourceData.creator ? {
        name: MetadataNormalizer.normalizeText(sourceData.creator.name),
        handle: sourceData.creator.handle ? MetadataNormalizer.normalizeText(sourceData.creator.handle) : undefined,
        username: sourceData.creator.username || undefined,
        status: sourceData.creator.status || undefined,
      } : undefined,
      canonicalUrl: sourceData.canonicalUrl,
      caption,
      hashtags,
      description,
      transcript,
      semanticText,
      isRestricted: Boolean(sourceData.isRestricted),
      postType,
      subreddit,
      flair: flair ? MetadataNormalizer.normalizeText(flair) : undefined,
      author,
      availableMediaContext,
      outboundContext,
      score: sourceData.likeCount,
      commentCount: sourceData.commentCount,
    };
  }

  /**
   * Grounded AI enrichment that strictly separates platform-authoritative data from AI synthesis.
   * Never hallucinates content or fabricates confident summaries when source data is missing.
   */
  public static async enrichContent(
    sourceData: AuthoritativeSourceData,
    existingCollections: Collection[] = []
  ): Promise<GroundedAIEnrichment> {
    const now = new Date().toISOString();
    const provenance: Record<string, FieldProvenance> = { ...sourceData.provenance };
    const verifiedTranscriptProviders = new Set([
      "openai-audio-transcriptions", "faster-whisper", "platform_caption_track", "youtube_caption_track", "speech_to_text",
    ]);
    const transcriptProvenance = sourceData.provenance?.transcript;
    const transcript = typeof sourceData.transcript === "string"
      && typeof transcriptProvenance?.source === "string"
      && verifiedTranscriptProviders.has(transcriptProvenance.source)
      ? sourceData.transcript
      : "";
    const isVideo = ["video", "reel", "short"].includes(sourceData.contentType) || sourceData.platform === "youtube-shorts";
    const representation = ContentIntelligenceService.normalizeRepresentation({
      transcript: transcript ? { status: "transcribed", text: transcript, segments: [], provider: transcriptProvenance?.source || "speech_to_text", modelVersion: "verified-source" } : undefined,
      caption: sourceData.caption,
      bodyText: sourceData.bodyText,
      description: sourceData.description,
      title: undefined,
    });
    const unavailable = (reason: string): GroundedAIEnrichment => {
      provenance.aiProcessing = { value: { status: "failed", reason }, source: "verified_content_gate", basedOn: [], retrievedAt: now };
      return {
        summary: {
          quick: "Verified source content unavailable",
          standard: "Keeper did not generate AI analysis because verified source content was unavailable.",
          detailed: reason,
        },
        topics: [], category: "Uncategorized", keywords: [], tags: [], entities: [],
        contentIntent: "reference", searchableContext: "", keyPoints: [],
        confidence: 0, isSufficientContent: false, status: "INSUFFICIENT_CONTENT", provenance,
      };
    };

    if (isVideo && !transcript) {
      return unavailable("A video requires an independently verified source transcript. Captions in metadata, titles, creators, thumbnails, and URLs are not transcripts.");
    }
    if (representation.status !== "completed" || representation.text.trim().length < 30 || representation.source === "title" || representation.source === "none") {
      return unavailable(representation.failureReason || "Verified source text, transcript, or OCR content was not available in sufficient quantity.");
    }

    const analysis = await ContentAnalysisService.analyze(representation);
    const matches = CollectionMatchingService.match(representation.text, analysis.tags, existingCollections);
    const match = matches[0];
    const summarySource = "content_ai:" + analysis.model;
    provenance.contentRepresentation = { value: representation, source: "universal_content_normalizer", basedOn: [representation.source], retrievedAt: representation.generatedAt };
    provenance.summary = { value: analysis.summary.standard, source: summarySource, basedOn: analysis.summaryEvidence, retrievedAt: now };
    provenance.aiGeneratedTags = { value: analysis.tags, source: summarySource, basedOn: analysis.tags.map((tag) => tag.evidence), retrievedAt: now };
    provenance.assetClassification = { value: analysis.assetClassification, source: summarySource, basedOn: analysis.assetClassification.evidence, retrievedAt: now };
    provenance.collectionDecision = { value: match || null, source: "verified_content_collection_matcher", basedOn: analysis.tags.map((tag) => tag.name), retrievedAt: now };

    return {
      summary: analysis.summary,
      topics: analysis.topics,
      category: analysis.contentType,
      keywords: analysis.tags.map((tag) => tag.name),
      tags: analysis.tags.map((tag) => tag.name),
      entities: analysis.tags.filter((tag) => tag.category === "Person").map((tag) => tag.name),
      contentIntent: analysis.contentIntent,
      searchableContext: [representation.text, analysis.summary.standard, ...analysis.tags.map((tag) => tag.name)].join(" "),
      keyPoints: analysis.keyPoints.map((point) => point.text),
      suggestedCollectionName: match?.name,
      suggestedCollectionId: match?.collectionId,
      confidence: analysis.confidence,
      isSufficientContent: true,
      status: "FULL_CONTENT",
      provenance,
    };
  }

}
