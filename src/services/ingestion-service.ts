import {
  AuthoritativeSourceData,
  Collection,
  DuplicateStrategy,
  FieldProvenance,
  GroundedAIEnrichment,
  IngestionResult,
  SavedItem,
} from "@/types";
import { ProviderRegistry } from "./providers/provider-registry";
import { ContentService } from "./content-service";
import { StorageService } from "./storage-service";
import { MetadataNormalizer } from "./normalizer/metadata-normalizer";
import { ContentIntelligenceService } from "./content-intelligence";
import { CONTENT_PREVIEW_PLACEHOLDER } from "./media/content-placeholder";
import {
  InstagramThumbnailResolver,
} from "./media/instagram-thumbnail-resolver";
import {
  INSTAGRAM_REEL_PLACEHOLDER,
  INSTAGRAM_POST_PLACEHOLDER,
} from "./media/instagram-placeholders";

interface IngestionCacheEntry {
  result: IngestionResult;
  timestamp: number;
}

export class IngestionService {
  private static cache = new Map<string, IngestionCacheEntry>();
  private static CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache

  /**
   * Helper to sleep for exponential backoff
   */
  private static delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Creates a fast, reliable metadata-only enrichment without making external LLM calls.
   * Grounded strictly on retrieved authoritative metadata.
   */
  public static buildFastMetadataEnrichment(
    sourceData: AuthoritativeSourceData
  ): GroundedAIEnrichment {
    const now = new Date().toISOString();
    const provenance: Record<string, FieldProvenance> = {
      ...sourceData.provenance,
      summary: {
        value: "AI analysis pending verified content processing.",
        source: "processing_state",
        basedOn: [],
        retrievedAt: now,
      },
    };

    return {
      summary: { quick: "Processing", standard: "Keeper is extracting verified source content.", detailed: "AI analysis will appear after verified text, transcript, or OCR content is available." },
      topics: [],
      category: "Uncategorized",
      keywords: [],
      tags: [],
      entities: [],
      contentIntent: undefined,
      searchableContext: "",
      keyPoints: [],
      suggestedCollectionName: undefined,
      suggestedCollectionId: undefined,
      confidence: 0,
      isSufficientContent: false,
      status: "METADATA_ONLY",
      provenance,
    };
  }

  /**
   * Fallback enrichment created when AI enrichment fails or times out.
   * Ensures factual data is NEVER lost due to an AI failure.
   */
  public static buildFallbackEnrichment(
    sourceData: AuthoritativeSourceData,
    aiError: any
  ): GroundedAIEnrichment {
    const now = new Date().toISOString();
    const errorMsg = aiError instanceof Error ? aiError.message : String(aiError);

    const provenance: Record<string, FieldProvenance> = {
      ...sourceData.provenance,
      summary: {
        value: "AI processing has not completed.",
        source: "processing_failure",
        basedOn: [],
        retrievedAt: now,
      },
      aiError: {
        value: errorMsg,
        source: "enrichment_pipeline_failure",
        retrievedAt: now,
      },
    };

    return {
      summary: {
        quick: "Processing failed",
        standard: "Keeper could not complete verified content analysis. Retry processing to try again.",
        detailed: "No AI summary is shown until source text, a verified transcript, or OCR content has been processed successfully.",
      },
      topics: [],
      category: "Uncategorized",
      keywords: [],
      tags: [],
      entities: [],
      contentIntent: undefined,
      searchableContext: "",
      keyPoints: [],
      suggestedCollectionName: undefined,
      suggestedCollectionId: undefined,
      confidence: 0,
      isSufficientContent: false,
      status: "METADATA_ONLY",
      provenance,
    };
  }

