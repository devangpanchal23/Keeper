import {
  DeleteCollectionItemsOptions,
  DeleteCollectionItemsResult,
  DuplicateStrategy,
  FieldProvenance,
  ItemMetadata,
  SavedItem,
} from "@/types";
import { StorageService } from "./storage-service";
import { ProviderService } from "./provider-service";

export class ContentService {
  static getAll(userId?: string): SavedItem[] {
    return StorageService.getItems(userId);
  }

  static getById(id: string, userId?: string): SavedItem | undefined {
    const items = this.getAll(userId);
    return items.find((item) => item.id === id);
  }

  /**
   * Checks if a URL is already saved in active or archived items for this user.
   * Uses canonical identity matching (e.g. YouTube video IDs, Twitter IDs)
   * as well as normalized URL comparisons.
   */
  static checkDuplicate(url: string, userId?: string): SavedItem | null {
    if (!url) return null;
    const cleanUrl = url.trim();
    if (!cleanUrl) return null;

    const items = this.getAll(userId).filter((item) => !item.trashed);
    const targetIdentity = ProviderService.getCanonicalIdentity(cleanUrl);

    return (
      items.find((item) => {
        // 1. Direct match
        if (item.url.trim().toLowerCase() === cleanUrl.toLowerCase()) return true;

        // 2. Canonical Identity match (same YouTube video ID, Tweet ID, Reddit post ID, etc.)
        const itemIdentity = ProviderService.getCanonicalIdentity(item.url);
        const isTargetYT = targetIdentity.platform === "youtube" || targetIdentity.platform === "youtube-shorts";
        const isItemYT = itemIdentity.platform === "youtube" || itemIdentity.platform === "youtube-shorts";
        const platformMatches = targetIdentity.platform === itemIdentity.platform || (isTargetYT && isItemYT);

        if (
          targetIdentity.canonicalId &&
          itemIdentity.canonicalId &&
          platformMatches &&
          targetIdentity.canonicalId.toLowerCase() === itemIdentity.canonicalId.toLowerCase()
        ) {
          return true;
        }

        // 3. Normalized URL match (ignoring protocol, www, trailing slashes, tracking query params)
        if (targetIdentity.normalizedUrl && itemIdentity.normalizedUrl) {
          return targetIdentity.normalizedUrl === itemIdentity.normalizedUrl;
        }

        return false;
      }) || null
    );
  }

