import { AISummary, Collection, ContentProcessingStatus, ExtractedContent, FieldProvenance, SavedItem } from "@/types";
import { SearchService } from "@/services/search-service";
import { ProviderService } from "@/services/provider-service";
import { ReprocessingService } from "./reprocessing/reprocessing-service";
import { ContentService } from "./content-service";
import { ContentAnalysisService } from "./content-analysis-service";
import { CollectionMatchingService } from "./collection-matching-service";
import { ContentIntelligenceService } from "./content-intelligence";

export interface AIAnalysisResult {
  summary: AISummary;
  keyPoints: string[];
  tags: string[];
  topics: string[];
  suggestedCollectionId?: string;
  suggestedCollectionName?: string;
  status: ContentProcessingStatus;
  isLimited: boolean;
  limitedReason?: string;
  provenance: Record<string, FieldProvenance>;
}

export interface AssistantAnswer {
  id: string;
  query: string;
  answer: string;
  keyInsights: string[];
  referencedItems: SavedItem[];
  confidence: number;
  timestamp: string;
  suggestedFollowUps: string[];
}

export class AIService {
  /**
   * Analyzes ONLY genuinely extracted source data.
   * AI must NEVER guess the contents of a URL or fabricate missing metadata.
   */
  static async analyzeExtractedContent(
    extracted: ExtractedContent,
    existingCollections: Collection[]
  ): Promise<AIAnalysisResult> {
    const savedRepresentation = extracted.metadata?.contentRepresentation as { source?: string; status?: string; transcript?: string } | undefined;
    const transcriptSource = extracted.provenance?.transcript?.source;
    const trustedTranscriptSources = new Set(["faster-whisper", "openai-audio-transcriptions", "platform_caption_track", "youtube_caption_track", "speech_to_text"]);
    const transcript = trustedTranscriptSources.has(transcriptSource || "") && typeof extracted.transcript === "string" ? extracted.transcript.trim() : "";
    const platformTranscript = savedRepresentation?.source === "platform_transcript" && savedRepresentation.status === "completed" && typeof savedRepresentation.transcript === "string"
      ? savedRepresentation.transcript.trim()
      : "";
    const isVideo = ["video", "reel", "short"].includes(extracted.contentType) || extracted.platform === "youtube-shorts";
    const verifiedTranscript = transcript || platformTranscript;
    const ocrProvenance = extracted.provenance?.visualText;
    const hasVerifiedOcr = extracted.metadata?.visualOcr?.status === "analyzed"
      && Array.isArray(ocrProvenance?.basedOn) && ocrProvenance.basedOn.includes("mediaUrl");
    const representation = ContentIntelligenceService.normalizeRepresentation({
      transcript: verifiedTranscript ? { status: "transcribed", text: verifiedTranscript, segments: [], provider: "verified_source", modelVersion: "persisted" } : undefined,
      sourceTranscript: platformTranscript || undefined,
      bodyText: extracted.bodyText,
      caption: extracted.caption,
      description: extracted.description,
      ocrText: hasVerifiedOcr && typeof extracted.metadata.visualText === "string" ? extracted.metadata.visualText : undefined,
      title: undefined,
    });
    const verifiedText = representation.text;

    const unavailable = (reason: string): AIAnalysisResult => ({
      status: "INSUFFICIENT_CONTENT",
      isLimited: true,
      limitedReason: reason,
      summary: {
        quick: "Verified content unavailable",
        standard: "Keeper did not generate AI analysis because it could not verify readable source content.",
        detailed: "Retry after the source text, a real transcript, or OCR text is available. The source URL and factual metadata remain saved.",
      },
      keyPoints: [],
      tags: [],
      topics: [],
      suggestedCollectionId: undefined,
      suggestedCollectionName: undefined,
      provenance: {
        ...extracted.provenance,
        aiProcessing: { value: { status: "failed", reason }, source: "content_gate", basedOn: [], retrievedAt: new Date().toISOString() },
      },
    });

    if (isVideo && !verifiedTranscript) {
      return unavailable("A video requires a verified transcript or platform-provided caption track. Title and description are not transcripts.");
    }
    if (verifiedText.length < 30) {
      return unavailable("No verified source text, transcript, or OCR content was available. No AI output was generated.");
    }

    const analysis = await ContentAnalysisService.analyze(representation);
    const collectionMatches = CollectionMatchingService.match(verifiedText, analysis.tags, existingCollections);
    const match = collectionMatches[0];
    const retrievedAt = new Date().toISOString();
    return {
      status: "FULL_CONTENT",
      isLimited: false,
      summary: analysis.summary,
      keyPoints: analysis.keyPoints.map((point) => point.text),
      tags: analysis.tags.map((tag) => tag.name),
      topics: analysis.topics,
      suggestedCollectionId: match?.confidence && match.confidence >= 0.62 ? match.collectionId : undefined,
      suggestedCollectionName: match?.confidence && match.confidence >= 0.62 ? match.name : undefined,
      provenance: {
        ...extracted.provenance,
        summary: { value: analysis.summary.standard, source: "content_ai:" + analysis.model, basedOn: analysis.summaryEvidence, retrievedAt },
        generatedTags: { value: analysis.tags, source: "content_ai:" + analysis.model, basedOn: analysis.tags.map((tag) => tag.evidence), retrievedAt },
        assetClassification: { value: analysis.assetClassification, source: "content_ai:" + analysis.model, basedOn: analysis.assetClassification.evidence, retrievedAt },
        collectionDecision: { value: match || null, source: "verified_content_collection_matcher", basedOn: analysis.tags.map((tag) => tag.name), retrievedAt },
      },
    };
  }

