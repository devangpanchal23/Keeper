import { SavedItem } from "@/types";
import { StorageService } from "./storage-service";
import { ProviderService } from "./provider-service";

export class ContentService {
  static getAll(): SavedItem[] {
    return StorageService.getItems();
  }

  static getById(id: string): SavedItem | undefined {
    const items = this.getAll();
    return items.find((item) => item.id === id);
  }

  /**
   * Checks if a URL is already saved in active or archived items.
   * Uses canonical identity matching (e.g. YouTube video IDs, Twitter IDs)
   * as well as normalized URL comparisons.
   */
  static checkDuplicate(url: string): SavedItem | null {
    if (!url) return null;
    const cleanUrl = url.trim();
    if (!cleanUrl) return null;

    const items = this.getAll().filter((item) => !item.trashed);
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

  static addItem(item: Omit<SavedItem, "id" | "savedDate"> & { id?: string; savedDate?: string }): SavedItem {
    const items = this.getAll();
    const newItem: SavedItem = {
      ...item,
      id: item.id || `save-${Date.now()}`,
      savedDate: item.savedDate || new Date().toISOString(),
      favorite: item.favorite ?? false,
      archived: item.archived ?? false,
      trashed: item.trashed ?? false,
      viewCount: item.viewCount ?? 1,
      lastViewedAt: new Date().toISOString(),
    };

    StorageService.saveItems([newItem, ...items]);
    return newItem;
  }

  static updateItem(id: string, updates: Partial<SavedItem>): SavedItem | null {
    const items = this.getAll();
    const index = items.findIndex((i) => i.id === id);
    if (index === -1) return null;

    const updated: SavedItem = {
      ...items[index],
      ...updates,
    };
    items[index] = updated;
    StorageService.saveItems(items);
    return updated;
  }

  static toggleFavorite(id: string): boolean {
    const item = this.getById(id);
    if (!item) return false;
    this.updateItem(id, { favorite: !item.favorite });
    return !item.favorite;
  }

  static archiveItem(id: string): boolean {
    return !!this.updateItem(id, { archived: true, trashed: false });
  }

  static unarchiveItem(id: string): boolean {
    return !!this.updateItem(id, { archived: false });
  }

  static trashItem(id: string): boolean {
    return !!this.updateItem(id, { trashed: true });
  }

  static restoreItem(id: string): boolean {
    return !!this.updateItem(id, { trashed: false });
  }

  static permanentDelete(id: string): boolean {
    const items = this.getAll();
    const filtered = items.filter((i) => i.id !== id);
    if (filtered.length === items.length) return false;
    StorageService.saveItems(filtered);
    return true;
  }

  static emptyTrash(): number {
    const items = this.getAll();
    const active = items.filter((i) => !i.trashed);
    const count = items.length - active.length;
    StorageService.saveItems(active);
    return count;
  }

  static recordView(id: string): void {
    const item = this.getById(id);
    if (!item) return;
    this.updateItem(id, {
      viewCount: (item.viewCount || 0) + 1,
      lastViewedAt: new Date().toISOString(),
    });
  }

  static getAllTags(): { name: string; count: number }[] {
    const items = this.getAll().filter((i) => !i.trashed && !i.archived);
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
}
