import { SavedItem } from "@/types";
import { MetadataNormalizer } from "./normalizer/metadata-normalizer";
import { StorageService } from "./storage-service";
import { AIPipeline } from "./ai-pipeline";

export interface MigrationRepairReport {
  scannedCount: number;
  repairedCount: number;
  repairedItemIds: string[];
  details: Array<{
    id: string;
    oldTitle: string;
    newTitle: string;
    oldTags: string[];
    newTags: string[];
  }>;
}

export class MigrationService {
  /**
   * Checks if a string contains un-decoded HTML entities or malformed entity fragments.
   */
  public static isMalformedString(val?: string | null): boolean {
    if (!val || typeof val !== "string") return false;
    return (
      val.includes("&#x") ||
      val.includes("&#X") ||
      /&#[0-9]+;?/.test(val) ||
      val.includes("&quot;") ||
      val.includes("&amp;") ||
      val.includes("&apos;") ||
      val.includes("&lt;") ||
      val.includes("&gt;") ||
      /^x[0-9a-f]{4,6}$/i.test(val)
    );
  }

  /**
   * Checks if a SavedItem is corrupted with HTML entities in title, creator, tags, summary, etc.
   */
  public static isItemCorrupted(item: SavedItem): boolean {
    if (this.isMalformedString(item.title)) return true;
    if (this.isMalformedString(item.description)) return true;
    if (this.isMalformedString(item.creator?.name)) return true;
    if (item.creator?.handle && this.isMalformedString(item.creator.handle)) return true;
    if (item.aiSummary?.quick && this.isMalformedString(item.aiSummary.quick)) return true;
    if (item.aiSummary?.standard && this.isMalformedString(item.aiSummary.standard)) return true;

    // Check tags
    if (Array.isArray(item.tags)) {
      for (const tag of item.tags) {
        if (this.isMalformedString(tag) || /^x[0-9a-f]{4,6}$/i.test(tag)) return true;
      }
    }

    return false;
  }

  /**
   * Re-normalizes a single SavedItem without altering user notes, collection assignments,
   * timestamps, or unrelated fields.
   */
  public static repairItem(item: SavedItem): SavedItem {
    const rawTitle = item.title || "";
    const cleanTitle = MetadataNormalizer.normalizeText(rawTitle);

    const rawDesc = item.description || "";
    const cleanDesc = MetadataNormalizer.normalizeText(rawDesc);

    // Clean creator
    const creator = item.creator ? {
      ...item.creator,
      name: MetadataNormalizer.normalizeText(item.creator.name),
      handle: item.creator.handle ? MetadataNormalizer.normalizeText(item.creator.handle) : undefined,
    } : { name: "Unknown" };

    // Clean tags
    const cleanTags = MetadataNormalizer.sanitizeTags(item.tags || []);

    // Clean topics
    const cleanTopics = Array.isArray(item.topics)
      ? item.topics
          .map((t) => MetadataNormalizer.normalizeText(t))
          .filter((t) => !this.isMalformedString(t) && t.length > 1)
      : [];

    // Clean summaries
    const aiSummary = item.aiSummary ? {
      quick: MetadataNormalizer.normalizeText(item.aiSummary.quick),
      standard: MetadataNormalizer.normalizeText(item.aiSummary.standard),
      detailed: item.aiSummary.detailed ? MetadataNormalizer.normalizeText(item.aiSummary.detailed) : "",
    } : { quick: "", standard: "", detailed: "" };

    // Clean keyPoints
    const keyPoints = Array.isArray(item.keyPoints)
      ? item.keyPoints.map((kp) => MetadataNormalizer.normalizeText(kp)).filter(Boolean)
      : [];

    return {
      ...item,
      title: cleanTitle,
      description: cleanDesc,
      creator,
      tags: cleanTags,
      topics: cleanTopics,
      aiSummary,
      keyPoints,
    };
  }

  /**
   * Scans and repairs all items stored for the given user (or active user).
   * Safe, auditable, and idempotent.
   */
  /**
   * Checks if a Reddit item has corrupted or un-normalized creator, community, or AI contamination.
   */
  public static isRedditItemCorrupted(item: SavedItem): boolean {
    if (item.platform !== "reddit") return false;

    // Check creator formatting
    if (item.creator?.name?.startsWith("u/") || item.creator?.username?.startsWith("u/") || !item.creator?.username) {
      return true;
    }

    // Check community
    if (!item.community || !item.community.name || item.community.name.toLowerCase() === "reddit" || item.community.name.startsWith("r/")) {
      return true;
    }

    // Check AI contamination (AI / LLM tags without AI evidence in source)
    const combinedText = `${item.title} ${item.description || ""} ${item.personalNotes || ""}`.toLowerCase();
    const hasAiEvidence = /\b(ai|llm|agents?|gpt|machine learning|artificial intelligence)\b/i.test(combinedText);
    const contaminatedTags = ["AI", "LLM", "Agents", "Architecture"];
    if (!hasAiEvidence && item.tags && item.tags.some((t) => contaminatedTags.includes(t))) {
      return true;
    }

    // Check summary contamination
    if (item.aiSummary?.detailed?.includes("Community: r/reddit")) {
      return true;
    }

    return false;
  }

