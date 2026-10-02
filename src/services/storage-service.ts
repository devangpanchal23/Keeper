import { Collection, FieldProvenance, ImportLimits, SavedItem, User } from "@/types";
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
  IMPORT_LIMITS_PREFIX: "recall_import_limits_user_",
};

export class StorageService {
  private static memoryStore = new Map<string, string>();

  private static getStorage(): {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  } {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage;
    }
    return {
      getItem: (key: string) => StorageService.memoryStore.get(key) ?? null,
      setItem: (key: string, value: string) => {
        StorageService.memoryStore.set(key, value);
      },
      removeItem: (key: string) => {
        StorageService.memoryStore.delete(key);
      },
    };
  }

  private static isClient(): boolean {
    return true;
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

    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.ITEMS_PREFIX}${activeId}`;
    const storage = this.getStorage();

    try {
      const data = storage.getItem(storageKey);
      if (!data) {
        // If demo user or legacy anonymous workspace, load demo seeds
        if (activeId === "user-demo-1" || activeId === "anonymous") {
          const legacy = storage.getItem(STORAGE_KEYS.LEGACY_ITEMS);
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
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.ITEMS_PREFIX}${activeId}`;
    try {
      this.getStorage().setItem(storageKey, JSON.stringify(items));
    } catch (err) {
      console.error("StorageService.saveItems error:", err);
    }
  }

  static clearUserData(userId?: string): void {
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.ITEMS_PREFIX}${activeId}`;
    try {
      this.getStorage().removeItem(storageKey);
    } catch (err) {
      console.error("StorageService.clearUserData error:", err);
    }
  }

  // ---------------------------------------------------------------------------
  // Collections (Multi-User Isolated)
  // ---------------------------------------------------------------------------

  static getCollections(userId?: string): Collection[] {
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.COLLECTIONS_PREFIX}${activeId}`;
    const storage = this.getStorage();

    try {
      const data = storage.getItem(storageKey);
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
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.COLLECTIONS_PREFIX}${activeId}`;
    try {
      this.getStorage().setItem(storageKey, JSON.stringify(collections));
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
  // Import Limits & Quota
  // ---------------------------------------------------------------------------

  static getImportLimits(userId?: string): ImportLimits {
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.IMPORT_LIMITS_PREFIX}${activeId}`;
    const storage = this.getStorage();

    try {
      const data = storage.getItem(storageKey);
      if (data) {
        const parsed = JSON.parse(data);
        if (typeof parsed.total === "number" && typeof parsed.used === "number") {
          const remaining = Math.max(0, parsed.total - parsed.used);
          return { total: parsed.total, used: parsed.used, remaining };
        }
      }
    } catch {}

    // Initialize default for user (example: 10 total -> 2 used -> 8 remaining)
    const user = AuthService.findUserById(activeId);
    let defaultTotal = 30;
    let defaultUsed = 0;

    if (user?.importLimits) {
      defaultTotal = user.importLimits.total;
      defaultUsed = user.importLimits.used;
    } else if (activeId === "user-demo-1" || activeId === "anonymous") {
      defaultTotal = 30;
      defaultUsed = 0;
    }

    const limits: ImportLimits = {
      total: defaultTotal,
      used: defaultUsed,
      remaining: Math.max(0, defaultTotal - defaultUsed),
    };
    this.setImportLimits(limits, activeId);
    return limits;
  }

  static setImportLimits(limits: { total: number; used: number }, userId?: string): ImportLimits {
    const activeId = userId || this.getActiveUserId();
    const storageKey = `${STORAGE_KEYS.IMPORT_LIMITS_PREFIX}${activeId}`;
    const normalized: ImportLimits = {
      total: Math.max(0, limits.total),
      used: Math.max(0, limits.used),
      remaining: Math.max(0, limits.total - limits.used),
    };

    try {
      this.getStorage().setItem(
        storageKey,
        JSON.stringify({ total: normalized.total, used: normalized.used })
      );

      // Persist to user record in DB if user exists
      const users = AuthService.getUsers();
      const userIdx = users.findIndex((u) => u.id === activeId);
      if (userIdx !== -1) {
        users[userIdx] = {
          ...users[userIdx],
          importLimits: { total: normalized.total, used: normalized.used },
          updatedAt: new Date().toISOString(),
        };
        AuthService.saveUsers(users);
      }
    } catch (err) {
      console.error("StorageService.setImportLimits error:", err);
    }

    return normalized;
  }

  static deductImportLimit(count = 1, userId?: string): { success: boolean; limits: ImportLimits } {
    const current = this.getImportLimits(userId);
    if (current.remaining < count || current.remaining <= 0) {
      return { success: false, limits: current };
    }

    const newUsed = current.used + count;
    const updated = this.setImportLimits({ total: current.total, used: newUsed }, userId);
    return { success: true, limits: updated };
  }

  // ---------------------------------------------------------------------------
  // Durable Media Preview Cache
  // ---------------------------------------------------------------------------

  static getCachedMediaPreview(cacheKey: string): string | null {
    const storageKey = `recall_preview_${cacheKey}`;
    try {
      return this.getStorage().getItem(storageKey);
    } catch {
      return null;
    }
  }

  static setCachedMediaPreview(cacheKey: string, previewUrl: string): void {
    const storageKey = `recall_preview_${cacheKey}`;
    try {
      this.getStorage().setItem(storageKey, previewUrl);
    } catch (err) {
      console.error("StorageService.setCachedMediaPreview error:", err);
    }
  }

  static clearMediaPreviewCache(): void {
    if (typeof window !== "undefined" && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith("recall_preview_")) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => window.localStorage.removeItem(k));
    } else {
      StorageService.memoryStore.clear();
    }
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