  /**
   * Backwards-compatible analyzeContent wrapper
   */
  static async analyzeContent(
    title: string,
    description: string,
    platform: string,
    existingCollections: Collection[]
  ): Promise<AIAnalysisResult> {
    const extracted: ExtractedContent = {
      contentId: null,
      platform: platform as any,
      contentType: "article",
      url: "",
      canonicalUrl: "",
      title,
      creator: { name: "Creator" },
      description,
      thumbnail: "",
      metadata: { domain: "web" },
      suggestedTags: [],
      suggestedCollectionName: "Useful Tools",
      status: description && description.length > 20 ? "PARTIAL_CONTENT" : "METADATA_ONLY",
      isLimited: false,
      provenance: {},
      bodyText: description,
    };

    return this.analyzeExtractedContent(extracted, existingCollections);
  }

  /**
   * Reprocesses a single item:
   * 1. Keeps original URL
   * 2. Detects provider again
   * 3. Fetches source data again
   * 4. Removes incorrect generated metadata
   * 5. Regenerates AI analysis from verified content
   * 6. Updates the saved item
   */
  static async reprocessItem(
    item: SavedItem,
    collections: Collection[]
  ): Promise<SavedItem> {
    if (item.platform === "instagram" && ReprocessingService.isEligible(item)) {
      return ReprocessingService.reprocessItem(item);
    }

    // Fetch real source data
    const extracted = await ProviderService.extractContent(item.url);

    // AI analyzes ONLY verified extracted data
    const aiAnalysis = await this.analyzeExtractedContent(extracted, collections);
    const userTags = Array.isArray(item.metadata?.userTags)
      ? item.metadata.userTags.filter((tag: unknown): tag is string => typeof tag === "string")
      : [];

    // Form updated item preserving authoritative fields and user state
    const updated = ContentService.safeMerge(item, {
      title: extracted.title,
      creator: extracted.creator,
      thumbnail: extracted.thumbnail,
      platform: extracted.platform,
      contentType: extracted.contentType,
      description: extracted.description,
      metadata: {
        ...extracted.metadata,
        aiGeneratedTags: aiAnalysis.provenance.generatedTags?.value || [],
        aiProcessingStatus: aiAnalysis.status === "INSUFFICIENT_CONTENT"
          ? (["video", "reel", "short"].includes(item.contentType) || item.platform === "youtube-shorts" ? "TRANSCRIPTION_FAILED" : "EXTRACTION_FAILED")
          : "COMPLETED",
        aiProcessingError: aiAnalysis.limitedReason,
      },
      aiSummary: aiAnalysis.summary,
      keyPoints: aiAnalysis.keyPoints,
      tags: [...new Set([...aiAnalysis.tags, ...userTags])],
      topics: aiAnalysis.topics,
      contentStatus: aiAnalysis.status,
      isLimited: aiAnalysis.isLimited,
      limitedReason: aiAnalysis.limitedReason,
      provenance: aiAnalysis.provenance,
    });

    return updated;
  }

  /**
   * Development utility: Reprocess All Bookmarks
   */
  static async reprocessAllItems(
    items: SavedItem[],
    collections: Collection[]
  ): Promise<SavedItem[]> {
    const results: SavedItem[] = [];
    for (const item of items) {
      if (item.trashed) {
        results.push(item);
        continue;
      }
      try {
        const reprocessed = await this.reprocessItem(item, collections);
        results.push(reprocessed);
      } catch (err) {
        console.error(`Failed to reprocess item ${item.id}:`, err);
        results.push(item);
      }
    }
    return results;
  }

