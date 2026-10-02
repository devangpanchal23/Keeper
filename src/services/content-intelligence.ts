import { ContentRepresentation, GeneratedTag, GeneratedTagCategory } from "@/types";
import { MetadataNormalizer } from "./normalizer/metadata-normalizer";
import { TranscriptionResult } from "./media/transcription-service";

const STOP_WORDS = new Set((
  "about after again against all also and any are because been before being between both but can could did does doing down each few for from further had has have having here how into its itself just more most other our out over own same some such than that the their them then there these they this those through too under until very was were what when where which while with would your you " +
  "video videos post posts reel reels short shorts watch saved save keeper youtube instagram reddit linkedin twitter creator author official like follow subscribe https http com www untitled content"
).split(/\s+/));

const CANONICAL_TERMS: Array<{ pattern: RegExp; name: string; category: GeneratedTagCategory }> = [
  { pattern: /\breact(?:\.js|js)?\b/i, name: "React", category: "Technology" },
  { pattern: /\bnext\s*\.\s*js\b|\bnextjs\b/i, name: "Next.js", category: "Technology" },
  { pattern: /\bjavascript\b|\bjs\b/i, name: "JavaScript", category: "Technology" },
  { pattern: /\btypescript\b|\bts\b/i, name: "TypeScript", category: "Technology" },
  { pattern: /\bpython\b/i, name: "Python", category: "Technology" },
  { pattern: /\bafter\s*effects\b/i, name: "After Effects", category: "Product" },
  { pattern: /\bserver\s+components\b/i, name: "Server Components", category: "Concept" },
  { pattern: /\bmachine\s+learning\b/i, name: "Machine Learning", category: "Technology" },
  { pattern: /\bartificial\s+intelligence\b|\bAI\b/i, name: "Artificial Intelligence", category: "Technology" },
];

const CATEGORY_TERMS: Record<string, GeneratedTagCategory> = {
  tutorial: "Content Type", guide: "Content Type", review: "Content Type", recipe: "Content Type",
  optimization: "Skill", performance: "Concept", design: "Skill", marketing: "Industry",
  finance: "Industry", business: "Industry", animation: "Concept", motion: "Concept",
};
const COLLECTION_CATEGORY_CUES: Record<string, string[]> = {
  Quiz: ["quiz", "quizzes", "trivia", "brain teaser", "riddle", "knowledge test", "question game"],
  Comedy: ["comedy", "comedian", "funny", "humor", "humour", "sketch", "standup", "parody", "satire", "Ashish Chanchlani", "Bhuvan Bam", "Harsh Beniwal", "BB Ki Vines", "Zakir Khan"],
  Entertainment: ["entertainment", "music", "movies", "gaming", "celebrity", "series", "cinema"],
  Technology: ["technology", "programming", "coding", "software", "artificial intelligence", "machine learning"],
  Design: ["design", "graphic design", "web design", "typography", "Figma"],
  Education: ["education", "learning", "study", "lesson", "course", "tutorial", "explainer"],
  Travel: ["travel", "destination", "tourism", "itinerary"],
  Food: ["food", "cooking", "recipe", "cuisine"],
  Fitness: ["fitness", "workout", "exercise", "health", "wellness"],
  Business: ["business", "marketing", "startup", "entrepreneurship", "sales"],
  News: ["news", "current events", "politics", "breaking news"],
  Sports: ["sports", "cricket", "football", "basketball"],
};

export interface RepresentationInput {
  transcript?: TranscriptionResult | null;
  sourceTranscript?: string | null;
  caption?: string | null;
  bodyText?: string | null;
  ocrText?: string | null;
  description?: string | null;
  title?: string | null;
  transcriptFailureReason?: string;
}

