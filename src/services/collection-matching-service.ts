import { AssetClassification, Collection, GeneratedTag } from "@/types";

export interface CollectionMatchCandidate {
  collectionId: string;
  name: string;
  confidence: number;
  matchedTerms: string[];
  reasoning: string;
}

const STOP_WORDS = new Set("about after and are been content from into just more other post saved that the this with your collection collections general knowledge".split(" "));
const RELATED_TERMS: Record<string, string[]> = {
  react: ["frontend", "web development", "javascript", "components"],
  "next.js": ["frontend", "web development", "react", "javascript"],
  javascript: ["frontend", "web development", "programming"],
  typescript: ["frontend", "web development", "programming"],
  python: ["programming", "software development", "data science"],
  "machine learning": ["artificial intelligence", "data science", "models"],
  "after effects": ["motion graphics", "video editing", "animation"],
};

const COLLECTION_TOPIC_CATEGORIES = new Set(["Topic", "Technology", "Industry", "Concept", "Skill", "Product"]);
const GENERIC_MATCH_TERMS = new Set([
  "asset", "content", "education", "educational", "information", "post", "posts", "reference", "resource", "resources",
  "tutorial", "video", "videos", "youtube", "instagram", "reddit", "linkedin", "short", "shorts", "reel", "reels",
]);
const COLLECTION_SYNONYMS: Record<string, string[]> = {
  quiz: ["quiz", "quizzes", "trivia", "brain teaser", "brain teasers", "knowledge quiz", "knowledge test", "question game"],
  comedy: ["comedy", "comedian", "funny", "humor", "humour", "sketch", "standup", "parody", "satire"],
  entertainment: ["entertainment", "music", "movies", "gaming", "games", "celebrity", "series", "cinema"],
  technology: ["technology", "tech", "programming", "coding", "software", "hardware", "macbook", "apple", "macos", "ios", "developer", "artificial intelligence", "machine learning"],
  design: ["design", "ui", "ux", "graphic design", "web design", "typography", "figma"],
  education: ["education", "learning", "study", "lesson", "course", "tutorial", "explainer", "guide", "how to"],
  travel: ["travel", "trip", "destination", "tourism", "itinerary", "vacation", "transit guide", "flight", "hotel"],
  food: ["food", "cooking", "recipe", "recipes", "cuisine"],
  fitness: ["fitness", "workout", "exercise", "health", "wellness"],
  business: ["business", "marketing", "startup", "entrepreneurship", "sales", "freelance", "freelancing", "website building", "web building", "web design", "client acquisition", "agency", "portfolio", "side hustle", "solopreneur", "pricing"],
  news: ["news", "current events", "politics", "breaking news"],
  sports: ["sports", "sport", "cricket", "football", "basketball"],
};
const COLLECTION_CATEGORY_LABELS: Record<string, string> = {
  quiz: "Quiz", comedy: "Comedy", entertainment: "Entertainment", technology: "Technology", design: "Design",
  education: "Education", travel: "Travel", food: "Food", fitness: "Fitness", business: "Business", news: "News", sports: "Sports",
};
const COLLECTION_CATEGORY_PRIORITY: Record<string, number> = {
  quiz: 100, comedy: 95, education: 80, technology: 75, design: 70, food: 70, fitness: 70,
  travel: 70, sports: 70, business: 65, news: 65, entertainment: 50,
};
const GENERIC_COLLECTION_TOPICS = new Set([
  "asset", "assets", "content", "education", "educational", "information", "post", "posts",
  "reference", "resource", "resources", "tutorial", "video", "videos", "youtube", "instagram",
  "reddit", "linkedin", "short", "shorts", "reel", "reels",
]);

export interface InferredCategoryResult {
  primaryCategory: string | null;
  secondaryCategories: string[];
  confidence: number;
  isConflicted: boolean;
  conflictReason?: string;
  scores: Record<string, number>;
}

