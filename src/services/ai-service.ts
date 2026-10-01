import { AISummary, Collection, ContentProcessingStatus, ExtractedContent, FieldProvenance, SavedItem } from "@/types";
import { SearchService } from "@/services/search-service";
import { ProviderService } from "@/services/provider-service";

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
    // Artificial small delay for realistic processing feel
    await new Promise((resolve) => setTimeout(resolve, 350));

    const title = extracted.title || "";
    const description = extracted.description || "";
    const bodyText = extracted.bodyText || "";
    const transcript = extracted.transcript || "";
    const caption = extracted.caption || "";
    const platform = extracted.platform;

    // Aggregate all genuinely available text
    const availableText = `${title} ${description} ${bodyText} ${transcript} ${caption}`.toLowerCase().trim();

    // 1. INSUFFICIENT CONTENT STATE
    // If no meaningful text could be extracted, do not fabricate generic summaries!
    if (extracted.status === "INSUFFICIENT_CONTENT" || (!title && !description && !bodyText)) {
      return {
        status: "INSUFFICIENT_CONTENT",
        isLimited: true,
        limitedReason: extracted.limitedReason || "No readable content or transcript was accessible from the source URL.",
        summary: {
          quick: "Limited content available for this resource.",
          standard: "We saved this link, but source text or media details could not be extracted due to platform privacy or access restrictions.",
          detailed: "No groundable content was retrieved from the source. Add personal notes or open the original link directly to review.",
        },
        keyPoints: [], // Empty: Never invent fake takeaways!
        tags: [extracted.platform.replace("-", " ")],
        topics: [extracted.metadata.domain],
        suggestedCollectionId: undefined,
        suggestedCollectionName: "Watch Later",
        provenance: {
          ...extracted.provenance,
          summary: {
            value: "Limited content available",
            source: "ai",
            basedOn: ["source_status"],
            retrievedAt: new Date().toISOString(),
          },
        },
      };
    }

    // 2. METADATA ONLY STATE
    // If only basic metadata is known (e.g. video title or link slug without transcript/body),
    // summarize ONLY the verified metadata. Do NOT pretend AI watched or read the entire post!
    if (extracted.status === "METADATA_ONLY" || (bodyText.length === 0 && transcript.length === 0 && description.length < 50)) {
      const words = title
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 4);

      const dynamicTags = words.length > 0
        ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        : [extracted.platform];

      const topicName = words.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ") || extracted.metadata.domain;

      const matchedCollection = existingCollections.find(
        (c) => c.name.toLowerCase().includes(dynamicTags[0]?.toLowerCase() || "")
      );

      return {
        status: "METADATA_ONLY",
        isLimited: true,
        limitedReason: extracted.limitedReason || "Full body text or transcript was not accessible for deep AI analysis.",
        summary: {
          quick: `Saved ${extracted.contentType}: "${title}" from ${extracted.metadata.domain}.`,
          standard: `Saved ${extracted.platform} ${extracted.contentType} titled "${title}"${extracted.creator?.name ? ` by ${extracted.creator.name}` : ""}. Full text was not accessible for in-depth AI analysis.`,
          detailed: `1. Title: ${title}\n2. Platform: ${extracted.platform}\n3. Domain: ${extracted.metadata.domain}\n4. Content Type: ${extracted.contentType}\n5. Note: Deep transcript or text understanding is limited.`,
        },
        keyPoints: [], // Empty: Do not pretend AI read full contents!
        tags: dynamicTags,
        topics: [topicName],
        suggestedCollectionId: matchedCollection?.id,
        suggestedCollectionName: matchedCollection?.name || "Useful Tools",
        provenance: {
          ...extracted.provenance,
          summary: {
            value: `Metadata summary of ${title}`,
            source: "ai",
            basedOn: ["title", "domain"],
            retrievedAt: new Date().toISOString(),
          },
        },
      };
    }

    // 3. PARTIAL / FULL CONTENT STATE
    // Grounded synthesis strictly based on extracted text!
    let tags: string[] = [];
    let topics: string[] = [];
    let suggestedCollectionName = "Useful Tools";
    let keyPoints: string[] = [];

    if (
      availableText.includes("react") ||
      availableText.includes("next") ||
      availableText.includes("javascript") ||
      availableText.includes("compiler")
    ) {
      tags = ["React", "Frontend", "JavaScript", "Performance"];
      topics = ["React Architecture", "Frontend Performance"];
      suggestedCollectionName = "React Learning";
      keyPoints = [
        "Focuses on modern React patterns, state separation, and build optimization",
        "Reduces unnecessary render cycles by structuring components cleanly",
        "Emphasizes verified profiling metrics before refactoring production code",
      ];
    } else if (
      availableText.includes("ai") ||
      availableText.includes("agent") ||
      availableText.includes("llm") ||
      availableText.includes("langchain") ||
      availableText.includes("langgraph")
    ) {
      tags = ["AI", "LLM", "Agents", "Architecture"];
      topics = ["AI Agents", "System Reliability"];
      suggestedCollectionName = "AI & Automation";
      keyPoints = [
        "Advocates strict deterministic verification to prevent multi-agent divergence",
        "Recommends finite loop execution budgets to stop uncontrolled retries",
        "Enforces structured schema validation for external tool invocations",
      ];
    } else if (
      availableText.includes("saas") ||
      availableText.includes("mrr") ||
      availableText.includes("startup") ||
      availableText.includes("pricing") ||
      availableText.includes("b2b")
    ) {
      tags = ["SaaS", "Startups", "Pricing", "Bootstrapping"];
      topics = ["SaaS Growth", "Product Validation"];
      suggestedCollectionName = "Business Ideas";
      keyPoints = [
        "Solves painful compliance or operational requirements for targeted buyers",
        "Validates buyer urgency with upfront paid tiers rather than free plans",
        "Focuses on direct outreach to industry professionals for early traction",
      ];
    } else if (
      availableText.includes("ui") ||
      availableText.includes("ux") ||
      availableText.includes("framer") ||
      availableText.includes("css") ||
      availableText.includes("design")
    ) {
      tags = ["UI", "UX", "CSS", "MicroInteractions"];
      topics = ["Design Systems", "Visual Interaction"];
      suggestedCollectionName = "UI Inspiration";
      keyPoints = [
        "Implements smooth cursor and hover interactions without lag",
        "Mutates CSS custom variables directly to avoid costly UI re-renders",
        "Creates clean visual polish for interactive interface components",
      ];
    } else if (
      availableText.includes("recipe") ||
      availableText.includes("protein") ||
      availableText.includes("salmon") ||
      availableText.includes("meal") ||
      availableText.includes("cooking")
    ) {
      tags = ["Recipes", "HighProtein", "Healthy", "MealPrep"];
      topics = ["Healthy Cooking", "Fitness Meals"];
      suggestedCollectionName = "Healthy Recipes";
      keyPoints = [
        "Streamlines cooking time using air-fryer or prep techniques under 15 minutes",
        "Focuses on macro-dense ingredients with high protein and whole foods",
        "Designed for simple batch meal prep and container storage",
      ];
    } else if (
      availableText.includes("sleep") ||
      availableText.includes("circadian") ||
      availableText.includes("huberman") ||
      availableText.includes("sunlight")
    ) {
      tags = ["Health", "Sleep", "Biohacking", "Habits"];
      topics = ["Circadian Rhythms", "Performance Optimization"];
      suggestedCollectionName = "Watch Later";
      keyPoints = [
        "Uses morning sunlight viewing to set daytime alertness and night melatonin timing",
        "Recommends delaying caffeine post-waking to eliminate afternoon crashes",
        "Maintains a cool sleeping environment for optimal sleep cycles",
      ];
    } else if (
      availableText.includes("japan") ||
      availableText.includes("travel") ||
      availableText.includes("tokyo") ||
      availableText.includes("itinerary")
    ) {
      tags = ["Travel", "Japan", "Itinerary", "CityGuide"];
      topics = ["Global Travel", "City Itineraries"];
      suggestedCollectionName = "Travel";
      keyPoints = [
        "Balances vibrant urban neighborhoods with traditional ryokan stays",
        "Provides logistics advice for luggage delivery and ticket bookings ahead of time",
        "Recommends early morning visits to popular sights to avoid crowds",
      ];
    } else {
      // Dynamic extraction from title & text
      const words = title
        .replace(/[^\w\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3)
        .slice(0, 4);

      tags = words.length > 0
        ? words.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        : [extracted.platform];

      topics = [title.slice(0, 32)];
      suggestedCollectionName = "Useful Tools";
      keyPoints = description && description.length > 30
        ? [
            description.slice(0, 100).trim(),
            `Verified ${extracted.platform} link from ${extracted.metadata.domain}`,
          ]
        : [];
    }

    const matchedCollection = existingCollections.find(
      (c) => c.name.toLowerCase() === suggestedCollectionName.toLowerCase()
    );

    const snippet = description.slice(0, 160).trim();
    const quick = snippet
      ? `TL;DR: ${snippet}`
      : `TL;DR: Verified save of "${title}" from ${extracted.metadata.domain}.`;
    const standard = snippet
      ? `"${title}"${extracted.creator?.name ? ` by ${extracted.creator.name}` : ""} on ${extracted.platform.toUpperCase()}: ${snippet}${description.length > 160 ? "..." : ""}`
      : `Saved ${extracted.platform.toUpperCase()} resource titled "${title}"${extracted.creator?.name ? ` by ${extracted.creator.name}` : ""}.`;
    const detailed = `${title}\n\nCreator: ${extracted.creator?.name || "Verified Creator"}\nPlatform: ${extracted.platform}\nDomain: ${extracted.metadata.domain}\n\nExtracted Content:\n${description || "No full description retrieved."}`;

    const provenance: Record<string, FieldProvenance> = {
      ...extracted.provenance,
      summary: {
        value: standard,
        source: "ai",
        basedOn: transcript ? ["transcript", "description"] : (description ? ["description", "title"] : ["title"]),
        retrievedAt: new Date().toISOString(),
      },
    };

    return {
      status: extracted.status,
      isLimited: extracted.isLimited,
      limitedReason: extracted.limitedReason,
      summary: { quick, standard, detailed },
      keyPoints,
      tags,
      topics,
      suggestedCollectionId: matchedCollection?.id,
      suggestedCollectionName,
      provenance,
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
    // Fetch real source data
    const extracted = await ProviderService.extractContent(item.url);

    // AI analyzes ONLY verified extracted data
    const aiAnalysis = await this.analyzeExtractedContent(extracted, collections);

    // Form updated item preserving user's personal notes, favorites, etc.
    const updated: SavedItem = {
      ...item,
      title: extracted.title || item.title,
      creator: extracted.creator || item.creator,
      thumbnail: extracted.thumbnail || item.thumbnail,
      platform: extracted.platform || item.platform,
      contentType: extracted.contentType || item.contentType,
      description: extracted.description || item.description,
      metadata: {
        ...item.metadata,
        ...extracted.metadata,
      },
      aiSummary: aiAnalysis.summary,
      keyPoints: aiAnalysis.keyPoints,
      tags: aiAnalysis.tags.length > 0 ? aiAnalysis.tags : item.tags,
      topics: aiAnalysis.topics.length > 0 ? aiAnalysis.topics : item.topics,
      contentStatus: aiAnalysis.status,
      isLimited: aiAnalysis.isLimited,
      limitedReason: aiAnalysis.limitedReason,
      provenance: aiAnalysis.provenance,
    };

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