export class ContentIntelligenceService {
  static normalizeRepresentation(input: RepresentationInput): ContentRepresentation {
    const generatedAt = new Date().toISOString();
    const transcript = input.transcript?.status === "transcribed"
      ? MetadataNormalizer.normalizeText(input.transcript.text || "").trim()
      : "";
    const sources: Array<{ value?: string | null; source: ContentRepresentation["source"] }> = [
      { value: input.bodyText, source: "post_body" },
      { value: input.caption, source: "caption" },
      { value: input.ocrText, source: "ocr_text" },
      { value: input.description, source: "description" },
      { value: input.title, source: "title" },
    ];
    const availableSources = sources.flatMap(({ value, source }) => {
      const normalized = typeof value === "string" ? MetadataNormalizer.normalizeText(value).trim() : "";
      if (!normalized || (source === "title" && /^untitled\s+(content|video|post|reel|article|other)$/i.test(normalized))) return [];
      return [{ value: normalized, source }];
    });
    const available = availableSources[0];

    if (transcript) {
      return {
        type: "transcript", text: [transcript, ...availableSources.map(({ value }) => value)].filter((value, index, all) => all.findIndex((entry) => entry.toLowerCase() === value.toLowerCase()) === index).join("\n\n"), transcript, source: "transcription",
        language: input.transcript?.language,
        extractionMethod: `${input.transcript?.provider || "speech_to_text"}:${input.transcript?.modelVersion || "unknown"}`,
        confidence: input.transcript?.confidence ?? 1,
        status: "completed", generatedAt,
        sourceSegments: [{ source: "transcription", text: transcript }, ...availableSources.map(({ source, value }) => ({ source, text: value }))],
      };
    }
    const sourceTranscript = MetadataNormalizer.normalizeText(input.sourceTranscript || "").trim();
    if (sourceTranscript) {
      return { type: "transcript", text: [sourceTranscript, ...availableSources.map(({ value }) => value)].filter((value, index, all) => all.findIndex((entry) => entry.toLowerCase() === value.toLowerCase()) === index).join("\n\n"), transcript: sourceTranscript,
        source: "platform_transcript", extractionMethod: "platform_caption_track", confidence: 1,
        status: "completed", generatedAt,
        sourceSegments: [{ source: "platform_transcript", text: sourceTranscript }, ...availableSources.map(({ source, value }) => ({ source, text: value }))] };
    }
    if (available?.value) {
      const text = availableSources.map(({ value }) => value).filter((value, index, all) => all.findIndex((entry) => entry.toLowerCase() === value.toLowerCase()) === index).join("\n\n");
      return {
        type: available.source === "title" ? "metadata_only" : "source_text",
        text, source: available.source, extractionMethod: "platform_metadata_normalization",
        confidence: available.source === "title" ? 0.35 : 0.85,
        status: available.source === "title" ? "partial" : "completed", generatedAt,
        sourceSegments: availableSources.map(({ source, value }) => ({ source, text: value })),
        ...(input.transcript?.failureReason || input.transcriptFailureReason
          ? { failureReason: input.transcript?.failureReason || input.transcriptFailureReason }
          : {}),
      };
    }
    return {
      type: input.transcript?.status === "failed" ? "unavailable" : "metadata_only",
      text: "", source: "none", extractionMethod: input.transcript?.provider || "no_text_extractor",
      confidence: 0, status: input.transcript?.status === "failed" ? "failed" : "partial", generatedAt,
      ...(input.transcript?.failureReason || input.transcriptFailureReason
        ? { failureReason: input.transcript?.failureReason || input.transcriptFailureReason }
        : {}),
    };
  }