  /**
   * Finds related items based on overlapping tags, topics, collection, or platform
   */
  static getRelatedItems(item: SavedItem, allItems: SavedItem[], limit = 4): SavedItem[] {
    const candidates = allItems.filter(
      (candidate) => candidate.id !== item.id && !candidate.trashed && !candidate.archived
    );

    const scored = candidates.map((candidate) => {
      let score = 0;
      if (candidate.collectionId && candidate.collectionId === item.collectionId) score += 4;
      const sharedTags = candidate.tags.filter((t) => item.tags.includes(t));
      score += sharedTags.length * 2;
      const sharedTopics = candidate.topics.filter((t) => item.topics.includes(t));
      score += sharedTopics.length * 3;
      if (candidate.platform === item.platform) score += 1;
      if (candidate.creator.name === item.creator.name) score += 2;
      return { candidate, score };
    });

    return scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map((s) => s.candidate);
  }

  /**
   * Clusters active items into dynamic suggested collections based on real library tags/topics
   */
  static getSuggestedCollections(
    items: SavedItem[],
    existingCollections: Collection[]
  ): Array<{ name: string; description: string; color: string; tags: string[] }> {
    const activeItems = items.filter((i) => !i.trashed && !i.archived);
    const existingNames = new Set(existingCollections.map((c) => c.name.toLowerCase()));

    // Group items by topic
    const topicClusters: Record<string, SavedItem[]> = {};
    activeItems.forEach((item) => {
      item.topics.forEach((topic) => {
        const key = topic.trim();
        if (!topicClusters[key]) topicClusters[key] = [];
        topicClusters[key].push(item);
      });
    });

    const suggestions: Array<{ name: string; description: string; color: string; tags: string[] }> = [];
    const colors = ["#8b5cf6", "#06b6d4", "#ec4899", "#10b981", "#f59e0b", "#3b82f6"];
    let colorIdx = 0;

    // Rank clusters by item count
    const sortedTopics = Object.entries(topicClusters)
      .filter(([name, clusterItems]) => !existingNames.has(name.toLowerCase()) && clusterItems.length >= 1)
      .sort((a, b) => b[1].length - a[1].length);

    for (const [topicName, clusterItems] of sortedTopics) {
      if (suggestions.length >= 2) break;

      const tagSet = new Set<string>();
      clusterItems.forEach((item) => item.tags.forEach((t) => tagSet.add(t)));
      const topTags = Array.from(tagSet).slice(0, 3);

      const creators = Array.from(new Set(clusterItems.map((i) => i.creator.name))).slice(0, 2);
      const creatorMention = creators.length > 0 ? ` featuring ${creators.join(" & ")}` : "";

      suggestions.push({
        name: topicName,
        description: `Auto-cluster of ${clusterItems.length} saves${creatorMention}`,
        color: colors[colorIdx % colors.length],
        tags: topTags.length > 0 ? topTags : [topicName],
      });
      colorIdx++;
    }

    if (suggestions.length === 0) {
      suggestions.push({
        name: "Deep Dives",
        description: `Auto-cluster of ${activeItems.length} curated saves`,
        color: "#8b5cf6",
        tags: ["Research", "Learning"],
      });
    }

    return suggestions;
  }