  /**
   * Executes the complete deterministic 11-step ingestion pipeline.
   */
  public static async processUrl(
    inputUrl: string,
    options: {
      userId?: string;
      customCollectionId?: string;
      existingCollections?: Collection[];
      signal?: AbortSignal;
      skipPersistence?: boolean;
      bypassCache?: boolean;
      aiEnrichmentMode?: "full" | "fast_metadata";
      duplicateStrategy?: DuplicateStrategy;
      initialMetadata?: {
        title?: string;
        creatorName?: string;
        caption?: string;
        bodyText?: string;
        hashtags?: string[];
        fbid?: string;
        thumbnailUrl?: string;
        savedTimestamp?: number | string;
        collectionName?: string;
      };
    } = {}
  ): Promise<IngestionResult> {
    const trimmed = (inputUrl || "").trim();
    if (!trimmed) {
      throw new Error("URL cannot be empty.");
    }

    const registry = ProviderRegistry.getInstance();

    // 1. Identify Platform
    const provider = registry.getProviderForUrl(trimmed);
    const platform = registry.identifyPlatform(trimmed);

    // 2. Validate URL & 3. Canonicalize URL
    const validation = provider.validateAndCanonicalize(trimmed);
    if (!validation.isValid) {
      throw new Error(validation.error || `Invalid ${platform} URL provided.`);
    }

    const canonicalUrl = validation.canonicalUrl;
    const externalId = validation.contentId || "";
    const cacheKey = `${options.userId || "global"}:${platform}:${externalId || canonicalUrl}:${options.aiEnrichmentMode || "full"}`;

    // Check Memory Cache with strict identity isolation
    const cached = this.cache.get(cacheKey);
    if (!options.bypassCache && cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.result;
    }

    // 4. Duplicate Check (Check existing Keeper items for this user)
    const existing = ContentService.checkDuplicate(canonicalUrl, options.userId);

    // 5. Retrieve Platform-Authoritative Metadata (with bounded timeout & retry budget)
    const now = new Date().toISOString();
    let sourceData: AuthoritativeSourceData | null = null;
    let lastError: Error | null = null;
    const hasExportMetadata = Boolean(options.initialMetadata);

    // Latency budget: Bulk import with export metadata must be non-blocking.
    // If we already have authoritative export metadata, network enrichment is strictly optional.
    const maxRetries = hasExportMetadata ? 0 : 1;
    const timeoutMs = hasExportMetadata ? 2000 : 3500;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      let timeoutId: any;
      try {
        const timeoutController = new AbortController();
        timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

        // Chain caller signal if provided
        const onAbort = () => timeoutController.abort();
        if (options.signal) {
          if (options.signal.aborted) {
            timeoutController.abort();
          } else {
            options.signal.addEventListener("abort", onAbort, { once: true });
          }
        }

        try {
          sourceData = await provider.fetchAuthoritativeData(canonicalUrl, timeoutController.signal);
        } finally {
          clearTimeout(timeoutId);
          if (options.signal) {
            options.signal.removeEventListener("abort", onAbort);
          }
        }
        break; // Success
      } catch (err: any) {
        lastError = err instanceof Error ? err : new Error(String(err));
        if (attempt < maxRetries) {
          await this.delay(300 * Math.pow(2, attempt));
        }
      }
    }