  /**
   * Idempotently repairs a corrupted Reddit item, restoring canonical creator,
   * community, and scrubbing contaminated AI outputs without touching user notes
   * or manual edits.
   */
  public static repairRedditItem(item: SavedItem): SavedItem {
    if (item.platform !== "reddit") return item;

    // 1. Canonical Creator (strip "u/")
    const rawUsername = item.creator?.username || item.creator?.name || "reddit_user";
    const cleanUsername = rawUsername.replace(/^u\//i, "");
    const creator = {
      ...item.creator,
      id: item.creator?.id || null,
      name: cleanUsername,
      displayName: cleanUsername,
      username: cleanUsername,
      source: "reddit" as const,
      profileUrl: item.creator?.profileUrl || `https://www.reddit.com/user/${cleanUsername}`,
    };

    // 2. Canonical Community
    let cleanSub = (item.community?.name || "").replace(/^r\//i, "");
    if (!cleanSub || cleanSub.toLowerCase() === "reddit") {
      const match = item.url.match(/reddit\.com\/r\/([^/?#]+)/i);
      cleanSub = match ? match[1] : "reddit";
    }

    const community = {
      id: item.community?.id || null,
      name: cleanSub,
      displayName: `r/${cleanSub}`,
      url: `https://www.reddit.com/r/${cleanSub}`,
    };

    // 3. Clean tags: remove spurious AI tags if no evidence
    const combinedText = `${item.title} ${item.description || ""}`.toLowerCase();
    const hasAiEvidence = /\b(ai|llm|agents?|gpt|machine learning|artificial intelligence)\b/i.test(combinedText);
    let cleanTags = item.tags || [];
    if (!hasAiEvidence) {
      cleanTags = cleanTags.filter((t) => !["AI", "LLM", "Agents", "Architecture"].includes(t));
      if (!cleanTags.includes("Reddit")) cleanTags.push("Reddit");
      if (cleanSub && cleanSub.toLowerCase() !== "reddit" && !cleanTags.includes(cleanSub)) {
        cleanTags.push(cleanSub);
      }
    }

    // 4. Clean summary
    let detailed = item.aiSummary?.detailed;
    if (detailed && detailed.includes("Community: r/reddit") && cleanSub.toLowerCase() !== "reddit") {
      detailed = detailed.replace("Community: r/reddit", `Community: r/${cleanSub}`);
    }

    // 5. Safe Collection handling: only reset if collection is AI & Automation and was AI-assigned
    let collectionId = item.collectionId;
    let collections = item.collections;
    // Check if user has personal notes or manual selection
    const isUserAssigned = item.provenance?.collection?.source === "user_edited";
    if (!isUserAssigned && !hasAiEvidence) {
      // If previously mapped to AI & Automation without reason, clear or keep uncategorized
      if (item.metadata?.suggestedCollectionName === "AI & Automation") {
        collectionId = undefined;
        collections = [];
      }
    }

    return {
      ...item,
      creator,
      community,
      tags: cleanTags,
      collectionId,
      collections,
      aiSummary: item.aiSummary ? {
        ...item.aiSummary,
        detailed,
      } : item.aiSummary,
    };
  }

  /**
   * Scans and repairs all items stored for the given user (or active user).
   * Safe, auditable, and idempotent.
   */
  public static repairUserData(userId?: string): MigrationRepairReport {
    const items = StorageService.getItems(userId);
    const report: MigrationRepairReport = {
      scannedCount: items.length,
      repairedCount: 0,
      repairedItemIds: [],
      details: [],
    };

    let modified = false;
    const repairedItems = items.map((item) => {
      let currentItem = item;
      let wasRepaired = false;

      if (this.isItemCorrupted(currentItem)) {
        currentItem = this.repairItem(currentItem);
        wasRepaired = true;
      }

      if (this.isRedditItemCorrupted(currentItem)) {
        currentItem = this.repairRedditItem(currentItem);
        wasRepaired = true;
      }

      if (wasRepaired) {
        report.repairedCount++;
        report.repairedItemIds.push(item.id);
        report.details.push({
          id: item.id,
          oldTitle: item.title,
          newTitle: currentItem.title,
          oldTags: item.tags,
          newTags: currentItem.tags,
        });
        modified = true;
        return currentItem;
      }

      return item;
    });

    if (modified) {
      StorageService.saveItems(repairedItems, userId);
    }

    return report;
  }
}