  /**
   * Generates dynamic AI Insights & Weekly digest from the active items in the user's library
   */
  static generateDashboardInsights(items: SavedItem[]): {
    weeklyHighlight: string;
    topTopics: { name: string; count: number }[];
    unreadCount: number;
    favoriteRatio: string;
  } {
    const activeItems = items.filter((i) => !i.trashed && !i.archived);
    const unread = activeItems.filter((i) => !i.lastViewedAt || (i.viewCount ?? 0) === 0).length;
    const favorites = activeItems.filter((i) => i.favorite).length;

    // Count topics
    const topicMap: Record<string, number> = {};
    activeItems.forEach((item) => {
      item.topics.forEach((t) => {
        topicMap[t] = (topicMap[t] || 0) + 1;
      });
    });

    const topTopics = Object.entries(topicMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const favoriteRatio =
      activeItems.length > 0
        ? `${Math.round((favorites / activeItems.length) * 100)}%`
        : "0%";

    const topTopic1 = topTopics[0]?.name;
    const topTopic2 = topTopics[1]?.name;

    let weeklyHighlight = "";
    if (activeItems.length === 0) {
      weeklyHighlight = "Start saving links to generate intelligent knowledge graph insights.";
    } else if (topTopic1 && topTopic2) {
      weeklyHighlight = `Your library is strongest in ${topTopic1} (${topTopics[0].count} saves) and ${topTopic2} (${topTopics[1].count} saves). You have ${unread} unread saves waiting for review.`;
    } else if (topTopic1) {
      weeklyHighlight = `Your library has ${topTopics[0].count} saves focused on ${topTopic1}. You have ${unread} unread saves waiting for review.`;
    } else {
      weeklyHighlight = `You have ${activeItems.length} active saves indexed across your workspace.`;
    }

    return {
      weeklyHighlight,
      topTopics,
      unreadCount: unread,
      favoriteRatio,
    };
  }

  /**
   * AI Library Assistant:
   * Accepts natural language queries and synthesizes grounded answers strictly from retrieved items.
   */
  static async queryAssistant(
    query: string,
    allItems: SavedItem[],
    collections: Collection[] = []
  ): Promise<AssistantAnswer> {
    await new Promise((resolve) => setTimeout(resolve, 350));

    const activeItems = allItems.filter((i) => !i.trashed && !i.archived);

    // 1. Search library using SearchService
    const searchResults = SearchService.search(
      activeItems,
      {
        query,
        sortBy: "relevance",
      },
      collections
    );

    // 2. Strict Thresholding: if nothing matches, return clear honest response
    if (searchResults.length === 0) {
      return {
        id: `ai-ans-${Date.now()}`,
        query,
        answer: "I couldn't find anything relevant in your saved library.",
        keyInsights: [],
        referencedItems: [],
        confidence: 0,
        timestamp: new Date().toISOString(),
        suggestedFollowUps: [
          "What have I saved about React?",
          "What did I save about AI agents?",
          "Show me Instagram reels about UI design",
        ],
      };
    }

    // 3. Precision Filtering: Accuracy > Quantity
    const topScore = searchResults[0].score;
    const minScoreCutoff = Math.max(18, topScore * 0.45);
    const highRelevance = searchResults
      .filter((r) => r.score >= minScoreCutoff)
      .slice(0, 4);

    const referencedItems = highRelevance.map((r) => r.item);

    if (referencedItems.length === 0) {
      return {
        id: `ai-ans-${Date.now()}`,
        query,
        answer: "I couldn't find anything relevant in your saved library.",
        keyInsights: [],
        referencedItems: [],
        confidence: 0,
        timestamp: new Date().toISOString(),
        suggestedFollowUps: [
          "What have I saved about React?",
          "What did I save about AI agents?",
        ],
      };
    }

    // 4. Grounded AI Answer Generation purely from retrieved items
    let answer = "";
    if (referencedItems.length === 1) {
      const item = referencedItems[0];
      const summaryText =
        item.aiSummary?.standard || item.aiSummary?.quick || item.description;
      answer = `Based on your library, here is the most relevant resource matching **"${query}"**:\n\n**${item.title}** by **${item.creator.name}** (${item.platform.toUpperCase()})\n\n${summaryText}`;
      if (item.personalNotes) {
        answer += `\n\n📌 **Personal Note:** "${item.personalNotes}"`;
      }
    } else {
      answer = `I found **${referencedItems.length} relevant saved resources** in your library for **"${query}"**:\n\n`;
      referencedItems.forEach((item, index) => {
        const summarySnippet =
          item.aiSummary?.quick || item.aiSummary?.standard || item.description;
        answer += `${index + 1}. **${item.title}** (${item.creator.name} • ${item.platform.toUpperCase()})\n   ${summarySnippet}\n\n`;
      });
      const notesWithItems = referencedItems.filter((i) => !!i.personalNotes);
      if (notesWithItems.length > 0) {
        answer += `📌 **Saved Notes:**\n`;
        notesWithItems.forEach((i) => {
          answer += `• *${i.creator.name}*: "${i.personalNotes}"\n`;
        });
      }
    }

    // 5. Extract grounded key takeaways directly from the retrieved items
    const collectedInsights: string[] = [];
    referencedItems.forEach((item) => {
      if (item.keyPoints && item.keyPoints.length > 0) {
        item.keyPoints.forEach((kp) => {
          if (!collectedInsights.includes(kp) && collectedInsights.length < 4) {
            collectedInsights.push(kp);
          }
        });
      }
    });

    // 6. Grounded suggested follow-ups
    const suggestedFollowUps: string[] = [];
    const firstItem = referencedItems[0];
    if (firstItem?.creator?.name) {
      suggestedFollowUps.push(`What else did ${firstItem.creator.name} share?`);
    }
    if (firstItem?.topics?.[0]) {
      suggestedFollowUps.push(`Show more on ${firstItem.topics[0]}`);
    }
    if (referencedItems[1]?.title) {
      suggestedFollowUps.push(`Tell me about "${referencedItems[1].title.slice(0, 32)}..."`);
    }
    if (suggestedFollowUps.length < 3) {
      suggestedFollowUps.push("Which of these bookmarks are marked as favorites?");
    }

    const confidence = Math.min(0.98, Math.max(0.7, topScore / 150));

    return {
      id: `ai-ans-${Date.now()}`,
      query,
      answer: answer.trim(),
      keyInsights: collectedInsights,
      referencedItems,
      confidence: Number(confidence.toFixed(2)),
      timestamp: new Date().toISOString(),
      suggestedFollowUps,
    };
  }
}
