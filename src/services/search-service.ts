import { Collection, ContentType, Platform, SavedItem, SearchFilters, SearchResult } from "@/types";

export interface ParsedQueryIntent {
  rawQuery: string;
  cleanKeywords: string[];
  phrases: string[];
  platform?: Platform;
  contentType?: ContentType;
  isRecent?: boolean;
  isOldest?: boolean;
  isFavorite?: boolean;
  isMetaQuery?: "topics" | "recent" | "favorites" | "count" | null;
}

// Common stop words and query filler tokens that clutter natural-language search
const STOP_WORDS = new Set([
  "a", "about", "all", "an", "and", "any", "are", "as", "at", "be", "been",
  "bookmark", "bookmarks", "both", "but", "by", "can", "could", "did", "do", "does",
  "each", "few", "find", "for", "from", "get", "give", "had", "has", "have",
  "he", "her", "here", "him", "his", "how", "i", "if", "in", "into", "is",
  "it", "its", "item", "items", "just", "like", "link", "links", "look", "me",
  "more", "most", "my", "no", "not", "of", "on", "once", "only", "or",
  "other", "our", "out", "over", "same", "save", "saves", "saved", "see",
  "she", "should", "show", "so", "some", "stuff", "such", "tell", "than",
  "that", "the", "their", "them", "then", "there", "these", "they", "thing",
  "things", "this", "those", "through", "to", "too", "under", "until", "up",
  "very", "was", "we", "were", "what", "when", "where", "which", "while",
  "who", "whom", "why", "will", "with", "would", "you", "your"
]);

// Semantic synonyms to expand user search intent
const SYNONYMS: Record<string, string[]> = {
  react: ["reactjs", "react19", "frontend", "nextjs", "jsx", "components"],
  performance: ["optimization", "speed", "fast", "profiling", "memoization", "perf", "bottleneck"],
  ai: ["artificial intelligence", "llm", "agents", "agent", "gpt", "model", "langchain", "langgraph", "autonomous"],
  agents: ["multi-agent", "agentic", "autonomous", "tools", "workflow", "agent"],
  agent: ["multi-agent", "agentic", "agents", "autonomous", "tools", "workflow"],
  sleep: ["circadian", "insomnia", "slow-wave", "rest", "melatonin", "huberman"],
  recipe: ["recipes", "cooking", "food", "meal", "diet", "macros", "nutrition", "dish"],
  recipes: ["recipe", "cooking", "food", "meal", "diet", "macros", "nutrition", "dish"],
  travel: ["itinerary", "trip", "packing", "flight", "tourism", "vacation"],
  saas: ["micro-saas", "mrr", "startup", "bootstrapped", "pricing", "business"],
  design: ["ui", "ux", "framer", "micro-interactions", "figma", "typography", "layout"],
  productivity: ["deep work", "focus", "habits", "workflow", "cal newport"],
  finance: ["wealth", "investing", "stocks", "naval", "business", "money", "fire"],
};

/**
 * Token matching helper that handles singular/plural variants and substrings.
 */
export function matchTokenInText(text: string, token: string): boolean {
  if (!text || !token) return false;
  if (text.includes(token)) return true;

  // Plural -> Singular check
  if (token.endsWith("ies") && token.length > 4) {
    const stem = token.slice(0, -3) + "y";
    if (text.includes(stem)) return true;
  }
  if (token.endsWith("es") && token.length > 4) {
    const stem = token.slice(0, -2);
    if (text.includes(stem)) return true;
  }
  if (token.endsWith("s") && token.length > 3) {
    const stem = token.slice(0, -1);
    if (text.includes(stem)) return true;
  }

  // Singular -> Plural check
  if (!token.endsWith("s")) {
    if (text.includes(token + "s") || text.includes(token + "es")) return true;
  }

  return false;
}

