import { AssetClassification as AssetClassificationResult } from "@/types";

export type AssetType =
  | "Tutorial" | "Reference" | "Educational" | "Research" | "Design Inspiration"
  | "Code Resource" | "Business Insight" | "Marketing Resource" | "AI Resource"
  | "Product Reference" | "Creative Inspiration" | "Documentation" | "Personal Reference" | "Other";

const RULES: Array<{ type: AssetType; terms: string[] }> = [
  { type: "Tutorial", terms: ["tutorial", "step by step", "how to", "walkthrough", "lesson", "explains how"] },
  { type: "Documentation", terms: ["documentation", "docs", "api reference", "manual", "specification", "reference guide"] },
  { type: "Code Resource", terms: ["code", "repository", "github", "source code", "implementation", "programming", "performance optimization", "best practices"] },
  { type: "Research", terms: ["research", "study", "paper", "experiment", "findings"] },
  { type: "AI Resource", terms: ["artificial intelligence", "machine learning", "large language model", "neural network"] },
  { type: "Marketing Resource", terms: ["marketing strategy", "campaign", "conversion", "audience growth", "positioning"] },
  { type: "Business Insight", terms: ["business model", "revenue", "pricing strategy", "market analysis", "startup"] },
  { type: "Design Inspiration", terms: ["design system", "typography", "layout inspiration", "visual design", "ui design"] },
  { type: "Product Reference", terms: ["product review", "product comparison", "product design", "feature analysis"] },
  { type: "Educational", terms: ["explains", "concept", "principle", "overview", "fundamentals"] },
  { type: "Creative Inspiration", terms: ["creative process", "illustration", "motion graphics", "art direction", "visual reference"] },
  { type: "Personal Reference", terms: ["checklist", "recipe", "itinerary", "personal notes", "reference guide"] },
];

export class AssetClassificationService {
  static classify(text: string): AssetClassificationResult {
    const normalized = text.trim().toLowerCase();
    if (normalized.length < 35) {
      return { isAsset: null, assetType: null, assetScore: null, reason: "There is not enough extracted content to judge reusable value.", evidence: [], method: "grounded_rules_v1" };
    }
    const matches = RULES.map((rule) => ({
      ...rule,
      hits: rule.terms.filter((term) => normalized.includes(term)),
    })).filter((rule) => rule.hits.length > 0).sort((a, b) => b.hits.length - a.hits.length);
    const top = matches[0];
    const uniqueTerms = new Set(matches.flatMap((match) => match.hits));
    const reusableSignals = ["how to", "tutorial", "guide", "reference", "explains", "documentation", "checklist", "implementation", "principle", "research", "recipe", "optimization", "best practices", "workflow"]
      .filter((term) => normalized.includes(term));
    const score = Math.round(Math.min(0.95, 0.2 + uniqueTerms.size * 0.13 + reusableSignals.length * 0.08) * 100) / 100;
    const evidence = [...new Set([...(top?.hits || []), ...reusableSignals])].slice(0, 6);
    const isAsset = score >= 0.48;
    return {
      isAsset,
      assetType: top?.type || (isAsset ? "Reference" : "Other"),
      assetScore: score,
      reason: isAsset
        ? `Reusable value is supported by source content mentioning ${evidence.slice(0, 3).join(", ")}.`
        : "The extracted content does not contain enough instructional, reference, or reusable-resource signals.",
      evidence,
      method: "grounded_rules_v1",
    };
  }
}