  static generateTags(text: string, maxTags = 8): GeneratedTag[] {
    const normalizedText = MetadataNormalizer.normalizeText(text).slice(0, 50_000);
    if (!normalizedText.trim()) return [];
    const candidates = new Map<string, { name: string; category: GeneratedTagCategory; occurrences: number; evidence: string }>();
    const add = (name: string, category: GeneratedTagCategory, evidence: string, occurrences = 1) => {
      const normalizedName = this.normalizeTag(name);
      if (!normalizedName || STOP_WORDS.has(normalizedName.toLowerCase())) return;
      const current = candidates.get(normalizedName.toLowerCase());
      candidates.set(normalizedName.toLowerCase(), {
        name: normalizedName, category, occurrences: (current?.occurrences || 0) + occurrences,
        evidence: current?.evidence || evidence.trim().slice(0, 180),
      });
    };

    for (const term of CANONICAL_TERMS) {
      const matches = normalizedText.match(new RegExp(term.pattern.source, `${term.pattern.flags.replace("g", "")}g`)) || [];
      if (matches.length) add(term.name, term.category, this.evidenceFor(normalizedText, term.pattern), matches.length);
    }

    const categorySource = normalizedText.replace(/([a-z])([A-Z])/g, "$1 $2");
    for (const [category, cues] of Object.entries(COLLECTION_CATEGORY_CUES)) {
      for (const cue of cues) {
        const pattern = new RegExp(`\\b${this.escapeRegExp(cue)}\\b`, "i");
        if (pattern.test(categorySource)) {
          add(category, "Intent", this.evidenceFor(categorySource, pattern));
          break;
        }
      }
    }

    const hashtags = MetadataNormalizer.extractHashtags(normalizedText);
    for (const hashtag of hashtags) {
      if (!STOP_WORDS.has(hashtag.toLowerCase())) add(hashtag, CATEGORY_TERMS[hashtag.toLowerCase()] || "Topic", this.evidenceFor(normalizedText, new RegExp(`#${this.escapeRegExp(hashtag)}`, "i")));
    }

    const tokens = normalizedText.toLowerCase().match(/[\p{L}][\p{L}\p{N}+#.-]{1,}/gu) || [];
    const totalTokens = Math.max(tokens.length, 1);
    const tokenCounts = new Map<string, number>();
    for (const raw of tokens) {
      const token = raw.replace(/^[.+#-]+|[.+#-]+$/g, "");
      if (token.length < 3 || STOP_WORDS.has(token) || /^\d+$/.test(token)) continue;
      tokenCounts.set(token, (tokenCounts.get(token) || 0) + 1);
    }
    for (const [token, count] of tokenCounts) {
      if (count > 1 || tokens.length < 35) {
        const category = CATEGORY_TERMS[token] || "Topic";
        add(token, category, this.evidenceFor(normalizedText, new RegExp(`\\b${this.escapeRegExp(token)}\\b`, "i")), count);
      }
    }

    const ranked = [...candidates.values()].sort((a, b) => {
      const evidenceScore = (entry: typeof a) => entry.occurrences * 2 + (entry.name.includes(" ") ? 1.5 : 0);
      return evidenceScore(b) - evidenceScore(a) || a.name.localeCompare(b.name);
    }).slice(0, Math.min(10, Math.max(1, maxTags)));

    return ranked.map((candidate) => {
      const coverage = Math.min(1, candidate.occurrences / totalTokens);
      const confidence = Math.round(Math.min(0.9, 0.35 + Math.min(0.3, coverage * 3) + (candidate.occurrences > 1 ? 0.15 : 0) + (candidate.name.includes(" ") ? 0.08 : 0)) * 100) / 100;
      return {
        name: candidate.name,
        normalizedName: this.normalizeTag(candidate.name).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""),
        category: candidate.category,
        confidence,
        source: "ai" as const,
        evidence: candidate.evidence,
      };
    });
  }

  static normalizeTag(raw: string): string {
    const value = MetadataNormalizer.normalizeText(raw).replace(/^#+/, "").replace(/[_-]+/g, " ").trim();
    if (!value || value.length > 48 || STOP_WORDS.has(value.toLowerCase())) return "";
    const canonical = CANONICAL_TERMS.find((term) => term.pattern.test(value));
    if (canonical) return canonical.name;
    return value.split(/\s+/).map((part) => part.length <= 2 ? part.toUpperCase() : `${part[0].toUpperCase()}${part.slice(1).toLowerCase()}`).join(" ");
  }

  private static evidenceFor(text: string, pattern: RegExp): string {
    const match = pattern.exec(text);
    if (!match || match.index === undefined) return text.slice(0, 120);
    return text.slice(Math.max(0, match.index - 65), Math.min(text.length, match.index + match[0].length + 65)).replace(/\s+/g, " ").trim();
  }

  private static escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
}
