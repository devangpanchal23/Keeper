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
  technology: ["technology", "tech", "programming", "coding", "software", "artificial intelligence", "machine learning"],
  design: ["design", "ui", "ux", "graphic design", "web design", "typography"],
  education: ["education", "learning", "study", "lesson", "course", "tutorial", "explainer"],
  travel: ["travel", "trip", "destination", "tourism", "itinerary"],
  food: ["food", "cooking", "recipe", "recipes", "cuisine"],
  fitness: ["fitness", "workout", "exercise", "health", "wellness"],
  business: ["business", "marketing", "startup", "entrepreneurship", "sales"],
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
  static inferCollectionCategory(tags: string[]): string | null {
    const categories = tags.map((tag) => canonicalCollectionTopic(tag)).filter((value): value is string => Boolean(value));
    const best = [...new Set(categories)].sort((a, b) => (COLLECTION_CATEGORY_PRIORITY[b] || 0) - (COLLECTION_CATEGORY_PRIORITY[a] || 0))[0];
    return best ? COLLECTION_CATEGORY_LABELS[best] || null : null;
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