    if (!sourceData) {
      if (options.initialMetadata) {
        // NON-FATAL ENRICHMENT BOUNDARY:
        // Valid user export record must NEVER fail to save merely because optional remote enrichment timed out or failed.
        console.warn(
          `[IngestionService] Remote metadata enrichment timed out or failed for ${canonicalUrl}; degrading gracefully with export metadata:`,
          lastError?.message
        );

        const exportCreator = options.initialMetadata.creatorName
          ? MetadataNormalizer.normalizeText(options.initialMetadata.creatorName)
          : undefined;
        const creatorHandle = exportCreator?.startsWith("@") ? exportCreator : undefined;

        const exportCaption = options.initialMetadata.caption
          ? MetadataNormalizer.normalizeText(options.initialMetadata.caption)
          : undefined;
        const exportBody = options.initialMetadata.bodyText
          ? MetadataNormalizer.normalizeText(options.initialMetadata.bodyText)
          : exportCaption;

        const isReel = validation.contentType === "reel" || canonicalUrl.includes("/reel/") || canonicalUrl.includes("/reels/");
        const fallbackThumb = platform === "instagram"
          ? (isReel ? INSTAGRAM_REEL_PLACEHOLDER : INSTAGRAM_POST_PLACEHOLDER)
          : CONTENT_PREVIEW_PLACEHOLDER;

        const hasAuthenticExportThumb =
          options.initialMetadata.thumbnailUrl &&
          InstagramThumbnailResolver.isAuthenticMediaUrl(options.initialMetadata.thumbnailUrl);

        const effectiveThumb = hasAuthenticExportThumb
          ? options.initialMetadata.thumbnailUrl!
          : fallbackThumb;

        const exportTitle = options.initialMetadata.title
          ? MetadataNormalizer.normalizeText(options.initialMetadata.title)
          : (exportCaption
              ? MetadataNormalizer.deriveDisplayTitleFromCaption(
                  exportCaption,
                  exportCreator || "",
                  platform === "instagram" ? "Instagram" : platform,
                  isReel ? "Reel" : "Post"
                )
              : `Untitled ${validation.contentType || "content"}`);

        const fallbackProvenance: Record<string, FieldProvenance> = {
          canonicalUrl: { value: canonicalUrl, source: `${platform}_canonicalizer`, retrievedAt: now },
          creator: { value: exportCreator || null, source: options.initialMetadata.creatorName ? `${platform}_export_metadata` : "unavailable", retrievedAt: now },
          title: { value: exportTitle, source: options.initialMetadata.title ? `${platform}_export_metadata` : "generated_placeholder", retrievedAt: now },
          thumbnail: {
            value: effectiveThumb,
            source: hasAuthenticExportThumb ? `${platform}_export_metadata` : "fallback_preview",
            retrievedAt: now,
          },
        };

        if (exportCaption) {
          fallbackProvenance.caption = { value: exportCaption, source: "instagram_export_metadata", retrievedAt: now };
        }

        sourceData = {
          platform,
          canonicalUrl,
          contentId: externalId,
          creator: {
            name: exportCreator || "",
            ...(creatorHandle ? { handle: creatorHandle } : {}),
            status: exportCreator ? "active" : "unknown",
          },
          title: exportTitle,
          caption: exportCaption,
          description: exportCaption || "",
          bodyText: exportBody || "",
          thumbnailUrl: effectiveThumb,
          contentType: isReel ? "reel" : validation.contentType,
          retrievedAt: now,
          isRestricted: true,
          restrictionReason: "Remote enrichment timed out or was unavailable; preserved authoritative export metadata.",
          provenance: fallbackProvenance,
        };
      } else {
        // Persist the valid canonical URL and an explicit extraction failure so
        // source outages never discard the user's save or invent source facts.
        const extractionFailure = lastError?.message || `No source extractor returned content for ${platform}.`;
        const contentType = validation.contentType || "other";
        const failureTitle = `Untitled ${contentType}`;
        sourceData = {
          platform, canonicalUrl, contentId: externalId,
          creator: { name: "", status: "unknown" },
          title: failureTitle, caption: "", description: "", bodyText: "",
          thumbnailUrl: CONTENT_PREVIEW_PLACEHOLDER,
          contentType, retrievedAt: now, isRestricted: true, restrictionReason: extractionFailure,
          provenance: {
            canonicalUrl: { value: canonicalUrl, source: `${platform}_canonicalizer`, retrievedAt: now },
            extraction: { value: { status: "failed", reason: extractionFailure }, source: "platform_adapter", retrievedAt: now },
            title: { value: failureTitle, source: "generated_placeholder", retrievedAt: now },
            thumbnail: { value: CONTENT_PREVIEW_PLACEHOLDER, source: "fallback_preview", retrievedAt: now },
          },
        };
      }
    }

