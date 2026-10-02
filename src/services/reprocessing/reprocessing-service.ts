import { SavedItem } from "@/types";
import { StorageService } from "../storage-service";
import { IngestionService } from "../ingestion-service";
import { ContentService } from "../content-service";
import { InstagramThumbnailResolver } from "../media/instagram-thumbnail-resolver";
import { MediaPreviewResolver } from "../media/media-preview-resolver";

export interface ReprocessingResult {
  totalChecked: number;
  eligibleCount: number;
  reprocessedCount: number;
  failedCount: number;
  updatedItems: SavedItem[];
}

export class ReprocessingService {
  /**
   * Evaluates whether an existing SavedItem is eligible for recovery/reprocessing:
   * 1. Platform is Instagram
   * 2. AND one or more flaws:
   *    - Generic creator (@Instagram Creator)
   *    - URL used as title
   *    - URL-only or repeated summary
   *    - Incorrect FULL_CONTENT claim without transcript
   *    - Missing or malformed caption
   */
  public static isEligible(item: SavedItem): boolean {
    if (item.trashed) return false;
    if (item.platform !== "instagram") return false;

    const creatorName = item.creator?.name || "";
    const isGenericCreator =
      creatorName === "Instagram Creator" ||
      creatorName === "@instagram_creator" ||
      creatorName.includes("instagram_creator");

    const isUrlTitle =
      item.title.startsWith("http://") ||
      item.title.startsWith("https://") ||
      item.title.startsWith("Instagram Reel •") ||
      item.title.startsWith("Instagram Post •");

    const isUrlSummary =
      item.aiSummary?.standard?.includes("http://") ||
      item.aiSummary?.standard?.includes("https://") ||
      item.aiSummary?.quick?.includes("http://") ||
      item.aiSummary?.quick?.includes("https://");

    const isFakeFullContent =
      item.contentStatus === "FULL_CONTENT" &&
      !item.metadata?.transcript &&
      !item.provenance?.transcript;

    const isGenericFallbackThumbnail =
      !item.thumbnail ||
      !InstagramThumbnailResolver.isAuthenticMediaUrl(item.thumbnail) ||
      item.provenance?.thumbnail?.source === "fallback_preview" ||
      item.metadata?.thumbnailSource === "fallback";

    return isGenericCreator || isUrlTitle || isUrlSummary || isFakeFullContent || isGenericFallbackThumbnail;
  }

  /**
   * Reprocesses a single item safely, preserving user collections, favorites, and notes.
   */
  public static async reprocessItem(
    itemOrId: SavedItem | string,
    userId: string = "user-demo-1"
  ): Promise<SavedItem> {
    const item = typeof itemOrId === "string" ? ContentService.getById(itemOrId, userId) : itemOrId;
    if (!item) {
      throw new Error(`Item not found for reprocessing: ${itemOrId}`);
    }
    const collections = StorageService.getCollections(userId);

    const existingAuthenticThumbnail =
      item.thumbnail &&
      InstagramThumbnailResolver.isAuthenticMediaUrl(item.thumbnail) &&
      item.provenance?.thumbnail?.source !== "fallback_preview" &&
      item.metadata?.thumbnailSource !== "fallback"
        ? item.thumbnail
        : undefined;

    // Re-run through Keeper's unified IngestionService
    const ingestion = await IngestionService.processUrl(item.url, {
      userId,
      customCollectionId: item.collectionId,
      existingCollections: collections,
      aiEnrichmentMode: "full",
      duplicateStrategy: "update",
      skipPersistence: true,
      initialMetadata: {
        title: item.title && !item.title.startsWith("http") ? item.title : undefined,
        creatorName: item.creator.name !== "Instagram Creator" ? item.creator.name : undefined,
        caption: item.metadata?.caption || item.description,
        hashtags: item.metadata?.hashtags,
        fbid: item.metadata?.fbid,
        thumbnailUrl: existingAuthenticThumbnail,
        savedTimestamp: item.savedDate ? new Date(item.savedDate).getTime() : undefined,
        collectionName: item.metadata?.suggestedCollectionName,
      },
    });

    const refreshed = ingestion.savedItem;

    // Preserve non-ingestion user state and enforce explicit field ownership
    // Authoritative source fields (creator, caption, savedDate, shortcode, authentic thumbnail)
    // CANNOT be overwritten by remote reprocessing.
    const merged = ContentService.safeMerge(item, refreshed);
    return merged;
  }

  /**
   * Scans and safely reprocesses all eligible bad imports for a given user.
   * Concurrency is bounded to 3 to prevent API quotas and rate limits.
   */
  public static async reprocessEligibleItems(
    userId: string = "user-demo-1"
  ): Promise<ReprocessingResult> {
    const allItems = StorageService.getItems(userId);
    const eligible = allItems.filter(this.isEligible);

    let reprocessedCount = 0;
    let failedCount = 0;
    const updatedMap = new Map<string, SavedItem>();

    // Bounded concurrency pool (max 3)
    const concurrency = 3;
    let cursor = 0;

    const worker = async () => {
      while (cursor < eligible.length) {
        const target = eligible[cursor++];
        if (!target) break;

        try {
          const updated = await this.reprocessItem(target, userId);
          updatedMap.set(updated.id, updated);
          reprocessedCount++;
        } catch (err) {
          failedCount++;
        }
      }
    };

    const pool = Array.from({ length: concurrency }, () => worker());
    await Promise.all(pool);

    // Persist atomic batch update to storage
    const nextItems = allItems.map((item) => updatedMap.get(item.id) || item);
    StorageService.saveItems(nextItems, userId);

    return {
      totalChecked: allItems.length,
      eligibleCount: eligible.length,
      reprocessedCount,
      failedCount,
      updatedItems: Array.from(updatedMap.values()),
    };
  }

  /**
   * Scans and repairs missing, fallback, or invalid thumbnails across library items.
   * Modifies ONLY thumbnail and thumbnailSource; authoritative source data remains unchanged.
   */
  public static async repairMissingPreviews(
    userId: string = "user-demo-1",
    concurrency: number = 3
  ): Promise<ReprocessingResult> {
    const allItems = StorageService.getItems(userId);
    const eligible = allItems.filter((item) => {
      if (item.trashed) return false;
      const isMissingOrFallback =
        !item.thumbnail ||
        !MediaPreviewResolver.isAuthenticMediaUrl(item.thumbnail) ||
        item.thumbnail.includes("Authentic Preview Unavailable") ||
        item.metadata?.thumbnailSource === "fallback" ||
        item.provenance?.thumbnail?.source === "fallback_preview";
      return isMissingOrFallback;
    });

    let reprocessedCount = 0;
    let failedCount = 0;
    const updatedMap = new Map<string, SavedItem>();

    let cursor = 0;
    const worker = async () => {
      while (cursor < eligible.length) {
        const target = eligible[cursor++];
        if (!target) break;

        try {
          const repaired = await MediaPreviewResolver.repairItem(target);
          if (repaired.thumbnail !== target.thumbnail) {
            updatedMap.set(repaired.id, repaired);
            reprocessedCount++;
          }
        } catch {
          failedCount++;
        }
      }
    };

    const pool = Array.from({ length: Math.min(concurrency, eligible.length || 1) }, () => worker());
    await Promise.all(pool);

    if (updatedMap.size > 0) {
      const nextItems = allItems.map((item) => updatedMap.get(item.id) || item);
      StorageService.saveItems(nextItems, userId);
    }

    return {
      totalChecked: allItems.length,
      eligibleCount: eligible.length,
      reprocessedCount,
      failedCount,
      updatedItems: Array.from(updatedMap.values()),
    };
  }
}