export class SearchService {
  /**
   * Parses natural language queries into structured intent:
   * Extracts target platform, content type, recency/favorite modifiers, multi-word phrases,
   * and clean semantic keywords without noise stop-words.
   */
  static parseQueryIntent(rawQuery: string): ParsedQueryIntent {
    const raw = (rawQuery || "").trim();
    const lower = raw.toLowerCase();

    // 1. Meta Query Detection
    let isMetaQuery: ParsedQueryIntent["isMetaQuery"] = null;
    if (/^(what|show|list).*topics/i.test(lower) || lower === "topics") {
      isMetaQuery = "topics";
    } else if (/(what|show|list).*(recent|recently|latest)/i.test(lower) && !/(about|react|ai|design|food)/i.test(lower)) {
      isMetaQuery = "recent";
    } else if (/(what|show|list).*(favorite|starred)/i.test(lower)) {
      isMetaQuery = "favorites";
    }

    // 2. Platform Intent Detection
    let platform: Platform | undefined;
    if (/\b(youtube shorts|yt shorts)\b/i.test(lower)) {
      platform = "youtube-shorts";
    } else if (/\b(youtube|yt)\b/i.test(lower)) {
      platform = "youtube";
    } else if (/\b(instagram|insta|ig)\b/i.test(lower)) {
      platform = "instagram";
    } else if (/\b(tiktok)\b/i.test(lower)) {
      platform = "tiktok";
    } else if (/\b(reddit|subreddit)\b/i.test(lower)) {
      platform = "reddit";
    } else if (/\b(linkedin)\b/i.test(lower)) {
      platform = "linkedin";
    } else if (/\b(twitter|tweet|tweets)\b/i.test(lower) || /\b(x\.com|on x)\b/i.test(lower)) {
      platform = "twitter";
    } else if (/\b(pinterest|pin|pins)\b/i.test(lower)) {
      platform = "pinterest";
    } else if (/\b(facebook|fb)\b/i.test(lower)) {
      platform = "facebook";
    } else if (/\b(threads)\b/i.test(lower)) {
      platform = "threads";
    } else if (/\b(github|repo|repository)\b/i.test(lower)) {
      platform = "github";
    } else if (/\b(blog|blogs|newsletter|substack|medium)\b/i.test(lower)) {
      platform = "blog";
    }

    // 3. Content Type Intent Detection
    let contentType: ContentType | undefined;
    if (/\b(reel|reels)\b/i.test(lower)) {
      contentType = "reel";
      // If user specifically asked for reels and didn't mention another platform, Instagram is the primary reel platform
      if (!platform) platform = "instagram";
    } else if (/\b(short|shorts)\b/i.test(lower)) {
      contentType = "short";
    } else if (/\b(video|videos|watch)\b/i.test(lower)) {
      contentType = "video";
    } else if (/\b(article|articles|guide|tutorial|deep dive)\b/i.test(lower)) {
      contentType = "article";
    } else if (/\b(post|posts|thread|threads)\b/i.test(lower)) {
      contentType = "post";
    } else if (/\b(image|images|photo|photos|picture|moodboard)\b/i.test(lower)) {
      contentType = "image";
    } else if (/\b(product|tool|library|framework)\b/i.test(lower)) {
      contentType = "product";
    }

    // 4. Modifiers
    const isRecent = /\b(recent|recently|latest|newest|last)\b/i.test(lower);
    const isOldest = /\b(oldest|first|earliest)\b/i.test(lower);
    const isFavorite = /\b(favorite|favorites|favourite|favourites|starred)\b/i.test(lower);

    // 5. Clean Words (Stripping punctuation and stop words)
    const cleanedRaw = lower
      .replace(/[^\w\s-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const words = cleanedRaw.split(" ").filter(Boolean);

    // Keep meaningful semantic words
    const cleanKeywords = words.filter((w) => {
      if (w.length < 2) return false;
      if (STOP_WORDS.has(w)) return false;
      // Filter out intent words if they were already captured as structured filters
      if (
        platform &&
        (w === "youtube" ||
          w === "instagram" ||
          w === "tiktok" ||
          w === "reddit" ||
          w === "linkedin" ||
          w === "twitter" ||
          w === "pinterest" ||
          w === "facebook" ||
          w === "threads" ||
          w === "github" ||
          w === "blog")
      ) {
        return false;
      }
      if (
        contentType &&
        (w === "video" ||
          w === "videos" ||
          w === "short" ||
          w === "shorts" ||
          w === "reel" ||
          w === "reels" ||
          w === "article" ||
          w === "post" ||
          w === "posts")
      ) {
        return false;
      }
      if (isRecent && (w === "recent" || w === "recently" || w === "latest" || w === "newest")) {
        return false;
      }
      if (isFavorite && (w === "favorite" || w === "favorites" || w === "starred")) {
        return false;
      }
      return true;
    });

    // 6. Multi-word Phrases (2-gram and 3-gram extraction from clean words)
    const phrases: string[] = [];
    if (cleanKeywords.length >= 2) {
      for (let i = 0; i < cleanKeywords.length - 1; i++) {
        phrases.push(`${cleanKeywords[i]} ${cleanKeywords[i + 1]}`);
      }
      if (cleanKeywords.length >= 3) {
        for (let i = 0; i < cleanKeywords.length - 2; i++) {
          phrases.push(`${cleanKeywords[i]} ${cleanKeywords[i + 1]} ${cleanKeywords[i + 2]}`);
        }
      }
    }

    return {
      rawQuery: raw,
      cleanKeywords,
      phrases,
      platform,
      contentType,
      isRecent,
      isOldest,
      isFavorite,
      isMetaQuery,
    };
  }

  /**
   * Weighted scoring engine prioritizing:
   * Title / Personal Notes (Highest) -> Tags / Topics / Key Points (High) ->
   * AI Summary / Description (Medium-High) -> Collection (Medium) -> Creator / Platform (Contextual).
   *
   * Enforces a hard minimum threshold to prevent weak random word collisions.
   */
  static scoreItemAgainstIntent(
    item: SavedItem,
    intent: ParsedQueryIntent,
    collectionsMap?: Map<string, string>
  ): { score: number; matchedFields: string[] } | null {
    let score = 0;
    const matchedFields: string[] = [];

    // Filter checks
    if (intent.isFavorite && !item.favorite) {
      return null;
    }

    // 1. Structured Platform Alignment
    if (intent.platform) {
      if (item.platform === intent.platform) {
        score += 30;
        matchedFields.push("platform");
      } else if (
        (intent.platform === "youtube" && item.platform === "youtube-shorts") ||
        (intent.platform === "youtube-shorts" && item.platform === "youtube")
      ) {
        score += 15;
        matchedFields.push("platform");
      } else {
        // Query explicitly requested a specific platform, penalize conflict
        score -= 45;
      }
    }

    // 2. Structured ContentType Alignment
    if (intent.contentType) {
      if (item.contentType === intent.contentType) {
        score += 25;
        matchedFields.push("contentType");
      } else if (
        intent.contentType === "video" &&
        (item.contentType === "short" || item.contentType === "reel")
      ) {
        score += 8; // Soft compatibility for video shorts
        matchedFields.push("contentType");
      } else {
        score -= 30;
      }
    }

    const titleLower = item.title.toLowerCase();
    const notesLower = (item.personalNotes || "").toLowerCase();
    const summaryQuick = (item.aiSummary?.quick || "").toLowerCase();
    const summaryStd = (item.aiSummary?.standard || "").toLowerCase();
    const summaryDetailed = (item.aiSummary?.detailed || "").toLowerCase();
    const descLower = item.description.toLowerCase();
    const tagsLower = item.tags.map((t) => t.toLowerCase());
    const topicsLower = item.topics.map((t) => t.toLowerCase());
    const tagsJoined = tagsLower.join(" ");
    const topicsJoined = topicsLower.join(" ");
    const keyPointsLower = (item.keyPoints || []).map((k) => k.toLowerCase());
    const creatorName = item.creator.name.toLowerCase();
    const creatorHandle = (item.creator.handle || "").toLowerCase();
    const colName = (item.collectionId && collectionsMap?.get(item.collectionId)) || "";

    // 3. Multi-Word Exact Phrase Matches (Highest boost for cohesive phrases)
    intent.phrases.forEach((phrase) => {
      if (titleLower.includes(phrase)) {
        score += 50;
        if (!matchedFields.includes("title")) matchedFields.push("title");
      }
      if (notesLower.includes(phrase)) {
        score += 40;
        if (!matchedFields.includes("notes")) matchedFields.push("notes");
      }
      if (tagsJoined.includes(phrase) || topicsJoined.includes(phrase)) {
        score += 35;
        if (!matchedFields.includes("topics")) matchedFields.push("topics");
      }
      if (summaryStd.includes(phrase) || summaryQuick.includes(phrase)) {
        score += 25;
        if (!matchedFields.includes("ai-summary")) matchedFields.push("ai-summary");
      }
      if (descLower.includes(phrase)) {
        score += 20;
        if (!matchedFields.includes("description")) matchedFields.push("description");
      }
    });

    // 4. Clean Keyword & Semantic Synonym Matching
    let primaryHits = 0;

    intent.cleanKeywords.forEach((kw) => {
      let kwHit = false;

      // Title Match (Weight: 25)
      if (matchTokenInText(titleLower, kw)) {
        score += 25;
        kwHit = true;
        if (!matchedFields.includes("title")) matchedFields.push("title");
      }

      // Personal Notes Match (Weight: 22)
      if (notesLower && matchTokenInText(notesLower, kw)) {
        score += 22;
        kwHit = true;
        if (!matchedFields.includes("notes")) matchedFields.push("notes");
      }

      // Tag Match (Weight: 22 exact, 14 partial)
      if (tagsLower.some((t) => matchTokenInText(t, kw))) {
        score += 22;
        kwHit = true;
        if (!matchedFields.includes("tags")) matchedFields.push("tags");
      } else if (matchTokenInText(tagsJoined, kw)) {
        score += 14;
        kwHit = true;
        if (!matchedFields.includes("tags")) matchedFields.push("tags");
      }

      // Topic Match (Weight: 20)
      if (topicsLower.some((tp) => matchTokenInText(tp, kw))) {
        score += 20;
        kwHit = true;
        if (!matchedFields.includes("topics")) matchedFields.push("topics");
      } else if (matchTokenInText(topicsJoined, kw)) {
        score += 14;
        kwHit = true;
        if (!matchedFields.includes("topics")) matchedFields.push("topics");
      }

      // Key Points Match (Weight: 16)
      if (keyPointsLower.some((kp) => matchTokenInText(kp, kw))) {
        score += 16;
        kwHit = true;
        if (!matchedFields.includes("key-points")) matchedFields.push("key-points");
      }

      // AI Summary Match (Weight: 12)
      if (
        matchTokenInText(summaryStd, kw) ||
        matchTokenInText(summaryQuick, kw) ||
        matchTokenInText(summaryDetailed, kw)
      ) {
        score += 12;
        kwHit = true;
        if (!matchedFields.includes("ai-summary")) matchedFields.push("ai-summary");
      }

      // Description Match (Weight: 8)
      if (matchTokenInText(descLower, kw)) {
        score += 8;
        kwHit = true;
        if (!matchedFields.includes("description")) matchedFields.push("description");
      }

      // Collection Name Match (Weight: 12)
      if (colName && matchTokenInText(colName.toLowerCase(), kw)) {
        score += 12;
        kwHit = true;
        if (!matchedFields.includes("collection")) matchedFields.push("collection");
      }

      // Creator Name / Handle Match (Weight: 10)
      if (matchTokenInText(creatorName, kw) || (creatorHandle && matchTokenInText(creatorHandle, kw))) {
        score += 10;
        kwHit = true;
        if (!matchedFields.includes("creator")) matchedFields.push("creator");
      }

      // Semantic Synonym Expansion
      const syns = SYNONYMS[kw];
      if (syns) {
        syns.forEach((syn) => {
          if (
            matchTokenInText(titleLower, syn) ||
            matchTokenInText(tagsJoined, syn) ||
            matchTokenInText(topicsJoined, syn) ||
            matchTokenInText(summaryStd, syn)
          ) {
            score += 10;
            kwHit = true;
            if (!matchedFields.includes("synonym")) matchedFields.push("synonym");
          }
        });
      }

      if (kwHit) primaryHits++;
    });

    // Density multiplier: bonus if item matches ALL semantic keywords
    if (intent.cleanKeywords.length > 1 && primaryHits >= intent.cleanKeywords.length) {
      score += 35; // Strong multi-keyword semantic intersection
    }

    // 5. Recency Boost
    if (intent.isRecent) {
      const itemDate = new Date(item.savedDate).getTime();
      const diffDays = (Date.now() - itemDate) / (1000 * 60 * 60 * 24);
      if (diffDays <= 7) score += 25;
      else if (diffDays <= 30) score += 15;
      else if (diffDays <= 90) score += 8;
    }

    // 6. Hard Relevance Threshold
    // An item MUST hit at least one primary topic/keyword or phrase in core content.
    // Incidental word collisions on unrelated items are rejected.
    if (intent.cleanKeywords.length > 0 && primaryHits === 0 && intent.phrases.length === 0) {
      return null;
    }

    let minScoreThreshold = 18;
    if (intent.cleanKeywords.length === 2) {
      minScoreThreshold = 28;
    } else if (intent.cleanKeywords.length >= 3) {
      minScoreThreshold = 38;
    }

    if (score < minScoreThreshold) {
      return null;
    }

    return { score, matchedFields };
  }

  /**
   * Main Search Function
   * Used by Global Search, Command Palette, and Library Filters.
   */
  static search(
    items: SavedItem[],
    filters: SearchFilters,
    collections: Collection[] = []
  ): SearchResult[] {
    const {
      query = "",
      platform = "all",
      contentType = "all",
      collectionId = "all",
      tag = "all",
      favoriteOnly = false,
      dateRange = "all",
      sortBy = "relevance",
    } = filters;

    const baseItems = items.filter((item) => !item.trashed && !item.archived);

    // Map collections for quick lookup
    const collectionsMap = new Map<string, string>();
    collections.forEach((c) => collectionsMap.set(c.id, c.name));

    // Fast path: No query provided, only filter UI pills
    if (!query.trim()) {
      const filtered = baseItems.filter((item) => {
        if (platform !== "all" && item.platform !== platform) {
          if (platform === "youtube" && item.platform === "youtube-shorts") {
            // allow
          } else {
            return false;
          }
        }
        if (contentType !== "all" && item.contentType !== contentType) return false;
        if (collectionId !== "all") {
          const inPrimary = item.collectionId === collectionId;
          const inSecondary = item.collections?.includes(collectionId);
          if (!inPrimary && !inSecondary) return false;
        }
        if (tag !== "all") {
          const hasTag = item.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
          if (!hasTag) return false;
        }
        if (favoriteOnly && !item.favorite) return false;
        if (dateRange !== "all") {
          const itemDate = new Date(item.savedDate).getTime();
          const now = Date.now();
          const oneDay = 24 * 60 * 60 * 1000;
          if (dateRange === "today" && now - itemDate > oneDay) return false;
          if (dateRange === "week" && now - itemDate > 7 * oneDay) return false;
          if (dateRange === "month" && now - itemDate > 30 * oneDay) return false;
          if (dateRange === "year" && now - itemDate > 365 * oneDay) return false;
        }
        return true;
      });

      return filtered
        .sort((a, b) => new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime())
        .map((item) => ({ item, score: 1, matchedFields: [] }));
    }

    // Natural Language Query with Intent Parsing & Scoring
    const intent = this.parseQueryIntent(query);

    // If explicit filter is passed, override intent
    if (platform !== "all") intent.platform = platform as Platform;
    if (contentType !== "all") intent.contentType = contentType as ContentType;
    if (favoriteOnly) intent.isFavorite = true;

    const scored: SearchResult[] = [];

    baseItems.forEach((item) => {
      // Hard filter checks
      if (collectionId !== "all") {
        const inPrimary = item.collectionId === collectionId;
        const inSecondary = item.collections?.includes(collectionId);
        if (!inPrimary && !inSecondary) return;
      }
      if (tag !== "all") {
        const hasTag = item.tags.some((t) => t.toLowerCase() === tag.toLowerCase());
        if (!hasTag) return;
      }

      const evalResult = this.scoreItemAgainstIntent(item, intent, collectionsMap);
      if (evalResult) {
        scored.push({
          item,
          score: evalResult.score,
          matchedFields: evalResult.matchedFields,
        });
      }
    });

    // Sorting
    scored.sort((a, b) => {
      if (sortBy === "newest" || intent.isRecent) {
        return new Date(b.item.savedDate).getTime() - new Date(a.item.savedDate).getTime();
      }
      if (sortBy === "oldest" || intent.isOldest) {
        return new Date(a.item.savedDate).getTime() - new Date(b.item.savedDate).getTime();
      }
      if (sortBy === "title") {
        return a.item.title.localeCompare(b.item.title);
      }
      // Default: relevance score first, then newest
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return new Date(b.item.savedDate).getTime() - new Date(a.item.savedDate).getTime();
    });

    return scored;
  }
}