  /**
   * Idempotent content save.
   * If item with canonical identity already exists:
   * - 'skip': returns existing item without duplication
   * - 'update': updates existing item in place
   * - 'allow': creates new entry
   */
  static addItem(
    item: Omit<SavedItem, "id" | "savedDate"> & { id?: string; savedDate?: string },
    userId?: string,
    duplicateStrategy: DuplicateStrategy = "skip"
  ): SavedItem {
    const existing = this.checkDuplicate(item.url, userId);
    if (existing) {
      // Multi-collection membership preservation:
      // If the incoming item specifies a collectionId that is not yet linked in existing.collections,
      // add it so the item legitimately appears in both collections without duplicating records.
      const incomingColId = item.collectionId;
      const currentCols = new Set(
        existing.collections || (existing.collectionId ? [existing.collectionId] : [])
      );
      let needsColUpdate = false;

      if (incomingColId && !currentCols.has(incomingColId)) {
        currentCols.add(incomingColId);
        needsColUpdate = true;
      }

      if (needsColUpdate) {
        const updatedCols = Array.from(currentCols);
        const updated = this.updateItem(
          existing.id,
          {
            collections: updatedCols,
            collectionId: existing.collectionId || incomingColId,
          },
          userId
        );
        if (duplicateStrategy === "skip") {
          return updated || existing;
        }
      }

      if (duplicateStrategy === "skip") {
        return existing;
      }
      if (duplicateStrategy === "update") {
        const mergedCols = Array.from(
          new Set([
            ...(existing.collections || []),
            ...(item.collections || []),
            ...(item.collectionId ? [item.collectionId] : []),
          ])
        );
        const updated = this.updateItem(
          existing.id,
          {
            ...item,
            collections: mergedCols,
            collectionId: existing.collectionId || item.collectionId,
          },
          userId
        );
        return updated || existing;
      }
    }

    const items = this.getAll(userId);
    const newItem: SavedItem = {
      ...item,
      id: item.id || `save-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      savedDate: item.savedDate || new Date().toISOString(),
      favorite: item.favorite ?? false,
      archived: item.archived ?? false,
      trashed: item.trashed ?? false,
      viewCount: item.viewCount ?? 1,
      lastViewedAt: new Date().toISOString(),
    };

    StorageService.saveItems([newItem, ...items], userId);
    return newItem;
  }

  /**
   * Safe merge policy for SavedItem updates.
   *
   * FIELD OWNERSHIP & PRECEDENCE:
   * 1. URL & Content Identity:
   *    URL is IMMUTABLE across different content identities.
   *    Canonicalization of the same item is permitted.
   * 2. Authoritative source fields (creator, original caption, savedDate, shortcode, fbid):
   *    Meta export authoritative value > verified provider > fallback.
   *    Existing authoritative values CANNOT be overwritten by weaker or generic scraped values.
   * 3. Authentic thumbnails:
   *    Existing authentic thumbnails CANNOT be replaced by fallback placeholders or generic previews.
   * 4. AI & Enrichment fields (aiSummary, keyPoints, topics, tags, status):
   *    Enrichment owns these derived fields and can update them.
   * 5. User state (notes, collections, favorites, archive, trash):
   *    Strictly preserved unless specifically modified.
   */
  static safeMerge(existing: SavedItem, updates: Partial<SavedItem>): SavedItem {
    // 1. Identity & URL Immutability check
    let targetUrl = existing.url;
    if (updates.url && updates.url !== existing.url) {
      const existingId = ProviderService.getCanonicalIdentity(existing.url);
      const incomingId = ProviderService.getCanonicalIdentity(updates.url);
      if (
        existingId.platform === incomingId.platform &&
        existingId.canonicalId &&
        incomingId.canonicalId &&
        existingId.canonicalId.toLowerCase() !== incomingId.canonicalId.toLowerCase()
      ) {
        throw new Error(
          `[DataIntegrityViolation] URL immutability violated: Cannot change content identity from ${existing.url} (${existingId.canonicalId}) to ${updates.url} (${incomingId.canonicalId})`
        );
      }
      // Same canonical identity: permit canonical URL normalization
      targetUrl = incomingId.canonicalUrl || updates.url;
    }

    // 2. Creator Precedence
    const existingCreatorName = existing.creator?.name?.trim() || "";
    const isExistingGeneric = ContentService.isGenericCreator(existingCreatorName);
    const incomingCreatorName = updates.creator?.name?.trim() || "";
    const isIncomingGeneric = ContentService.isGenericCreator(incomingCreatorName);
    const isIncomingAuthoritative =
      updates.provenance?.creator?.source === "instagram_export_metadata" ||
      updates.provenance?.creator?.source === "user_edited";

    let targetCreator = existing.creator;
    if (isIncomingAuthoritative && incomingCreatorName) {
      targetCreator = updates.creator!;
    } else if (isExistingGeneric && !isIncomingGeneric && incomingCreatorName) {
      targetCreator = updates.creator!;
    } else if (!isExistingGeneric) {
      // Existing is authoritative, incoming is generic or weaker; KEEP existing
      targetCreator = existing.creator;
    } else if (updates.creator) {
      targetCreator = updates.creator;
    }

    // 3. Caption / Description Precedence
    const existingCaption = existing.metadata?.caption || existing.description || "";
    const isExistingCaptionGeneric = ContentService.isBoilerplateText(existingCaption);
    const incomingCaption = updates.metadata?.caption || updates.description || "";
    const isIncomingCaptionGeneric = ContentService.isBoilerplateText(incomingCaption);
    const isIncomingCaptionAuthoritative =
      updates.provenance?.caption?.source === "instagram_export_metadata" ||
      updates.provenance?.caption?.source === "user_edited";

    let targetDescription = existing.description;
    let targetCaption = existing.metadata?.caption || existing.description;

    if (isIncomingCaptionAuthoritative && incomingCaption) {
      targetDescription = incomingCaption;
      targetCaption = incomingCaption;
    } else if (isExistingCaptionGeneric && !isIncomingCaptionGeneric && incomingCaption) {
      targetDescription = incomingCaption;
      targetCaption = incomingCaption;
    } else if (!isExistingCaptionGeneric) {
      // Existing caption is authoritative; KEEP existing
      targetDescription = existing.description;
      targetCaption = existing.metadata?.caption || existing.description;
    } else if (updates.description !== undefined) {
      targetDescription = updates.description;
      targetCaption = updates.metadata?.caption || updates.description;
    }

    // 4. Saved Date Immutability
    const targetSavedDate = existing.savedDate || updates.savedDate || new Date().toISOString();

    // 5. Title Precedence
    const isExistingTitleGeneric =
      !existing.title ||
      existing.title.startsWith("http") ||
      existing.title.startsWith("Instagram Post •") ||
      existing.title.startsWith("Instagram Reel •");
    const isIncomingTitleGeneric =
      !updates.title ||
      updates.title.startsWith("http") ||
      updates.title.startsWith("Instagram Post •") ||
      updates.title.startsWith("Instagram Reel •");

    let targetTitle = existing.title;
    if (
      updates.provenance?.title?.source === "user_edited" ||
      updates.provenance?.title?.source === "instagram_export_metadata"
    ) {
      targetTitle = updates.title || existing.title;
    } else if (isExistingTitleGeneric && !isIncomingTitleGeneric && updates.title) {
      targetTitle = updates.title;
    } else if (!isExistingTitleGeneric && isIncomingTitleGeneric) {
      targetTitle = existing.title;
    } else if (updates.title) {
      targetTitle = updates.title;
    }

    // 6. Thumbnail Precedence (Never downgrade authentic thumbnail to fallback placeholder)
    const isExistingAuthenticThumb =
      Boolean(existing.thumbnail) &&
      existing.metadata?.thumbnailSource !== "fallback" &&
      existing.provenance?.thumbnail?.source !== "fallback_preview" &&
      !existing.thumbnail.includes("Authentic Preview Unavailable");

    const isIncomingAuthenticThumb =
      Boolean(updates.thumbnail) &&
      updates.metadata?.thumbnailSource !== "fallback" &&
      updates.provenance?.thumbnail?.source !== "fallback_preview" &&
      !updates.thumbnail!.includes("Authentic Preview Unavailable");

    let targetThumbnail = existing.thumbnail;
    let targetThumbSource = existing.metadata?.thumbnailSource;
    if (isIncomingAuthenticThumb) {
      targetThumbnail = updates.thumbnail!;
      targetThumbSource = updates.metadata?.thumbnailSource || "provider";
    } else if (isExistingAuthenticThumb) {
      targetThumbnail = existing.thumbnail;
      targetThumbSource = existing.metadata?.thumbnailSource;
    } else if (updates.thumbnail) {
      targetThumbnail = updates.thumbnail;
      targetThumbSource = updates.metadata?.thumbnailSource;
    }

    // 7. Metadata Merging
    const mergedMetadata: ItemMetadata = {
      ...existing.metadata,
      ...updates.metadata,
      domain: existing.metadata?.domain || updates.metadata?.domain || "",
      canonicalUrl: targetUrl,
      caption: targetCaption,
      thumbnailSource: targetThumbSource,
      fbid: existing.metadata?.fbid || updates.metadata?.fbid,
      hashtags: updates.metadata?.hashtags || existing.metadata?.hashtags,
      transcript: updates.metadata?.transcript || existing.metadata?.transcript,
      visualText: updates.metadata?.visualText || existing.metadata?.visualText,
    };

    // 8. Collections Merging
    const mergedCollections = Array.from(
      new Set([
        ...(existing.collections || []),
        ...(updates.collections || []),
        ...(updates.collectionId ? [updates.collectionId] : []),
        ...(existing.collectionId ? [existing.collectionId] : []),
      ])
    );

    // 9. Provenance Merging (Authoritative sources win)
    const mergedProvenance: Record<string, FieldProvenance> = {
      ...(existing.provenance || {}),
    };
    if (updates.provenance) {
      for (const [key, prov] of Object.entries(updates.provenance)) {
        const existingProv = mergedProvenance[key];
        if (
          existingProv?.source === "instagram_export_metadata" &&
          prov.source !== "instagram_export_metadata" &&
          prov.source !== "user_edited"
        ) {
          // Do not overwrite export provenance with scraped/ai provenance
          continue;
        }
        mergedProvenance[key] = prov;
      }
    }

    return {
      ...existing,
      ...updates,
      id: existing.id,
      url: targetUrl,
      title: targetTitle,
      creator: targetCreator,
      description: targetDescription,
      thumbnail: targetThumbnail,
      savedDate: targetSavedDate,
      collectionId: updates.collectionId || existing.collectionId,
      collections: mergedCollections,
      favorite: updates.favorite !== undefined ? updates.favorite : existing.favorite,
      archived: updates.archived !== undefined ? updates.archived : existing.archived,
      trashed: updates.trashed !== undefined ? updates.trashed : existing.trashed,
      personalNotes: updates.personalNotes !== undefined ? updates.personalNotes : existing.personalNotes,
      aiSummary: updates.aiSummary || existing.aiSummary,
      keyPoints: updates.keyPoints || existing.keyPoints,
      topics: updates.topics && updates.topics.length > 0 ? updates.topics : existing.topics,
      tags: updates.tags && updates.tags.length > 0 ? updates.tags : existing.tags,
      metadata: mergedMetadata,
      provenance: mergedProvenance,
    };
  }

  static isGenericCreator(name?: string | null): boolean {
    if (!name) return true;
    const n = name.trim().toLowerCase();
    return (
      n === "" ||
      n === "instagram" ||
      n === "instagram creator" ||
      n === "instagram_creator" ||
      n === "unknown creator" ||
      n === "unknown" ||
      n === "creator"
    );
  }

  static isBoilerplateText(text?: string | null): boolean {
    if (!text) return true;
    const t = text.trim().toLowerCase();
    return (
      t === "" ||
      t.includes("log in to instagram") ||
      t.includes("create an account or log in") ||
      t.includes("watch this video on instagram") ||
      t.includes("see photos and videos from") ||
      t.startsWith("instagram post •") ||
      t.startsWith("instagram reel •")
    );
  }

  static updateItem(id: string, updates: Partial<SavedItem>, userId?: string): SavedItem | null {
    const items = this.getAll(userId);
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return null;

    const updated = this.safeMerge(items[index], updates);
    items[index] = updated;
    StorageService.saveItems(items, userId);
    return updated;
  }

  static toggleFavorite(id: string, userId?: string): boolean {
    const item = this.getById(id, userId);
    if (!item) return false;
    this.updateItem(id, { favorite: !item.favorite }, userId);
    return !item.favorite;
  }

  static archiveItem(id: string, userId?: string): boolean {
    return !!this.updateItem(id, { archived: true, trashed: false }, userId);
  }

  static unarchiveItem(id: string, userId?: string): boolean {
    return !!this.updateItem(id, { archived: false }, userId);
  }

  static trashItem(id: string, userId?: string): boolean {
    return !!this.updateItem(id, { trashed: true }, userId);
  }

  static restoreItem(id: string, userId?: string): boolean {
    return !!this.updateItem(id, { trashed: false }, userId);
  }

  static permanentDelete(id: string, userId?: string): boolean {
    const items = this.getAll(userId);
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) return false;
    StorageService.saveItems(filtered, userId);
    return true;
  }

  static emptyTrash(userId?: string): number {
    const items = this.getAll(userId);
    const active = items.filter((i) => !i.trashed);
    const count = items.length - active.length;
    StorageService.saveItems(active, userId);
    return count;
  }

  static recordView(id: string, userId?: string): void {
    const item = this.getById(id, userId);
    if (!item) return;
    this.updateItem(
      id,
      {
        viewCount: (item.viewCount || 0) + 1,
        lastViewedAt: new Date().toISOString(),
      },
      userId
    );
  }

  static getAllTags(userId?: string): { name: string; count: number }[] {
    const items = this.getAll(userId).filter((i) => !i.trashed && !i.archived);
    const map: Record<string, number> = {};
    items.forEach((item) => {
      item.tags.forEach((t) => {
        map[t] = (map[t] || 0) + 1;
      });
    });
    return Object.entries(map)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  /**
   * Production Collection Deletion Management
   *
   * Executes collection-scoped single or bulk deletion with:
   * 1. Strict multi-user authorization (verifies collection ownership and item ownership)
   * 2. Collection scoping (rejects or skips items outside the target collection)
   * 3. Multi-collection preservation (if an item belongs to other collections, unlinks it from this collection only;
   *    if this is the item's sole collection, safely moves it to Trash)
   * 4. Full idempotency (repeated deletion requests do not corrupt state or counter values)
   */
  static deleteCollectionItems(options: DeleteCollectionItemsOptions): DeleteCollectionItemsResult {
    const { userId, collectionId, itemIds, selectAll } = options;
    if (!userId || !collectionId) {
      throw new Error("Missing required parameters: userId and collectionId are mandatory.");
    }

    // 1. Authorization: Verify target collection exists and belongs to the authenticated user
    const userCollections = StorageService.getCollections(userId);
    const targetCol = userCollections.find((c) => c.id === collectionId);
    if (!targetCol) {
      throw new Error(`Unauthorized or collection not found: collection "${collectionId}" does not belong to user.`);
    }

    // 2. Fetch all items strictly for this authenticated user
    const userItems = this.getAll(userId);

    // 3. Determine target eligible items
    let targetItems: SavedItem[];
    if (selectAll) {
      targetItems = userItems.filter(
        (item) =>
          !item.trashed &&
          (item.collectionId === collectionId || item.collections?.includes(collectionId))
      );
    } else {
      const requestedIdSet = new Set(itemIds || []);
      targetItems = userItems.filter(
        (item) =>
          requestedIdSet.has(item.id) &&
          !item.trashed &&
          (item.collectionId === collectionId || item.collections?.includes(collectionId))
      );
    }

    const requested = selectAll ? targetItems.length : (itemIds?.length || 0);
    const processedIds: string[] = [];
    let deletedCount = 0;
    let removedFromCollectionCount = 0;
    const targetIdSet = new Set(targetItems.map((i) => i.id));
    const skipped = Math.max(0, requested - targetItems.length);

    // 4. Mutate items adhering strictly to Multi-Collection semantics
    const updatedUserItems = userItems.map((item) => {
      if (!targetIdSet.has(item.id)) return item;

      processedIds.push(item.id);

      // Check multi-collection membership
      const remainingCols = (item.collections || []).filter((cId) => cId !== collectionId);
      const isMultiCollection = remainingCols.length > 0;

      if (isMultiCollection) {
        // REMOVE FROM THIS COLLECTION ONLY (Preserve item and remaining collection memberships)
        removedFromCollectionCount++;
        const nextPrimaryCol = remainingCols[0];
        return {
          ...item,
          collections: remainingCols,
          collectionId: item.collectionId === collectionId ? nextPrimaryCol : item.collectionId,
        };
      } else {
        // SINGLE COLLECTION: MOVE TO TRASH
        deletedCount++;
        return {
          ...item,
          trashed: true,
          collectionId: undefined,
          collections: [],
        };
      }
    });

    // 5. Persist isolated user state
    StorageService.saveItems(updatedUserItems, userId);

    return {
      success: true,
      requested,
      deleted: deletedCount,
      removedFromCollection: removedFromCollectionCount,
      skipped,
      failed: 0,
      processedIds,
    };
  }
}
