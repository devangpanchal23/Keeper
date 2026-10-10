import {
  Collection,
  ItemOrganizationResult,
  OrganizationCluster,
  OrganizationDecision,
  OrganizationIntent,
  OrganizationJobReport,
  OrganizeItemsOptions,
  ResourceAction,
  SavedItem,
} from "@/types";
import { StorageService } from "./storage-service";
import { ContentService } from "./content-service";
import { TranscriptionService } from "./media/transcription-service";
import { VisualTextService } from "./media/visual-text-service";
import { EvidenceFusionService, ContentEvidence } from "./evidence/evidence-fusion-service";
import { ContentIntelligenceService } from "./content-intelligence";
import { CollectionMatchingService } from "./collection-matching-service";
import { MediaAcquisitionService } from "./media/media-acquisition-service";

export interface OrganizeBatchParams {
  itemIds: string[];
  userId: string;
  options?: OrganizeItemsOptions;
  onProgress?: (progress: { processed: number; total: number; currentItem?: string }) => void;
}

export class CollectionOrganizerService {
  /**
   * High-confidence trigger phrases for RESOURCE_ACQUISITION
   */
  private static readonly RESOURCE_TRIGGERS: { regex: RegExp; action: ResourceAction["action"] }[] = [
    { regex: /\bcomment\s+['"‘“]?([A-Z0-9_\-]+)['"’”]?\b/i, action: "comment" },
    { regex: /\bdm\s+(?:me\s+)?['"‘“]?([A-Z0-9_\-]+)['"’”]?\b/i, action: "dm" },
    { regex: /\b(?:send\s+you\s+this|send\s+you\s+the|download\s+the)\s+([a-zA-Z0-9_\-\s]{3,20}?)(?:\s+template|\s+pack|\s+preset|\s+guide|\s+asset|\s+link)/i, action: "comment" },
    { regex: /\b(?:free|get\s+the)\s+(figma\s+template|ui\s+kit|preset\s+pack|asset\s+pack|project\s+files)\b/i, action: "download" },
    { regex: /\blink\s+in\s+bio\s+for\s+([a-zA-Z0-9_\-\s]{3,20})/i, action: "link" },
  ];

  /**
   * Analyzes an individual SavedItem using multimodal evidence:
   * 1. Reuses existing transcript if present (Cost Control) or acquires/transcribes
   * 2. Extracts visual OCR text if accessible
   * 3. Synthesizes multimodal ContentEvidence
   * 4. Determines semantic intent, primary topic, and call-to-action triggers
   * 5. Matches against user's existing collections with hierarchical specificity
   * 6. Gates confidence (HIGH -> APPLIED / AUTO_ASSIGNED, MEDIUM -> SUGGESTED, LOW -> UNCERTAIN)
   */
  public static async analyzeItem(
    itemOrEvidence: SavedItem | any,
    existingCollections: Collection[] = [],
    options: OrganizeItemsOptions = {}
  ): Promise<ItemOrganizationResult> {
    const {
      highConfidenceThreshold = 0.70,
      mediumConfidenceThreshold = 0.45,
    } = options;

    // Adapt raw evidence object into a SavedItem if needed
    const item: SavedItem = (itemOrEvidence && itemOrEvidence.id && itemOrEvidence.url)
      ? (itemOrEvidence as SavedItem)
      : {
          id: (itemOrEvidence as any)?.id || "evidence-item",
          url: (itemOrEvidence as any)?.url || "https://instagram.com/reel/evidence/",
          title: (itemOrEvidence as any)?.title || (itemOrEvidence as any)?.originalCaption || "Evidence Item",
          description: (itemOrEvidence as any)?.description || (itemOrEvidence as any)?.originalCaption || "",
          platform: (itemOrEvidence as any)?.platform || (itemOrEvidence as any)?.sourcePlatform || "instagram",
          contentType: (itemOrEvidence as any)?.contentType || "reel",
          creator: typeof (itemOrEvidence as any)?.creator === "string"
            ? { name: (itemOrEvidence as any).creator }
            : ((itemOrEvidence as any)?.creator || { name: "creator" }),
          tags: (itemOrEvidence as any)?.tags || (itemOrEvidence as any)?.hashtags || [],
          topics: (itemOrEvidence as any)?.topics || [],
          collections: (itemOrEvidence as any)?.collections || [],
          favorite: false,
          archived: false,
          trashed: false,
          thumbnail: typeof (itemOrEvidence as any)?.thumbnailUrl === "string" ? (itemOrEvidence as any).thumbnailUrl : "",
          aiSummary: { quick: "", standard: "", detailed: "" },
          keyPoints: [],
          personalNotes: "",
          isLimited: false,
          metadata: {
            ...((itemOrEvidence as any)?.metadata || {}),
            transcript: (itemOrEvidence as any)?.transcript,
            caption: (itemOrEvidence as any)?.originalCaption,
          },
          savedDate: (itemOrEvidence as any)?.savedDate || new Date().toISOString(),
          provenance: (itemOrEvidence as any)?.provenance || {},
        };

    // 1. Transcription (Reuses existing stored transcript or acquires safely)
    const transcriptResult = await TranscriptionService.transcribeItem(item);
    const transcriptStatus = transcriptResult.status;
    const rawTranscript = transcriptResult.status === "transcribed" ? transcriptResult.text : "";
    const transcriptText = rawTranscript.trim();

    // 2. Visual OCR text extraction
    const actualMediaUrl = typeof item.metadata?.mediaUrl === "string" ? item.metadata.mediaUrl : undefined;
    const visualMedia = actualMediaUrl ? await MediaAcquisitionService.acquireMedia({
      url: item.url,
      platform: item.platform,
      contentId: `organize:${item.metadata?.shortcode || item.id}`,
      mediaUrl: actualMediaUrl,
    }) : undefined;
    const visualResult = await VisualTextService.extractVisualText({
      contentId: `organize:${item.metadata?.shortcode || item.id}`,
      mediaResult: visualMedia,
    });
    const visualText = visualResult.status === "analyzed" ? visualResult.visualText : "";

    // 3. Multimodal Evidence Fusion
    const evidence: ContentEvidence = EvidenceFusionService.fuseEvidence({
      sourceData: {
        platform: item.platform,
        canonicalUrl: item.url,
        contentId: item.metadata?.shortcode || item.id,
        creator: item.creator,
        title: item.title,
        caption: item.metadata?.caption || item.description,
        description: item.description,
        transcript: transcriptText,
        thumbnailUrl: item.thumbnail,
        contentType: item.contentType,
        retrievedAt: new Date().toISOString(),
        isRestricted: item.isLimited || false,
        provenance: item.provenance || {},
      },
      transcription: transcriptResult,
      visualResult,
    });

    // 4. Semantic Intent & Topic Extraction
    const storedRepresentation = item.metadata?.contentRepresentation as { type?: string; source?: string; status?: string; text?: string; transcript?: string } | undefined;
    const allowedRepresentationSources = new Set(["transcription", "platform_transcript", "post_body", "caption", "description"]);
    const representation = ContentIntelligenceService.normalizeRepresentation({
      transcript: transcriptResult.status === "transcribed" ? transcriptResult : undefined,
      sourceTranscript: storedRepresentation?.status === "completed" && storedRepresentation.source === "platform_transcript" ? storedRepresentation.transcript : undefined,
      bodyText: typeof item.metadata?.bodyText === "string" ? item.metadata.bodyText : undefined,
      caption: typeof item.metadata?.caption === "string" ? item.metadata.caption : undefined,
      description: item.description,
      ocrText: visualText,
      title: undefined,
    });
    const representationText = representation.status === "completed"
      && allowedRepresentationSources.has(representation.source)
      ? representation.text
      : "";
    const isVideo = ["video", "reel", "short"].includes(item.contentType) || item.platform === "youtube-shorts";
    const verifiedTranscript = transcriptStatus === "transcribed" ? transcriptText :
      storedRepresentation?.status === "completed" && storedRepresentation.source === "platform_transcript" ? storedRepresentation.transcript || "" : "";
    const verifiedText = isVideo
      ? verifiedTranscript
      : [representationText, visualText].filter(Boolean).join("\n\n");
    const persistedGroundedTags = verifiedText.length >= 30 && Array.isArray(item.metadata?.aiGeneratedTags)
      ? item.metadata.aiGeneratedTags.flatMap((raw: unknown) => {
          if (!raw || typeof raw !== "object") return [];
          const tag = raw as { name?: unknown; evidence?: unknown; normalizedName?: unknown };
          if (typeof tag.name !== "string" || typeof tag.evidence !== "string" || !verifiedText.toLowerCase().includes(tag.evidence.toLowerCase())) return [];
          return [{ name: tag.name, normalizedName: typeof tag.normalizedName === "string" ? tag.normalizedName : tag.name.toLowerCase(), category: "Topic" as const, confidence: 1, source: "ai" as const, evidence: tag.evidence }];
        })
      : [];
    // Organizing a verified transcript should still work when the background
    // AI analysis has not populated persisted tags yet. These tags are derived
    // locally from the same verified text and carry exact source evidence.
    const groundedTags = persistedGroundedTags.length > 0
      ? persistedGroundedTags
      : verifiedText.length >= 30
        ? ContentIntelligenceService.generateTags(verifiedText)
        : [];
    const combinedContext = verifiedText.length >= 30 ? verifiedText : "";

    const { intent, resourceAction } = this.detectIntentAndActions(combinedContext);
    const primaryTopic = groundedTags[0]?.name || "";
    const secondaryTopics = groundedTags.slice(1, 5).map((tag) => tag.name);

    // 5. Collection Matching with Hierarchical Specificity & Existing Collection Preference
    const groundedMatches = combinedContext ? CollectionMatchingService.match(combinedContext, groundedTags, existingCollections) : [];
    const matchCandidate = groundedMatches[0];
    const match = matchCandidate ? {
      collection: existingCollections.find((collection) => collection.id === matchCandidate.collectionId),
      confidence: matchCandidate.confidence,
    } : null;

    // 6. Confidence Gating
    let decision: OrganizationDecision | "APPLIED" = "UNCERTAIN";
    let targetCollectionId: string | undefined = undefined;
    let targetCollectionName: string | undefined = undefined;
    const isNewCollection = false;

    if (match && match.collection && match.confidence >= highConfidenceThreshold) {
      decision = "APPLIED";
      targetCollectionId = match.collection.id;
      targetCollectionName = match.collection.name;
    } else if (match && match.collection && match.confidence >= mediumConfidenceThreshold) {
      decision = "SUGGESTED";
      targetCollectionId = match.collection.id;
      targetCollectionName = match.collection.name;
    } else {
      decision = "UNCERTAIN";
      targetCollectionName = undefined;
    }

    const confidenceScore = match?.collection ? match.confidence : 0;

    return {
      itemId: item.id,
      savedItemId: item.id,
      title: item.title,
      url: item.url,
      platform: item.platform,
      transcriptionStatus: transcriptStatus,
      transcription: {
        status: transcriptStatus,
        text: transcriptText,
        language: transcriptResult.language,
      },
      transcriptText: transcriptText || undefined,
      language: transcriptResult.language,
      visualText: visualText || undefined,
      evidenceLevel: evidence.evidenceLevel,
      primaryTopic,
      secondaryTopics,
      intent,
      resourceAction,
      targetCollectionId,
      targetCollectionName,
      isNewCollection,
      confidence: confidenceScore,
      collectionMatch: {
        collection: match?.collection,
        collectionId: match?.collection?.id,
        suggestedCollectionName: match?.collection?.name,
        confidence: confidenceScore,
      },
      analysis: {
        intent,
        primaryTopic,
        secondaryTopics,
        resourceAction,
      },
      decision,
      reasoning: match?.collection
        ? `Matched existing collection '${match.collection.name}' (${Math.round(confidenceScore * 100)}% confidence) based on ${intent} intent and topic '${primaryTopic}'.`
      : combinedContext ? "Verified content did not strongly match an existing collection." : "Verified source content unavailable; organization was not performed.",
      status: combinedContext ? "completed" : "failed",
      ...(!combinedContext ? { error: "Verified source content unavailable. Retry extraction or transcription before organizing." } : {}),
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * High-accuracy intent and call-to-action trigger detection.
   */
  public static detectIntentAndActions(text: string): {
    intent: OrganizationIntent;
    resourceAction?: ResourceAction;
  } {
    const lower = text.toLowerCase();

    // 1. RESOURCE_ACQUISITION check
    for (const { regex, action } of this.RESOURCE_TRIGGERS) {
      const match = text.match(regex);
      if (match) {
        let trigger = match[1]?.trim().toUpperCase();
        if (trigger && trigger.length > 20) {
          trigger = trigger.substring(0, 20).trim();
        }
        return {
          intent: "RESOURCE_ACQUISITION",
          resourceAction: {
            action,
            trigger: trigger || undefined,
            confidence: 0.92,
          },
        };
      }
    }

    // Secondary phrase checks for resource distribution
    if (
      lower.includes("comment asset") ||
      lower.includes("comment preset") ||
      lower.includes("comment template") ||
      lower.includes("comment figma") ||
      lower.includes("send the template") ||
      lower.includes("send you this template") ||
      lower.includes("comment link")
    ) {
      const wordMatch = lower.match(/comment\s+([a-z0-9_-]+)/i);
      return {
        intent: "RESOURCE_ACQUISITION",
        resourceAction: {
          action: "comment",
          trigger: wordMatch ? wordMatch[1].toUpperCase() : "TEMPLATE",
          confidence: 0.94,
        },
      };
    }

    // 2. LEARNING / TECHNICAL check (prioritized for programming & tech deep-dives)
    if (
      lower.includes("react") ||
      lower.includes("architecture") ||
      lower.includes("compiler") ||
      lower.includes("deep dive") ||
      lower.includes("under the hood") ||
      lower.includes("agentic") ||
      lower.includes("large language model") ||
      lower.includes("next.js") ||
      lower.includes("hooks") ||
      lower.includes("frontend")
    ) {
      return { intent: "LEARNING" };
    }

    // 3. TUTORIAL check (how-to guides, speed ramping, editing workflows)
    if (
      lower.includes("speed ramp") ||
      lower.includes("transition") ||
      lower.includes("how to") ||
      lower.includes("tutorial") ||
      lower.includes("step by step") ||
      lower.includes("workflow") ||
      lower.includes("build this") ||
      lower.includes("here's how") ||
      lower.includes("guide to") ||
      lower.includes("make this transition") ||
      lower.includes("premiere pro transition")
    ) {
      return { intent: "TUTORIAL" };
    }

    // 4. BUSINESS check
    if (
      lower.includes("saas") ||
      lower.includes("mrr") ||
      lower.includes("pricing") ||
      lower.includes("startup") ||
      lower.includes("revenue") ||
      lower.includes("business idea")
    ) {
      return { intent: "BUSINESS" };
    }

    // 5. INSPIRATION check
    if (
      lower.includes("ui design") ||
      lower.includes("micro-interaction") ||
      lower.includes("animation") ||
      lower.includes("typography") ||
      lower.includes("dark mode")
    ) {
      return { intent: "INSPIRATION" };
    }

    // 6. NEWS check
    if (
      lower.includes("6x1") ||
      lower.includes("jornada de trabalho") ||
      lower.includes("labor rights") ||
      lower.includes("breaking") ||
      lower.includes("clt")
    ) {
      return { intent: "NEWS" };
    }

    return { intent: "RESOURCE" };
  }

  /**
   * Topic hierarchy extractor establishing semantic domains and specific subtopics.
   */
  public static extractTopicHierarchy(
    text: string,
    intent: OrganizationIntent
  ): { primaryTopic: string; secondaryTopics: string[] } {
    const lower = text.toLowerCase();

    // Video Editing / Motion Design
    if (
      lower.includes("premiere") ||
      lower.includes("video edit") ||
      lower.includes("after effects") ||
      lower.includes("capcut") ||
      lower.includes("davinci") ||
      lower.includes("transition") ||
      lower.includes("speed ramp")
    ) {
      const secondary: string[] = [];
      if (lower.includes("premiere")) secondary.push("Premiere Pro");
      if (lower.includes("after effects")) secondary.push("After Effects");
      if (lower.includes("transition") || lower.includes("speed ramp")) secondary.push("Transitions");
      return { primaryTopic: "Video Editing", secondaryTopics: secondary };
    }

    // AI & Automation
    if (
      lower.includes("n8n") ||
      lower.includes("make.com") ||
      lower.includes("zapier") ||
      (lower.includes("automation") && (lower.includes("workflow") || lower.includes("build"))) ||
      lower.includes("ai agent") ||
      lower.includes("agentic")
    ) {
      const secondary: string[] = ["Workflow Automation"];
      if (lower.includes("n8n")) secondary.push("n8n");
      if (lower.includes("make.com")) secondary.push("Make.com");
      if (lower.includes("agent")) secondary.push("AI Agents");
      return { primaryTopic: "AI & Automation", secondaryTopics: secondary };
    }

    // React / Frontend
    if (
      lower.includes("react") ||
      lower.includes("next.js") ||
      lower.includes("hooks") ||
      lower.includes("frontend") ||
      lower.includes("typescript")
    ) {
      const secondary: string[] = ["Web Development"];
      if (lower.includes("hooks")) secondary.push("React Hooks");
      if (lower.includes("next.js")) secondary.push("Next.js");
      return { primaryTopic: "React Learning", secondaryTopics: secondary };
    }

    // Culinary / Baking / Food
    if (
      lower.includes("sourdough") ||
      lower.includes("baking") ||
      lower.includes("bread") ||
      lower.includes("recipe") ||
      lower.includes("cooking") ||
      lower.includes("kitchen") ||
      lower.includes("food")
    ) {
      return { primaryTopic: "Baking & Cooking", secondaryTopics: ["Recipes", "Food"] };
    }

    // Tools / Utilities
    if (
      lower.includes("vscode") ||
      lower.includes("tools") ||
      lower.includes("toolkit") ||
      lower.includes("extension") ||
      lower.includes("extensions") ||
      lower.includes("utilities")
    ) {
      return { primaryTopic: "Useful Tools", secondaryTopics: ["Developer Tools"] };
    }

    // Design / UI Kits / Templates
    if (
      lower.includes("figma") ||
      lower.includes("ui kit") ||
      lower.includes("design system") ||
      lower.includes("template") ||
      lower.includes("preset") ||
      intent === "RESOURCE_ACQUISITION"
    ) {
      return {
        primaryTopic: intent === "RESOURCE_ACQUISITION" ? "Resources & Assets" : "UI Inspiration",
        secondaryTopics: ["Templates", "Design Tools"],
      };
    }

    // Business & Startups
    if (
      lower.includes("saas") ||
      lower.includes("startup") ||
      lower.includes("mrr") ||
      lower.includes("pricing") ||
      lower.includes("business")
    ) {
      return { primaryTopic: "Business Ideas", secondaryTopics: ["Startups", "Pricing"] };
    }

    // Travel & Transit
    if (
      lower.includes("railway") ||
      lower.includes("train") ||
      lower.includes("travel") ||
      lower.includes("itinerary")
    ) {
      return { primaryTopic: "Travel", secondaryTopics: ["Transit Guides", "Itineraries"] };
    }

    // Default
    return { primaryTopic: "General Knowledge", secondaryTopics: [] };
  }

  /**
   * Match against user's existing collections.
   * STRICTLY prefers matching appropriate existing collections rather than creating duplicates.
   * Supports both params object and evidence + analysis argument formats.
   */
  public static matchCollection(
    paramsOrEvidence: any,
    collections: Collection[] = [],
    analysis?: any
  ): {
    collection: Collection;
    confidence: number;
    collectionId?: string;
    suggestedCollectionName?: string;
  } {
    if (!collections || collections.length === 0) {
      return {
        collection: null as any,
        confidence: 0,
        collectionId: undefined,
        suggestedCollectionName: undefined,
      };
    }

    // Normalize input arguments
    const combinedContext = (
      paramsOrEvidence?.combinedContext ||
      [
        paramsOrEvidence?.title,
        paramsOrEvidence?.originalCaption,
        paramsOrEvidence?.description,
        paramsOrEvidence?.transcript,
        ...(paramsOrEvidence?.hashtags || []),
        ...(paramsOrEvidence?.tags || []),
      ]
        .filter(Boolean)
        .join(" ")
    );

    const intent: OrganizationIntent =
      analysis?.intent ||
      paramsOrEvidence?.intent ||
      this.detectIntentAndActions(combinedContext).intent;

    const topicInfo =
      analysis?.primaryTopic
        ? { primaryTopic: analysis.primaryTopic, secondaryTopics: analysis.secondaryTopics || [] }
        : paramsOrEvidence?.primaryTopic
        ? { primaryTopic: paramsOrEvidence.primaryTopic, secondaryTopics: paramsOrEvidence.secondaryTopics || [] }
        : this.extractTopicHierarchy(combinedContext, intent);

    const primaryTopic = topicInfo.primaryTopic;
    const secondaryTopics = topicInfo.secondaryTopics;

    const contextLower = combinedContext.toLowerCase();
    const primaryLower = primaryTopic.toLowerCase();

    let bestMatch: Collection | null = null;
    let highestScore = 0;

    for (const col of collections) {
      const colNameLower = col.name.trim().toLowerCase();
      let score = 0;

      // 1. Exact or Substring Name Matches with Primary Topic
      if (colNameLower === primaryLower) {
        score += 0.85;
      } else if (
        colNameLower.includes(primaryLower) ||
        primaryLower.includes(colNameLower)
      ) {
        score += 0.70;
      }

      // 2. Existing Collection Preference for Common Hierarchies
      if (
        (primaryLower.includes("video") || primaryLower.includes("editing") || primaryLower.includes("premiere")) &&
        (colNameLower.includes("video") || colNameLower.includes("editing"))
      ) {
        score = Math.max(score, 0.85);
      }
      if (
        (primaryLower.includes("automation") || primaryLower.includes("ai") || primaryLower.includes("n8n")) &&
        (colNameLower.includes("automation") || colNameLower.includes("ai"))
      ) {
        score = Math.max(score, 0.85);
      }
      if (
        (primaryLower.includes("react") || primaryLower.includes("frontend") || primaryLower.includes("dev")) &&
        (colNameLower.includes("react") || colNameLower.includes("dev") || colNameLower.includes("frontend"))
      ) {
        score = Math.max(score, 0.85);
      }
      if (
        (primaryLower.includes("tool") || primaryLower.includes("util") || primaryLower.includes("useful")) &&
        (colNameLower.includes("tool") || colNameLower.includes("util"))
      ) {
        score = Math.max(score, 0.85);
      }
      if (
        (primaryLower.includes("cooking") || primaryLower.includes("baking") || primaryLower.includes("food")) &&
        (colNameLower.includes("cooking") || colNameLower.includes("recipe") || colNameLower.includes("food"))
      ) {
        score = Math.max(score, 0.85);
      }
      if (
        primaryLower.includes("business") &&
        (colNameLower.includes("business") || colNameLower.includes("ideas"))
      ) {
        score = Math.max(score, 0.75);
      }

      // 3. Intent Mapping to Resource Collections
      if (intent === "RESOURCE_ACQUISITION") {
        if (
          colNameLower.includes("resource") ||
          colNameLower.includes("asset") ||
          colNameLower.includes("tool") ||
          colNameLower.includes("template")
        ) {
          score = Math.max(score, 0.80);
        } else if (colNameLower.includes("ui") && primaryLower.includes("design")) {
          score = Math.max(score, 0.65);
        }
      }

      // 4. Secondary Topic Overlaps
      for (const sec of secondaryTopics) {
        if (colNameLower.includes(sec.toLowerCase())) {
          score += 0.40;
        }
      }

      // 5. Context Token Overlap with Collection Description
      if (col.description) {
        const descTokens = col.description.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
        let tokenHits = 0;
        for (const t of descTokens) {
          if (contextLower.includes(t)) tokenHits++;
        }
        if (tokenHits > 0) {
          score += Math.min(0.25, tokenHits * 0.08);
        }
      }

      if (score > highestScore) {
        highestScore = score;
        bestMatch = col;
      }
    }

    if (bestMatch && highestScore > 0) {
      return {
        collection: bestMatch,
        confidence: Math.min(0.98, highestScore),
        collectionId: bestMatch.id,
        suggestedCollectionName: bestMatch.name,
      };
    }

    return {
      collection: null as any,
      confidence: 0,
      collectionId: undefined,
      suggestedCollectionName: undefined,
    };
  }

  /**
   * Executes AI Organization for a list of selected items or IDs.
   * Supports both object-based params (OrganizeBatchParams) and positional arguments (items, collections, options).
   *
   * PRODUCTION INVARIANTS:
   * - Bounded concurrency worker pool
   * - Failure isolation: If 1 item fails, remaining items complete normally
   * - Data Immutability: Mutates derived fields & collections via ContentService.updateItem (safeMerge)
   * - Source-authoritative fields (URL, creator, caption, savedDate) remain 100% untouched
   * - Tenant isolation: User A cannot read or organize User B items
   */
  public static async organizeSelectedItems(
    params: OrganizeBatchParams
  ): Promise<OrganizationJobReport>;
  public static async organizeSelectedItems(
    items: SavedItem[],
    collections?: Collection[],
    options?: OrganizeItemsOptions & {
      userId?: string;
      autoAssignThreshold?: number;
      allowAutoCreateCollections?: boolean;
      concurrency?: number;
      onProgress?: ((completed: number, total: number, currentItem?: any) => void) | ((progress: { processed: number; total: number; currentItem?: string }) => void);
    }
  ): Promise<OrganizationJobReport>;
  public static async organizeSelectedItems(
    paramsOrItems: OrganizeBatchParams | SavedItem[],
    collectionsArg: Collection[] = [],
    optionsArg: OrganizeItemsOptions & {
      userId?: string;
      autoAssignThreshold?: number;
      allowAutoCreateCollections?: boolean;
      concurrency?: number;
      onProgress?: ((completed: number, total: number, currentItem?: any) => void) | ((progress: { processed: number; total: number; currentItem?: string }) => void);
    } = {}
  ): Promise<OrganizationJobReport> {
    let validSelectedItems: SavedItem[] = [];
    let userId: string;
    let userCollections: Collection[];
    let options: OrganizeItemsOptions & { userId?: string; autoAssignThreshold?: number; allowAutoCreateCollections?: boolean; concurrency?: number };
    let onProgress: ((progress: { processed: number; total: number; currentItem?: any }) => void) | undefined;

    if (Array.isArray(paramsOrItems)) {
      validSelectedItems = [...paramsOrItems];
      userId = optionsArg.userId || "user-demo-1";
      options = { ...optionsArg };
      if (options.autoAssignThreshold !== undefined) {
        options.highConfidenceThreshold = options.autoAssignThreshold;
      }
      if (options.concurrency !== undefined) {
        options.concurrencyLimit = options.concurrency;
      }
      if (options.allowAutoCreateCollections === false) {
        options.createCollectionsPolicy = "manual_review";
      }
      if (optionsArg.onProgress) {
        const rawOnProgress = optionsArg.onProgress;
        onProgress = (prog: { processed: number; total: number; currentItem?: any }) => {
          try {
            (rawOnProgress as any)(prog.processed, prog.total, prog.currentItem);
          } catch (_) {
            (rawOnProgress as any)(prog);
          }
        };
      }
      userCollections = collectionsArg && collectionsArg.length > 0
        ? collectionsArg
        : StorageService.getCollections(userId);
    } else {
      userId = paramsOrItems.userId;
      options = paramsOrItems.options || {};
      onProgress = paramsOrItems.onProgress;
      userCollections = StorageService.getCollections(userId);

      const userItems = ContentService.getAll(userId);
      const userItemMap = new Map(userItems.map((i) => [i.id, i]));
      for (const id of paramsOrItems.itemIds) {
        const item = userItemMap.get(id);
        if (item && !item.trashed) {
          validSelectedItems.push(item);
        }
      }
    }

    const {
      autoApplyHighConfidence = true,
      concurrencyLimit = 3,
    } = options;

    const startedAt = new Date().toISOString();
    const jobId = `org-job-${Date.now()}`;
    const totalSelected = validSelectedItems.length;
    const results: ItemOrganizationResult[] = [];
    let processedCount = 0;
    let assignedCount = 0;
    let suggestedCount = 0;
    let uncertainCount = 0;
    let failedCount = 0;

    // 2. Concurrency Pool Execution
    const queue = [...validSelectedItems];
    const workerCount = Math.max(1, Math.min(concurrencyLimit, 5));

    const worker = async () => {
      while (queue.length > 0) {
        const item = queue.shift();
        if (!item) break;

        try {
          // If item is corrupted or lacks a valid URL, skip with failure record
          if (!item.url || item.url.trim() === "") {
            failedCount++;
            results.push({
              itemId: item.id,
              savedItemId: item.id,
              title: item.title,
              url: item.url,
              platform: item.platform,
              transcriptionStatus: "failed",
              transcription: { status: "failed", text: "" },
              evidenceLevel: "METADATA_ONLY",
              primaryTopic: "Unclassified",
              secondaryTopics: [],
              intent: "OTHER",
              confidence: 0,
              decision: "SKIPPED",
              reasoning: "Invalid or missing URL.",
              status: "failed",
              error: "Invalid URL",
              processedAt: new Date().toISOString(),
            });
            continue;
          }

          // Analyze individual item
          const analysis = await this.analyzeItem(item, userCollections, options);

          const isApplied = autoApplyHighConfidence && (analysis.decision === "APPLIED" || analysis.decision === "AUTO_ASSIGNED") && Boolean(analysis.targetCollectionId);

          const currentCollections = Array.isArray(item.collections) ? item.collections : [];
          const updatedCollections = (isApplied && analysis.targetCollectionId)
            ? Array.from(new Set([...currentCollections, analysis.targetCollectionId]))
            : currentCollections;

          const transcriptValue = analysis.transcriptText
            ? analysis.transcriptText
            : { status: "unavailable", text: "" };

          // Safe update through ContentService (enforcing safeMerge immutability)
          ContentService.updateItem(
            item.id,
            {
              ...(isApplied && analysis.targetCollectionId
                ? { collectionId: analysis.targetCollectionId, collections: updatedCollections }
                : {}),
              metadata: {
                ...item.metadata,
                organization: {
                  intent: analysis.intent,
                  primaryTopic: analysis.primaryTopic,
                  secondaryTopics: analysis.secondaryTopics,
                  resourceAction: analysis.resourceAction,
                },
                transcript: transcriptValue,
                contentIntent: analysis.intent,
                visualText: analysis.visualText || item.metadata?.visualText,
              },
              provenance: {
                ...item.provenance,
                ...(analysis.transcriptText
                  ? {
                      transcript: {
                        value: analysis.transcriptText,
                        source: analysis.transcription?.provider || "speech_to_text",
                        retrievedAt: new Date().toISOString(),
                      },
                    }
                  : {}),
              },
              topics: Array.from(new Set([...(item.topics || []), analysis.primaryTopic, ...(analysis.secondaryTopics || [])])),
            },
            userId
          );

          if (isApplied) {
            assignedCount++;
            analysis.decision = "APPLIED";
          } else if (analysis.decision === "SUGGESTED") {
            suggestedCount++;
          } else {
            uncertainCount++;
          }

          results.push(analysis);
        } catch (err: any) {
          failedCount++;
          results.push({
            itemId: item.id,
            savedItemId: item.id,
            title: item.title,
            url: item.url,
            platform: item.platform,
            transcriptionStatus: "failed",
            transcription: { status: "failed", text: "" },
            evidenceLevel: "METADATA_ONLY",
            primaryTopic: "Unclassified",
            secondaryTopics: [],
            intent: "OTHER",
            confidence: 0,
            decision: "SKIPPED",
            reasoning: err?.message || "Failed to process item.",
            status: "failed",
            error: err?.message || "Internal organization failure",
            processedAt: new Date().toISOString(),
          });
        } finally {
          processedCount++;
          if (onProgress) {
            onProgress({
              processed: processedCount,
              total: totalSelected,
              currentItem: item.title,
            });
          }
        }
      }
    };

    // Run parallel workers
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    // 3. Cluster Summary Aggregation
    const clusterMap = new Map<string, {
      count: number;
      itemCount: number;
      autoAssignedCount: number;
      suggestedCount: number;
      collectionId?: string;
      isNew: boolean;
      isExisting: boolean;
      itemIds: string[];
      confSum: number;
    }>();

    for (const res of results) {
      if (res.decision === "APPLIED" || res.decision === "AUTO_ASSIGNED" || res.decision === "SUGGESTED") {
        const key = res.targetCollectionName || res.primaryTopic || "General";
        const entry = clusterMap.get(key) || {
          count: 0,
          itemCount: 0,
          autoAssignedCount: 0,
          suggestedCount: 0,
          collectionId: res.targetCollectionId,
          isNew: Boolean(res.isNewCollection),
          isExisting: !Boolean(res.isNewCollection),
          itemIds: [],
          confSum: 0,
        };
        entry.count++;
        entry.itemCount++;
        if (res.decision === "APPLIED" || res.decision === "AUTO_ASSIGNED") {
          entry.autoAssignedCount++;
        } else if (res.decision === "SUGGESTED") {
          entry.suggestedCount++;
        }
        entry.itemIds.push(res.itemId);
        entry.confSum += res.confidence;
        clusterMap.set(key, entry);
      }
    }

    const clusterSummary: OrganizationCluster[] = Array.from(clusterMap.entries()).map(
      ([collectionName, entry]) => ({
        collectionName,
        collectionId: entry.collectionId,
        count: entry.count,
        itemCount: entry.itemCount,
        autoAssignedCount: entry.autoAssignedCount,
        suggestedCount: entry.suggestedCount,
        isNew: entry.isNew,
        isExisting: entry.isExisting,
        itemIds: entry.itemIds,
        avgConfidence: entry.count > 0 ? entry.confSum / entry.count : 0,
      })
    );

    if (uncertainCount > 0 && clusterSummary.length === 0) {
      clusterSummary.push({
        collectionName: "Uncertain",
        collectionId: undefined,
        count: uncertainCount,
        itemCount: uncertainCount,
        autoAssignedCount: 0,
        suggestedCount: 0,
        isNew: false,
        isExisting: true,
        itemIds: results.filter((r) => r.decision === "UNCERTAIN").map((r) => r.itemId),
        avgConfidence: 0,
      });
    }

    const durationMs = Date.now() - new Date(startedAt).getTime();

    return {
      jobId,
      userId,
      totalSelected,
      processed: processedCount,
      processedCount,
      assignedCount,
      autoAssignedCount: assignedCount,
      suggestedCount,
      uncertainCount,
      failedCount,
      clusterSummary,
      clusters: clusterSummary,
      results,
      startedAt,
      completedAt: new Date().toISOString(),
      durationMs,
    };
  }

  /**
   * Applies suggested organization changes approved by the user.
   * Supports both (results, userId) and (ids, allResults, userId).
   */
  public static applyApprovedSuggestions(
    resultsOrIds: ItemOrganizationResult[] | string[],
    userIdOrResults?: string | ItemOrganizationResult[],
    fallbackUserId: string = "user-demo-1"
  ): { appliedCount: number } {
    let appliedCount = 0;
    let targetResults: ItemOrganizationResult[] = [];
    const userId = typeof userIdOrResults === "string" ? userIdOrResults : fallbackUserId;

    if (Array.isArray(resultsOrIds) && resultsOrIds.length > 0) {
      if (typeof resultsOrIds[0] === "string") {
        const idSet = new Set(resultsOrIds as string[]);
        const allResults = Array.isArray(userIdOrResults) ? (userIdOrResults as ItemOrganizationResult[]) : [];
        targetResults = allResults.filter((r) => idSet.has(r.itemId));
      } else {
        targetResults = resultsOrIds as ItemOrganizationResult[];
      }
    }

    const userItems = ContentService.getAll(userId);
    const itemMap = new Map(userItems.map((i) => [i.id, i]));

    for (const res of targetResults) {
      if (res.targetCollectionId && (res.status === "completed" || !res.status || res.decision === "SUGGESTED")) {
        const item = itemMap.get(res.itemId);
        if (item) {
          const currentCols = Array.isArray(item.collections) ? item.collections : [];
          const updatedCols = Array.from(new Set([...currentCols, res.targetCollectionId]));

          ContentService.updateItem(
            item.id,
            {
              collectionId: res.targetCollectionId,
              collections: updatedCols,
            },
            userId
          );
          appliedCount++;
        }
      }
    }

    return { appliedCount };
  }
}