    // 6. Merge export authoritative metadata (Export data ALWAYS takes precedence over weaker network scraping)
    if (options.initialMetadata) {
      const exportCaption = options.initialMetadata.caption
        ? MetadataNormalizer.normalizeText(options.initialMetadata.caption)
        : undefined;

      const exportCreator = options.initialMetadata.creatorName
        ? MetadataNormalizer.normalizeText(options.initialMetadata.creatorName)
        : undefined;

      const isReel =
        sourceData.contentType === "reel" ||
        canonicalUrl.includes("/reel/") ||
        canonicalUrl.includes("/reels/");

      const exportTitle = options.initialMetadata.title
        ? MetadataNormalizer.normalizeText(options.initialMetadata.title)
        : (exportCaption
            ? MetadataNormalizer.deriveDisplayTitleFromCaption(
                exportCaption,
                exportCreator || sourceData.creator?.name || "Instagram",
                sourceData.platform === "instagram" ? "Instagram" : sourceData.platform,
                isReel ? "Reel" : "Post"
              )
            : undefined);

      const isGenericTitle =
        !sourceData.title ||
        sourceData.title.startsWith("Instagram Post •") ||
        sourceData.title.startsWith("Instagram Reel •");

      // Authoritative creator from Meta export ALWAYS wins
      if (exportCreator) {
        const handle = exportCreator.startsWith("@") ? exportCreator : `@${exportCreator.replace(/^@/, "")}`;
        sourceData.creator = {
          ...sourceData.creator,
          name: handle,
          handle,
          username: handle.replace(/^@/, ""),
          displayName: handle,
        };
        sourceData.provenance.creator = {
          value: handle,
          source: "instagram_export_metadata",
          retrievedAt: now,
        };
      }

      // Authoritative caption from Meta export ALWAYS wins
      if (exportCaption) {
        sourceData.caption = exportCaption;
        sourceData.description = exportCaption;
        sourceData.bodyText = exportCaption;
        sourceData.provenance.caption = {
          value: exportCaption,
          source: `${platform}_export_metadata`,
          retrievedAt: now,
        };
      }

      if (exportTitle && (sourceData.isRestricted || isGenericTitle || !sourceData.title)) {
        sourceData.title = exportTitle;
        if (!sourceData.description || sourceData.description.includes("saved to Keeper")) {
          sourceData.description = exportCaption || exportTitle;
        }
        sourceData.provenance.title = {
          value: exportTitle,
          source: `${platform}_export_metadata`,
          retrievedAt: now,
        };
      }
    }

    // Ensure Instagram items always route through unified authentic thumbnail resolver
    if (sourceData.platform === "instagram") {
      try {
        const thumbResult = await InstagramThumbnailResolver.resolveInstagramThumbnail({
          canonicalUrl: sourceData.canonicalUrl,
          shortcode: sourceData.contentId || undefined,
          isReel: sourceData.contentType === "reel",
          exportMetadata: options.initialMetadata,
          // The provider already validates thumbnail candidates against the
          // Instagram media URL policy and records whether one came from an
          // authentic source. Pass that verdict into the canonical resolver;
          // otherwise the resolver silently discarded every provider image
          // and replaced it with the branded placeholder.
          providerMetadata: {
            ...sourceData,
            hasAuthenticThumb:
              sourceData.provenance.thumbnail?.source !== "fallback_preview" &&
              InstagramThumbnailResolver.isAuthenticMediaUrl(sourceData.thumbnailUrl),
          },
          signal: options.signal,
        });

        sourceData.thumbnailUrl = thumbResult.url;
        sourceData.provenance.thumbnail = {
          value: thumbResult.url,
          source:
            thumbResult.source === "fallback"
              ? "fallback_preview"
              : thumbResult.source === "export" || thumbResult.source === "export_archive"
              ? "instagram_export_metadata"
              : thumbResult.source,
          retrievedAt: now,
        };
      } catch (thumbErr) {
        console.warn(`[IngestionService] Thumbnail resolution failed gracefully for ${canonicalUrl}:`, thumbErr);
        const fallbackUrl = sourceData.contentType === "reel" ? INSTAGRAM_REEL_PLACEHOLDER : INSTAGRAM_POST_PLACEHOLDER;
        sourceData.thumbnailUrl = fallbackUrl;
        sourceData.provenance.thumbnail = {
          value: fallbackUrl,
          source: "fallback_preview",
          retrievedAt: now,
        };
      }
    } else if (options.initialMetadata?.thumbnailUrl) {
      const exportThumbnail = options.initialMetadata.thumbnailUrl.trim();
      if (exportThumbnail.length > 0) {
        sourceData.thumbnailUrl = exportThumbnail;
        sourceData.provenance.thumbnail = {
          value: exportThumbnail,
          source: "instagram_export_metadata",
          retrievedAt: now,
        };
      }
    }

