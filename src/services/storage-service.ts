import { Collection, FieldProvenance, SavedItem, User } from "@/types";
import { INITIAL_COLLECTIONS, INITIAL_SAVED_ITEMS } from "@/data/seed-data";
import { AuthService } from "./auth-service";

const STORAGE_KEYS = {
  ITEMS_PREFIX: "recall_items_user_",
  LEGACY_ITEMS: "recall_saved_items_v1",
  COLLECTIONS_PREFIX: "recall_collections_user_",
  LEGACY_COLLECTIONS: "recall_collections_v1",
  USER: "recall_user_v1",
  RECENT_SEARCHES_PREFIX: "recall_searches_user_",
  LEGACY_RECENT_SEARCHES: "recall_recent_searches_v1",
  AI_CHAT_HISTORY: "recall_ai_chat_history_v1",
};

export class StorageService {
  private static isClient(): boolean {
    return typeof window !== "undefined";
  }

  static getActiveUserId(): string {
    const session = AuthService.getSession();
    return session ? session.userId : "anonymous";
  }

  // ---------------------------------------------------------------------------
  // Items (Multi-User Isolated)
  // ---------------------------------------------------------------------------

  static getItems(userId?: string): SavedItem[] {
    const normalize = (items: SavedItem[]): SavedItem[] => {
      if (!Array.isArray(items)) return [];
      return items.map((item) => {
        const contentStatus = item.contentStatus || (item.isLimited ? "METADATA_ONLY" : "FULL_CONTENT");
        const defaultRetrievedAt = item.savedDate || new Date().toISOString();
        const fallbackProvenance: Record<string, FieldProvenance> = {
          title: {
            value: item.title || "",
            source: `${item.platform || "web"}_source`,
            retrievedAt: defaultRetrievedAt,
          },
          creator: {
            value: item.creator?.name || "Unknown Creator",
            source: `${item.platform || "web"}_channel`,
            retrievedAt: defaultRetrievedAt,
          },
          summary: {
            value: item.aiSummary?.standard || "",
            source: "ai",
            basedOn: ["source_metadata", "description"],
            retrievedAt: defaultRetrievedAt,
          },
        };

        const provenance: Record<string, FieldProvenance> = item.provenance || fallbackProvenance;

        return {
          ...item,
          contentStatus,
          isLimited: item.isLimited ?? false,
          provenance,
        };
      });
    };

    if (!this.isClient()) return normalize(INITIAL_SAVED_ITEMS);

    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.ITEMS_PREFIX}${activeId}`;

    try {
      const data = localStorage.getItem(storageKey);
      if (!data) {
        // If demo user or legacy anonymous workspace, load demo seeds
        if (activeId === "user-demo-1" || activeId === "anonymous") {
          const legacy = localStorage.getItem(STORAGE_KEYS.LEGACY_ITEMS);
          const initial = legacy ? JSON.parse(legacy) : INITIAL_SAVED_ITEMS;
          const normalized = normalize(initial);
          this.saveItems(normalized, activeId);
          return normalized;
        }
        // Newly registered accounts start clean with zero data leakage
        return [];
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? normalize(parsed) : [];
    } catch (err) {
      console.error("StorageService.getItems error:", err);
      return [];
    }
  }

  static saveItems(items: SavedItem[], userId?: string): void {
    if (!this.isClient()) return;
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.ITEMS_PREFIX}${activeId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch (err) {
      console.error("StorageService.saveItems error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Collections (Multi-User Isolated)
  // ---------------------------------------------------------------------------

  static getCollections(userId?: string): Collection[] {
    if (!this.isClient()) return INITIAL_COLLECTIONS;

    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.COLLECTIONS_PREFIX}${activeId}`;

    try {
      const data = localStorage.getItem(storageKey);
      if (!data) {
        this.saveCollections(INITIAL_COLLECTIONS, activeId);
        return INITIAL_COLLECTIONS;
      }
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : INITIAL_COLLECTIONS;
    } catch (err) {
      console.error("StorageService.getCollections error:", err);
      return INITIAL_COLLECTIONS;
    }
  }

  static saveCollections(collections: Collection[], userId?: string): void {
    if (!this.isClient()) return;
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.COLLECTIONS_PREFIX}${activeId}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(collections));
    } catch (err) {
      console.error("StorageService.saveCollections error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // User Profile
  // ---------------------------------------------------------------------------

  static getUser(): User | null {
    return AuthService.getCurrentUser();
  }

  static saveUser(user: User): void {
    if (!this.isClient()) return;
    try {
      localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
      const users = AuthService.getUsers();
      const index = users.findIndex((u) => u.id === user.id);
      if (index !== -1) {
        users[index] = {
          ...users[index],
          ...user,
          updatedAt: new Date().toISOString(),
        };
        AuthService.saveUsers(users);
      }
    } catch (err) {
      console.error("StorageService.saveUser error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Recent Searches
  // ---------------------------------------------------------------------------

  static getRecentSearches(userId?: string): string[] {
    if (!this.isClient()) return ["React performance", "AI agents"];
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.RECENT_SEARCHES_PREFIX}${activeId}`;
    try {
      const data = localStorage.getItem(storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  static addRecentSearch(query: string, userId?: string): void {
    if (!this.isClient() || !query.trim()) return;
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.RECENT_SEARCHES_PREFIX}${activeId}`;
    try {
      const current = this.getRecentSearches(activeId).filter((q) => q.toLowerCase() !== query.toLowerCase());
      const updated = [query.trim(), ...current].slice(0, 10);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (err) {
      console.error("StorageService.addRecentSearch error:", err);
    }
  }

  static clearRecentSearches(userId?: string): void {
    if (!this.isClient()) return;
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.RECENT_SEARCHES_PREFIX}${activeId}`;
    localStorage.removeItem(storageKey);
  }

  // ---------------------------------------------------------------------------
  // Reset / Demo
  // ---------------------------------------------------------------------------

  static resetToDefaults(): void {
    if (!this.isClient()) return;
    const activeId = this.getActiveUserId();
    this.saveItems(INITIAL_SAVED_ITEMS, activeId);
    this.saveCollections(INITIAL_COLLECTIONS, activeId);
  }

  // ---------------------------------------------------------------------------
  // Export / Import
  // ---------------------------------------------------------------------------

  static exportBackup(): string {
    const user = this.getUser();
    return JSON.stringify(
      {
        version: 1,
        exportedAt: new Date().toISOString(),
        items: this.getItems(),
        collections: this.getCollections(),
        user,
      },
      null,
      2
    );
  }

  static importBackup(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      if (Array.isArray(parsed.items) && Array.isArray(parsed.collections)) {
        this.saveItems(parsed.items);
        this.saveCollections(parsed.collections);
        if (parsed.user) this.saveUser(parsed.user);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Import failed:", e);
      return false;
    }
  }
}