function tokenize(value: string): Set<string> {
  return new Set(value.toLowerCase().match(/[\p{L}\p{N}+#.-]{2,}/gu)?.map((word) => word.replace(/^[.+#-]+|[.+#-]+$/g, ""))
    .filter((word) => word.length > 1 && !STOP_WORDS.has(word)) || []);
}

function normalizedPhrase(value: string): string {
  return value.toLocaleLowerCase().normalize("NFKC").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
}

function collectionContext(collection: Collection): string {
  const terms = Array.isArray(collection.terms) ? collection.terms.filter((term: unknown): term is string => typeof term === "string") : [];
  return `${collection.name} ${collection.description || ""} ${terms.join(" ")}`;
}

function canonicalCollectionTopic(value: string): string | undefined {
  const normalized = normalizedPhrase(value);
  return Object.entries(COLLECTION_SYNONYMS).find(([, synonyms]) => synonyms.some((synonym) => normalized === normalizedPhrase(synonym)))?.[0];
}

export class CollectionMatchingService {
  /**
   * Infers primary and secondary collection categories based on evidence-weighted tag counts
   * and content cues, avoiding false allocation from isolated incidental keywords.
   */
  static inferCategories(tags: Array<GeneratedTag | string>, text?: string): InferredCategoryResult {
    const scores: Record<string, number> = {};
    const tagStrings: string[] = tags.map((t) => typeof t === "string" ? t : t.name);

    // 1. Evidence scoring from tags
    for (const tag of tags) {
      const tagName = typeof tag === "string" ? tag : tag.name;
      const tagConf = typeof tag === "object" && typeof tag.confidence === "number" ? tag.confidence : 1;
      const topic = canonicalCollectionTopic(tagName);
      if (topic) {
        // Tag weight scales with specificity: multi-word or compound tags get a bonus
        const specificityBonus = tagName.includes(" ") ? 0.5 : 0;
        scores[topic] = (scores[topic] || 0) + (1.5 + specificityBonus) * tagConf;
      }
    }

    // 2. Evidence scoring from verified source text (capped to prevent 1 repetitive word from hijacking)
    if (text && text.trim().length > 0) {
      const lower = text.toLowerCase();
      for (const [topic, synonyms] of Object.entries(COLLECTION_SYNONYMS)) {
        let hits = 0;
        for (const cue of synonyms) {
          const regex = new RegExp(`\\b${cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
          if (regex.test(lower)) {
            hits++;
          }
        }
        if (hits > 0) {
          // Add text hits capped at 1.0 point
          scores[topic] = (scores[topic] || 0) + Math.min(1.0, hits * 0.35);
        }
      }
    }

    const sortedTopics = Object.keys(scores).sort((a, b) => {
      const scoreDiff = scores[b] - scores[a];
      // If scores are very close (within 0.2), use category priority as tiebreaker
      if (Math.abs(scoreDiff) < 0.2) {
        return (COLLECTION_CATEGORY_PRIORITY[b] || 0) - (COLLECTION_CATEGORY_PRIORITY[a] || 0);
      }
      return scoreDiff;
    });

    if (sortedTopics.length === 0) {
      return {
        primaryCategory: null,
        secondaryCategories: [],
        confidence: 0,
        isConflicted: false,
        scores: {},
      };
    }

    const bestTopic = sortedTopics[0];
    const bestScore = scores[bestTopic];
    const runnerUpTopic = sortedTopics[1];
    const runnerUpScore = runnerUpTopic ? scores[runnerUpTopic] : 0;

    const primaryCategory = COLLECTION_CATEGORY_LABELS[bestTopic] || null;
    const secondaryCategories = sortedTopics
      .slice(1)
      .filter((t) => scores[t] >= 1.0 && scores[t] >= bestScore * 0.4)
      .map((t) => COLLECTION_CATEGORY_LABELS[t])
      .filter((l): l is string => Boolean(l));

    // Conflict detection: close race between two distinct strong categories
    const isConflicted = runnerUpScore >= 1.5 && (bestScore - runnerUpScore) / bestScore < 0.18;
    const conflictReason = isConflicted
      ? `Conflicting signals between ${primaryCategory} (score ${bestScore.toFixed(1)}) and ${COLLECTION_CATEGORY_LABELS[runnerUpTopic]} (score ${runnerUpScore.toFixed(1)}).`
      : undefined;

    const confidence = Math.min(0.98, Math.max(0.4, bestScore / (bestScore + runnerUpScore + 0.5)));

    return {
      primaryCategory,
      secondaryCategories,
      confidence: Math.round(confidence * 100) / 100,
      isConflicted,
      conflictReason,
      scores,
    };
  }

  static inferCollectionCategory(tags: string[], text?: string): string | null {
    return this.inferCategories(tags, text).primaryCategory;
  }

  /**
   * Selects one evidenced topic for an AI-created collection. Collection creation
   * is intentionally limited to confident, reusable material; platform/type tags
   * and broad labels must never create folders.
   */
  static selectCollectionTopic(
    tags: GeneratedTag[],
    analysisConfidence: number,
    asset: AssetClassification
  ): GeneratedTag | null {
    if (asset.isAsset !== true || asset.assetScore === null || asset.assetScore < 0.72 || analysisConfidence < 0.78) return null;
    return tags.find((tag) => {
      const normalized = tag.name.trim().toLocaleLowerCase();
      return COLLECTION_TOPIC_CATEGORIES.has(tag.category)
        && tag.source === "ai"
        && tag.confidence >= 0.78
        && tag.evidence.trim().length >= 8
        && normalized.length >= 4
        && !GENERIC_COLLECTION_TOPICS.has(normalized);
    }) || null;
  }

  static match(text: string, tags: GeneratedTag[], collections: Collection[], limit = 3): CollectionMatchCandidate[] {
    const relevantTags = tags.filter((tag) => !GENERIC_MATCH_TERMS.has(normalizedPhrase(tag.name)));
    const tagTerms = relevantTags.map((tag) => tag.name.trim()).filter(Boolean);
    const tagTokens = new Set(tagTerms.flatMap((term) => [...tokenize(term)]));
    const textTokens = tokenize(text);
    const hasSpecificQuizIntent = tagTerms.some((term) => canonicalCollectionTopic(term) === "quiz");
    for (const term of tagTerms) {
      for (const related of RELATED_TERMS[term.toLowerCase()] || []) {
        for (const token of tokenize(related)) tagTokens.add(token);
      }
    }
    if (tagTokens.size === 0 && textTokens.size === 0) return [];

    return collections.map((collection) => {
      const nameTokens = tokenize(collection.name);
      const contextText = collectionContext(collection);
      const normalizedName = normalizedPhrase(collection.name);
      const normalizedContext = normalizedPhrase(contextText);
      const contextTokens = tokenize(contextText);
      const collectionTopic = canonicalCollectionTopic(collection.name);
      if (hasSpecificQuizIntent && ["comedy", "entertainment"].includes(collectionTopic || "")) {
        return {
          collectionId: collection.id,
          name: collection.name,
          confidence: 0,
          matchedTerms: [],
          reasoning: "A specific Quiz tag takes priority over a broad Entertainment collection.",
        };
      }
      const matchedTerms = [...new Set([...nameTokens, ...contextTokens])].filter((term) => tagTokens.has(term) || textTokens.has(term));
      const nameCoverage = [...nameTokens].filter((term) => tagTokens.has(term)).length / Math.max(1, nameTokens.size);
      const contextCoverage = [...contextTokens].filter((term) => tagTokens.has(term)).length / Math.max(1, contextTokens.size);
      const sourceCoverage = [...nameTokens].filter((term) => textTokens.has(term)).length / Math.max(1, nameTokens.size);
      const exactNameTag = tagTerms.some((tag) => normalizedName.includes(normalizedPhrase(tag)));
      const exactContextTag = tagTerms.some((tag) => normalizedContext.includes(normalizedPhrase(tag)));
      const aliasTagMatch = tagTerms.some((tag) => {
        const tagTopic = canonicalCollectionTopic(tag);
        return Boolean(tagTopic && tagTopic === collectionTopic);
      });
      const confidence = Math.round(Math.min(0.99, Math.max(
        exactNameTag ? 0.96 : 0,
        exactContextTag ? 0.82 : 0,
        aliasTagMatch ? 0.88 : 0,
        nameCoverage ? 0.58 + Math.min(0.34, nameCoverage * 0.34) : 0,
        contextCoverage ? 0.48 + Math.min(0.28, contextCoverage * 0.28) : 0,
        sourceCoverage ? 0.32 + Math.min(0.28, sourceCoverage * 0.28) : 0,
      )) * 100) / 100;
      return {
        collectionId: collection.id,
        name: collection.name,
        confidence,
        matchedTerms,
        reasoning: exactNameTag
          ? `Matched the tag “${tagTerms.find((tag) => normalizedName.includes(normalizedPhrase(tag)))}” to this collection name.`
          : aliasTagMatch
          ? `Matched a recognized tag synonym to the ${collectionTopic} collection.`
          : exactContextTag
          ? `Matched a tag to this collection's description or topic terms.`
          : matchedTerms.length
          ? `Matched tagged topic terms ${matchedTerms.slice(0, 5).join(", ")} to this collection.`
          : "No grounded content terms overlap with this collection.",
      };
    }).filter((candidate) => candidate.confidence >= 0.35)
      .sort((a, b) => b.confidence - a.confidence || a.name.localeCompare(b.name))
      .slice(0, limit);
  }

  /** Returns a collection only when the best tag match is clear and strong. */
  static selectBestMatch(matches: CollectionMatchCandidate[], minimumConfidence = 0.68, minimumMargin = 0.12): CollectionMatchCandidate | null {
    const best = matches[0];
    const runnerUp = matches[1];
    if (!best || best.confidence < minimumConfidence) return null;
    if (runnerUp && best.confidence - runnerUp.confidence < minimumMargin) return null;
    return best;
  }
}
