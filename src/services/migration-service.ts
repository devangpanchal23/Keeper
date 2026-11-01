import { Collection, SavedItem } from "@/types";
import { MetadataNormalizer } from "./normalizer/metadata-normalizer";
import { StorageService } from "./storage-service";
import { ContentService } from "./content-service";

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

  /**
   * Safely and idempotently discovers and migrates local-only legacy storage data
   * (unnamespaced v1 storage, anonymous workspace saves, or un-synced items)
   * into the authenticated user's workspace, preventing duplicate records.
   */
  public static migrateLegacyData(userId: string): {
    migratedItemsCount: number;
    migratedCollectionsCount: number;
    itemsToSync: SavedItem[];
    collectionsToSync: Collection[];
  } {
    if (!userId) {
      return {
        migratedItemsCount: 0,
        migratedCollectionsCount: 0,
        itemsToSync: [],
        collectionsToSync: [],
      };
    }

    const storage = StorageService.getStorage();
    let migratedItemsCount = 0;
    let migratedCollectionsCount = 0;

    // 1. Gather existing user items & collections
    const userItems = StorageService.getItems(userId);
    const userCollections = StorageService.getCollections(userId);

    const existingUrlMap = new Map<string, number>();
    userItems.forEach((item, idx) => {
      if (item.url) existingUrlMap.set(item.url.trim().toLowerCase(), idx);
    });

    const existingColMap = new Map<string, number>();
    userCollections.forEach((c, idx) => {
      existingColMap.set(c.id, idx);
      existingColMap.set(c.name.trim().toLowerCase(), idx);
    });

    // 2. Scan for legacy item stores
    const legacyItemKeys = ["recall_saved_items_v1", "recall_items_user_anonymous"];
    const candidateItems: SavedItem[] = [];

    for (const key of legacyItemKeys) {
      try {
        const raw = storage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            candidateItems.push(...parsed);
          }
        }
      } catch {}
    }

    // Merge candidate items into userItems
    for (const candidate of candidateItems) {
      if (!candidate || !candidate.url) continue;
      const cleanUrl = candidate.url.trim().toLowerCase();
      const existingIdx = existingUrlMap.get(cleanUrl);

      if (existingIdx !== undefined) {
        // Merge updates safely
        userItems[existingIdx] = ContentService.safeMerge(userItems[existingIdx], candidate);
      } else {
        // Add new item
        userItems.push(candidate);
        existingUrlMap.set(cleanUrl, userItems.length - 1);
        migratedItemsCount++;
      }
    }

    // 3. Scan for legacy collection stores
    const legacyColKeys = ["recall_collections_v1", "recall_collections_user_anonymous"];
    const candidateCollections: Collection[] = [];

    for (const key of legacyColKeys) {
      try {
        const raw = storage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            candidateCollections.push(...parsed);
          }
        }
      } catch {}
    }

    for (const col of candidateCollections) {
      if (!col || !col.id || !col.name) continue;
      const cleanName = col.name.trim().toLowerCase();
      if (!existingColMap.has(col.id) && !existingColMap.has(cleanName)) {
        userCollections.push(col);
        existingColMap.set(col.id, userCollections.length - 1);
        existingColMap.set(cleanName, userCollections.length - 1);
        migratedCollectionsCount++;
      }
    }

    // 4. Save merged collections and items to user's isolated local store
    if (migratedItemsCount > 0 || candidateItems.length > 0) {
      StorageService.saveItems(userItems, userId);
    }
    if (migratedCollectionsCount > 0) {
      StorageService.saveCollections(userCollections, userId);
    }

    // 5. Clean up old legacy keys to avoid re-triggering migration
    for (const key of legacyItemKeys) {
      try { storage.removeItem(key); } catch {}
    }
    for (const key of legacyColKeys) {
      try { storage.removeItem(key); } catch {}
    }

    // 6. Find all items that need syncing to the server (e.g. missing serverMediaId)
    const itemsToSync = userItems.filter(
      (item) => !item.metadata?.serverMediaId || !item.metadata?.aiProcessingStatus
    );

    return {
      migratedItemsCount,
      migratedCollectionsCount,
      itemsToSync,
      collectionsToSync: userCollections,
    };
  }
}