    // Media transcription and full AI analysis run from durable background jobs.
    // Keep the import request metadata-only so slow models cannot fail an import.

    // 8. Metadata enrichment (grounded strictly on retrieved source facts)
    const collections = options.existingCollections || StorageService.getCollections(options.userId);
    const enrichment = this.buildFastMetadataEnrichment(sourceData);

    const trustedTranscriptProviders = new Set([
      "openai-audio-transcriptions", "faster-whisper", "platform_caption_track", "youtube_caption_track", "speech_to_text",
    ]);
    const transcriptProvider = sourceData.provenance.transcript?.source;
    const verifiedTranscript = typeof transcriptProvider === "string" && trustedTranscriptProviders.has(transcriptProvider)
      ? sourceData.transcript
      : undefined;
    const contentRepresentation = ContentIntelligenceService.normalizeRepresentation({
      sourceTranscript: verifiedTranscript,
      caption: sourceData.caption,
      bodyText: sourceData.bodyText,
      description: sourceData.description,
      title: undefined,
    });
    const hasVerifiedSourceText = contentRepresentation.status === "completed"
      && contentRepresentation.text.trim().length >= 30
      && ["transcription", "platform_transcript", "post_body", "caption", "ocr_text", "description"].includes(contentRepresentation.source);
    const contentStatus = hasVerifiedSourceText
      ? (contentRepresentation.type === "transcript" ? "FULL_CONTENT" : "PARTIAL_CONTENT")
      : "METADATA_ONLY";
    const preservedUserTags = Array.isArray(existing?.metadata?.userTags)
      ? existing.metadata.userTags.filter((tag: unknown): tag is string => typeof tag === "string")
      : [];
    enrichment.tags = preservedUserTags;
    enrichment.keywords = preservedUserTags;
    enrichment.topics = [];
    enrichment.provenance.contentRepresentation = {
      value: contentRepresentation,
      source: "universal_content_normalizer",
      basedOn: [contentRepresentation.source],
      retrievedAt: contentRepresentation.generatedAt,
    };
    enrichment.provenance.aiGeneratedTags = {
      value: [],
      source: "awaiting_verified_ai_analysis",
      basedOn: [contentRepresentation.source],
      retrievedAt: contentRepresentation.generatedAt,
    };

    // 9. Validation & 10. Categorization (Principled matching; never force collections[0])
    const matchingCol = options.initialMetadata?.collectionName
      ? collections.find((c) => c.name.toLowerCase() === options.initialMetadata?.collectionName?.toLowerCase())
      : undefined;

    const targetCollectionId =
      options.customCollectionId ||
      matchingCol?.id ||
      enrichment.suggestedCollectionId ||
      undefined;

    // 11. Database Persistence / SavedItem Assembly
    let parsedSavedDate: string | undefined = undefined;
    if (options.initialMetadata?.savedTimestamp !== undefined) {
      const rawTs = options.initialMetadata.savedTimestamp;
      if (typeof rawTs === "number" && !isNaN(rawTs)) {
        parsedSavedDate = new Date(rawTs < 1e11 ? rawTs * 1000 : rawTs).toISOString();
      } else if (typeof rawTs === "string" && rawTs.trim().length > 0) {
        const asNum = Number(rawTs);
        if (!isNaN(asNum) && asNum > 0) {
          parsedSavedDate = new Date(asNum < 1e11 ? asNum * 1000 : asNum).toISOString();
        } else {
          const parsed = new Date(rawTs);
          if (!isNaN(parsed.getTime())) {
            parsedSavedDate = parsed.toISOString();
          }
        }
      }
    }

    const effectiveSavedDate =
      existing?.savedDate ||
      parsedSavedDate ||
      now;

    const rawSavedItem: SavedItem = {
      id: existing?.id || `save-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      title: sourceData.provenance.title?.source === "url_parse" ? "Saved source" : sourceData.title,
      url: sourceData.canonicalUrl,
      thumbnail: sourceData.thumbnailUrl,
      platform: sourceData.platform,
      contentType: sourceData.contentType,
      creator: sourceData.creator,
      community: sourceData.community,
      description: sourceData.description || "",
      savedDate: effectiveSavedDate,
      collectionId: targetCollectionId,
      collections: targetCollectionId ? [targetCollectionId] : [],
      tags: enrichment.tags,
      favorite: existing?.favorite || false,
      archived: existing?.archived || false,
      trashed: existing?.trashed || false,
      aiSummary: enrichment.summary,
      keyPoints: enrichment.keyPoints,
      topics: enrichment.topics,
      personalNotes: existing?.personalNotes || "",
      metadata: {
        domain: validation.normalizedUrl.split("/")[0] || `${sourceData.platform}.com`,
        canonicalUrl: sourceData.canonicalUrl,
        originalUrl: trimmed,
        sourcePlatform: sourceData.platform,
        sourceIdentifier: sourceData.contentId,
        publishedAt: sourceData.publishedAt,
        duration: sourceData.duration,
        views: sourceData.viewCount,
        likes: sourceData.likeCount,
        comments: sourceData.commentCount,
        mediaUrl: sourceData.mediaUrl,
        suggestedCollectionName: enrichment.suggestedCollectionName || options.initialMetadata?.collectionName,
        caption: sourceData.caption,
        bodyText: sourceData.bodyText,
        transcript: sourceData.transcript,
        contentRepresentation,
      aiGeneratedTags: [],
        extractionStatus: sourceData.provenance.extraction ? "failed" : "completed",
        contentIntent: enrichment.contentIntent,
        evidenceLevel: contentStatus === "FULL_CONTENT" ? "TRANSCRIBED" : (contentStatus === "PARTIAL_CONTENT" ? "TEXT_CONTENT" : "METADATA_ONLY"),
        fbid: options.initialMetadata?.fbid,
        hashtags: options.initialMetadata?.hashtags,
        thumbnailSource:
          sourceData.provenance.thumbnail?.source === "fallback_preview"
            ? "fallback"
            : (sourceData.provenance.thumbnail?.source === "instagram_export_metadata"
                ? "export"
                : (sourceData.provenance.thumbnail?.source === "media_frame"
                    ? "media_frame"
                    : (sourceData.provenance.thumbnail?.source === "cache"
                        ? "cache"
                        : "provider"))),
      },
      contentStatus,
      isLimited: !enrichment.isSufficientContent,
      limitedReason: sourceData.restrictionReason,
      provenance: {
        ...sourceData.provenance,
        ...enrichment.provenance,
      },
    };

    const savedItem: SavedItem = existing
      ? ContentService.safeMerge(existing, rawSavedItem)
      : rawSavedItem;

    if (!options.skipPersistence) {
      ContentService.addItem(savedItem, options.userId, options.duplicateStrategy || "skip");
    }

    const result: IngestionResult = {
      sourceData,
      aiEnrichment: enrichment,
      savedItem,
    };

    // Update Cache
    if (!options.bypassCache) this.cache.set(cacheKey, { result, timestamp: Date.now() });

    return result;
  }
}
