"use client";

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Collection, DeleteCollectionItemsResult, ImportLimits, SavedItem, SearchFilters, ToastMessage, User, ViewMode } from "@/types";
import { StorageService } from "@/services/storage-service";
import { ContentService } from "@/services/content-service";
import { CollectionService } from "@/services/collection-service";
import { AIService } from "@/services/ai-service";
import { AuthService } from "@/services/auth-service";
import { MigrationService } from "@/services/migration-service";
import { getCanonicalIdentityKey, isSameContentItem } from "@/lib/media-identity";
import { readWorkspaceMedia } from "@/services/workspace-media-read";

export interface UpdateItemOptions {
  silent?: boolean;
  toast?: {
    title?: string;
    description?: string;
  };
}

export interface RecallContextType {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;

  // Sync State
  syncStatus: "idle" | "syncing" | "synced" | "offline" | "error";
  lastSyncTime: string | null;
  syncWorkspace: () => Promise<void>;

  // Import Limits State & Quota
  importLimits: ImportLimits;
  deductImportLimits: (count?: number) => boolean;
  canImport: (count?: number) => boolean;
  refreshImportLimits: () => void;
  addImportCredits: (count: number) => void;

  // Content & Workspace State
  items: SavedItem[];
  collections: Collection[];
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;
  searchFilters: SearchFilters;
  setSearchFilters: React.Dispatch<React.SetStateAction<SearchFilters>>;
  resetFilters: () => void;
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
  toasts: ToastMessage[];
  addToast: (
    title: string,
    description?: string,
    type?: ToastMessage["type"],
    options?: { key?: string; duration?: number; isUserAction?: boolean }
  ) => void;
  removeToast: (id: string) => void;

  // Auth Actions
  login: (credentials: { email: string; password: string }) => Promise<void>;
  signup: (data: { name: string; email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
  updatePlan: (tier: "basic" | "pro") => Promise<void>;
  syncBillingTier: (tier: "free" | "basic" | "pro") => void;
  updateProfile: (updates: { name?: string; email?: string; avatar?: string }) => Promise<void>;
  updatePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  demoLogin: () => Promise<void>;

  // Modals
  isAddContentOpen: boolean;
  addContentInitialUrl: string;
  addContentInitialCollectionId?: string;
  openAddContent: (initialUrl?: string, initialCollectionId?: string) => void;
  closeAddContent: () => void;

  isCommandPaletteOpen: boolean;
  openCommandPalette: () => void;
  closeCommandPalette: () => void;

  isCollectionModalOpen: boolean;
  editingCollection: Collection | null;
  openCollectionModal: (col?: Collection) => void;
  closeCollectionModal: () => void;

  isQuickNoteModalOpen: boolean;
  quickNoteItem: SavedItem | null;
  openQuickNoteModal: (item: SavedItem) => void;
  closeQuickNoteModal: () => void;

  // Content Actions
  addItem: (item: Omit<SavedItem, "id" | "savedDate"> & { id?: string; savedDate?: string }) => SavedItem;
  updateItem: (id: string, updates: Partial<SavedItem>, options?: UpdateItemOptions) => void;
  toggleFavorite: (id: string) => void;
  archiveItem: (id: string) => void;
  unarchiveItem: (id: string) => void;
  trashItem: (id: string) => void;
  restoreItem: (id: string) => void;
  permanentDeleteItem: (id: string) => void;
  emptyTrash: () => void;

  createCollection: (col: Omit<Collection, "id" | "createdAt" | "updatedAt">) => Collection;
  refreshWorkspaceCollections: () => Promise<void>;
  refreshWorkspaceItems: () => SavedItem[];
  updateCollection: (id: string, updates: Partial<Omit<Collection, "id" | "createdAt">>) => void;
  deleteCollection: (id: string) => void;
  deleteCollectionItems: (collectionId: string, itemIds?: string[], selectAll?: boolean) => Promise<DeleteCollectionItemsResult>;

  resetDemoData: () => void;
  recordView: (id: string) => void;
  reprocessItem: (id: string) => Promise<SavedItem | null>;
  reprocessAllItems: () => Promise<number>;
}

const defaultSearchFilters: SearchFilters = {
  query: "",
  platform: "all",
  contentType: "all",
  collectionId: "all",
  tag: "all",
  favoriteOnly: false,
  dateRange: "all",
  sortBy: "newest",
};

const RecallContext = createContext<RecallContextType | undefined>(undefined);

export function RecallProvider({ children }: { children: React.ReactNode }) {
  // Authentication State (single source of truth)
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Synchronization State
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "synced" | "offline" | "error">("idle");
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Workspace items and collections
  const [items, setItems] = useState<SavedItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("dark");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(defaultSearchFilters);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastsRef = useRef<ToastMessage[]>([]);
  useEffect(() => {
    toastsRef.current = toasts;
  }, [toasts]);
  const [importLimits, setImportLimits] = useState<ImportLimits>({ total: 30, used: 0, remaining: 30 });

  // Modals state
  const [isAddContentOpen, setIsAddContentOpen] = useState(false);
  const [addContentInitialUrl, setAddContentInitialUrl] = useState("");
  const [addContentInitialCollectionId, setAddContentInitialCollectionId] = useState<string | undefined>(undefined);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isCollectionModalOpen, setIsCollectionModalOpen] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [isQuickNoteModalOpen, setIsQuickNoteModalOpen] = useState(false);
  const [quickNoteItem, setQuickNoteItem] = useState<SavedItem | null>(null);

  // Sync theme changes with DOM
  const applyThemeClass = (targetTheme: "light" | "dark" | "system") => {
    if (typeof window === "undefined") return;
    const root = document.documentElement;
    root.classList.remove("light", "dark");

    const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = targetTheme === "dark" || (targetTheme === "system" && systemDark);

    if (isDark) {
      root.classList.add("dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.add("light");
      root.style.colorScheme = "light";
    }
  };

  const setTheme = (newTheme: "light" | "dark" | "system") => {
    setThemeState(newTheme);
    applyThemeClass(newTheme);
    if (user) {
      const updatedUser: User = {
        ...user,
        settings: { ...user.settings, theme: newTheme },
      };
      setUser(updatedUser);
      StorageService.saveUser(updatedUser);
    }
  };

  const refreshPlanFromBilling = useCallback(async (_userId: string) => {
    // Open-Source Edition: No paid subscriptions or billing endpoints to poll
  }, []);

  const currentUserId = user?.id;

  /**
   * Central cross-device synchronization engine:
   * 1. Safely merges legacy local-only data into user's account without duplicates.
   * 2. Synchronizes collections bidirectionally with server single-source-of-truth.
   * 3. Synchronizes media items bidirectionally with server single-source-of-truth.
   * 4. Updates device cache for fast offline resilience.
   */
  const syncWorkspace = useCallback(async (targetUserId?: string): Promise<void> => {
    const activeId = targetUserId || user?.id || StorageService.getActiveUserId();
    if (!activeId || activeId === "anonymous" || activeId.startsWith("user-demo")) return;

    setSyncStatus("syncing");

    try {
      // Establish a successful authenticated server read before migration,
      // uploads, local reconciliation, or cache replacement.
      const serverRead = await readWorkspaceMedia();
      if (serverRead.kind !== "success") {
        throw new Error(serverRead.message);
      }
      const collectionsPreflight = await fetch("/api/collections/sync", { cache: "no-store" });
      if (!collectionsPreflight.ok) throw new Error("Workspace collections could not be read.");
      const preflightPayload = await collectionsPreflight.json() as { collections?: unknown };
      if (!Array.isArray(preflightPayload.collections)) throw new Error("Workspace collections response was invalid.");

      // 1. Repair any corrupted entity records safely and idempotently
      MigrationService.repairUserData(activeId);

      // 2. Discover and safely merge local-only legacy data into this user account
      const migration = MigrationService.migrateLegacyData(activeId);

      // 3 & 4. Synchronize collections and media concurrently for fast loading
      const syncCollections = async () => {
        try {
          if (migration.collectionsToSync.length > 0) {
            const uploadResponse = await fetch("/api/collections/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ collections: migration.collectionsToSync }),
            });
            if (!uploadResponse.ok) throw new Error("Local collections could not be synchronized.");
          }

          const colRes = await fetch("/api/collections/sync", { cache: "no-store" });
          if (!colRes.ok) throw new Error("Workspace collections could not be read after synchronization.");
          const colData = await colRes.json() as {
            collections?: Array<{
              id: string;
              name: string;
              description?: string | null;
              profile?: Record<string, unknown>;
              updated_at?: string;
            }>;
          };
          if (!Array.isArray(colData.collections)) throw new Error("Workspace collections response was invalid.");
          const serverCols: Collection[] = colData.collections.map((entry) => {
            const profile = entry.profile || {};
            return {
              id: entry.id,
              name: entry.name,
              description: entry.description || "",
              color: typeof profile.color === "string" ? profile.color : "#d9ad32",
              icon: typeof profile.icon === "string" ? profile.icon : "Folder",
              createdAt: entry.updated_at || new Date().toISOString(),
              updatedAt: entry.updated_at || new Date().toISOString(),
              ...(profile.isSystem === true ? { isSystem: true } : {}),
            };
          });
          StorageService.saveCollections(serverCols, activeId);
          setCollections(serverCols);
        } catch (colErr) {
          console.warn("Could not synchronize collections with server; using local collections:", colErr);
          throw colErr;
        }
      };

      const syncMedia = async () => {
        let currentItems = StorageService.getItems(activeId);
        try {
          if (migration.itemsToSync.length > 0) {
            const syncRes = await fetch("/api/media/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ localItems: migration.itemsToSync }),
            });
            if (!syncRes.ok) throw new Error("Legacy workspace media could not be synchronized.");
            const syncPayload = await syncRes.json() as { items?: SavedItem[] };
            if (!Array.isArray(syncPayload.items)) throw new Error("Legacy workspace sync returned an invalid response.");
            currentItems = syncPayload.items;
            StorageService.saveItems(currentItems, activeId);
            setItems(currentItems);
          } else {
            // Index local items only after the server read succeeded.
            const localByKey = new Map<string, SavedItem>();
            for (const item of currentItems) {
              const key = getCanonicalIdentityKey(item.url) || item.url.toLowerCase().trim();
              localByKey.set(key, item);
            }

            const serverItems = serverRead.items.map((serverItem) => {
              const key = getCanonicalIdentityKey(serverItem.url) || serverItem.url.toLowerCase().trim();
              const localItem = localByKey.get(key);
              if (localItem) localByKey.delete(key);
              return localItem ? ContentService.safeMerge(localItem, serverItem) : serverItem;
            });

            const unSyncedLocal: SavedItem[] = [];
            for (const localItem of localByKey.values()) {
              const alreadyMatched = serverItems.some((serverItem) => isSameContentItem(serverItem, localItem));
              if (!alreadyMatched) unSyncedLocal.push(localItem);
            }

            if (unSyncedLocal.length > 0) {
              const uploadRes = await fetch("/api/media", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: unSyncedLocal }),
              });
              if (!uploadRes.ok) throw new Error("Local workspace items could not be synchronized.");
            }

            const combined = [...serverItems, ...unSyncedLocal];
            const seenKeys = new Set<string>();
            currentItems = combined.filter((item) => {
              const key = getCanonicalIdentityKey(item.url) || item.url.toLowerCase().trim();
              if (seenKeys.has(key)) return false;
              seenKeys.add(key);
              return true;
            });
            StorageService.saveItems(currentItems, activeId);
            setItems(currentItems);
          }
        } catch (mediaErr) {
          console.warn("Could not synchronize media with server; using local storage:", mediaErr);
          throw mediaErr;
        }
      };

      await Promise.all([syncCollections(), syncMedia()]);
      setSyncStatus("synced");
      setLastSyncTime(new Date().toISOString());
      setToasts((prev) => prev.filter((t) => t.key !== "sync-failure"));
    } catch (err) {
      console.warn("Workspace synchronization finished with offline fallback:", err);
      setSyncStatus("offline");
    }
  }, [user?.id]);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId) return;
    const userId = currentUserId;
    const syncUsage = () => {
      void fetch("/api/usage", { cache: "no-store" }).then(async (response) => {
        if (!response.ok) return;
        const usage = await response.json() as { total: number | null; used: number };
        const current = StorageService.getImportLimits(userId);
        const total = usage.total ?? Math.max(current.total, usage.used + 1);
        setImportLimits(StorageService.setImportLimits({ total, used: usage.used }, userId));
      }).catch((error: unknown) => {
        console.warn("Could not load server import usage.", error);
      });
    };
    syncUsage();
    const timer = window.setInterval(syncUsage, 5 * 60 * 1000);
    window.addEventListener("focus", syncUsage);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", syncUsage);
    };
  }, [isAuthenticated, currentUserId]);


  // Listen to OS system color scheme changes when theme is "system"
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeClass("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Synchronize items with storage changes (e.g. bulk import or multi-tab saves)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleItemsChanged = (e?: Event) => {
      const customEvent = e as CustomEvent<{ userId?: string }> | undefined;
      const targetUserId = customEvent?.detail?.userId;
      const activeId = user?.id || StorageService.getActiveUserId();
      if (!targetUserId || targetUserId === activeId) {
        const latest = StorageService.getItems(activeId);
        setItems(latest);
      }
    };
    window.addEventListener("keeper:items-changed", handleItemsChanged);
    window.addEventListener("storage", handleItemsChanged);
    return () => {
      window.removeEventListener("keeper:items-changed", handleItemsChanged);
      window.removeEventListener("storage", handleItemsChanged);
    };
  }, [user?.id]);

  // Automatic network reconnection synchronization
  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated || !currentUserId) return;
    const handleOnline = () => {
      void syncWorkspace(currentUserId);
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [isAuthenticated, currentUserId, syncWorkspace]);

  // Automatic focus re-sync (debounced to avoid unnecessary network traffic)
  useEffect(() => {
    if (typeof window === "undefined" || !isAuthenticated || !currentUserId || currentUserId.startsWith("user-demo")) return;
    let lastFocusSync = Date.now();
    const handleFocusSync = () => {
      if (Date.now() - lastFocusSync >= 30_000) {
        lastFocusSync = Date.now();
        void syncWorkspace(currentUserId);
      }
    };
    window.addEventListener("focus", handleFocusSync);
    return () => window.removeEventListener("focus", handleFocusSync);
  }, [isAuthenticated, currentUserId, syncWorkspace]);

  // Load user from active session on initial mount
  useEffect(() => {
    void (async () => {
      try {
        const activeUser = await AuthService.getCurrentUserAsync();
        if (activeUser) {
          setUser(activeUser);
          setIsAuthenticated(true);

          const userSearches = StorageService.getRecentSearches(activeUser.id);
          const storedLimits = StorageService.getImportLimits(activeUser.id);
          const userLimits = activeUser.tier === "free" && storedLimits.total === 10
            ? StorageService.setImportLimits({ total: 30, used: storedLimits.used }, activeUser.id)
            : storedLimits;

          setRecentSearches(userSearches);
          setImportLimits(userLimits);

          const savedTheme = activeUser.settings?.theme || "dark";
          setThemeState(savedTheme);
          applyThemeClass(savedTheme);

          // Populate workspace state immediately from fast local cache
          const cachedItems = StorageService.getItems(activeUser.id);
          const cachedCollections = StorageService.getCollections(activeUser.id);
          if (cachedItems.length > 0) setItems(cachedItems);
          if (cachedCollections.length > 0) setCollections(cachedCollections);

          // Unblock auth loading immediately so the user does not wait on network roundtrips
          setAuthLoading(false);

          // Authoritative workspace sync runs smoothly in the background
          void syncWorkspace(activeUser.id);
        } else {
          setUser(null);
          setIsAuthenticated(false);
          setItems([]);
          setCollections([]);
          setImportLimits({ total: 30, used: 0, remaining: 30 });
          applyThemeClass("dark");
          setAuthLoading(false);
        }
      } catch (err) {
        console.warn("Could not load initial user session:", err);
        setAuthLoading(false);
      }
    })();
  }, [syncWorkspace]);

  useEffect(() => {
    const clearCrossTabSession = () => {
      AuthService.clearSession();
      setUser(null);
      setIsAuthenticated(false);
      setItems([]);
      setCollections([]);
      setImportLimits({ total: 30, used: 0, remaining: 30 });
      window.location.replace("/sign-in");
    };
    const handleCrossTabLogout = (event: StorageEvent) => {
      if (event.key === "keeper_auth_logout_signal_v1" && event.newValue) {
        clearCrossTabSession();
      }
    };
    window.addEventListener("storage", handleCrossTabLogout);
    return () => window.removeEventListener("storage", handleCrossTabLogout);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !currentUserId || currentUserId.startsWith("user-demo")) return;
    let checking = false;
    const verifyServerSession = async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store" });
        if (response.status === 401) {
          AuthService.clearSession();
          setUser(null);
          setIsAuthenticated(false);
          setItems([]);
          setCollections([]);
          setImportLimits({ total: 30, used: 0, remaining: 30 });
          window.location.replace("/sign-in?error=session-expired");
        }
      } catch (error) {
        console.warn("Could not verify the active Keeper session.", error);
      } finally {
        checking = false;
      }
    };
    const timer = window.setInterval(() => { void verifyServerSession(); }, 60 * 1000);
    window.addEventListener("focus", verifyServerSession);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", verifyServerSession);
    };
  }, [isAuthenticated, currentUserId]);

  // ---------------------------------------------------------------------------
  // Authentication Actions
  // ---------------------------------------------------------------------------

  const login = async (credentials: { email: string; password: string }) => {
    setAuthLoading(true);
    try {
      const { user: authedUser } = await AuthService.login(credentials);
      setUser(authedUser);
      setIsAuthenticated(true);

      // Immediately clear previous state to prevent any cross-account data leak
      setItems([]);
      setCollections([]);

      const userSearches = StorageService.getRecentSearches(authedUser.id);
      const userLimits = StorageService.getImportLimits(authedUser.id);
      setRecentSearches(userSearches);
      setImportLimits(userLimits);

      const savedTheme = authedUser.settings?.theme || "dark";
      setThemeState(savedTheme);
      applyThemeClass(savedTheme);

      // Immediately sync with the server single source of truth
      await syncWorkspace(authedUser.id);
    } finally {
      setAuthLoading(false);
    }
  };

  const signup = async (data: { name: string; email: string; password: string }) => {
    setAuthLoading(true);
    try {
      const { user: newUser } = await AuthService.signup(data);
      setUser(newUser);
      setIsAuthenticated(true);

      // Clear previous in-memory state
      setItems([]);
      setCollections([]);
      setRecentSearches([]);

      // Migrate any local data and sync workspace
      await syncWorkspace(newUser.id);
      const userLimits = StorageService.getImportLimits(newUser.id);
      setImportLimits(userLimits);

      const savedTheme = newUser.settings?.theme || "dark";
      setThemeState(savedTheme);
      applyThemeClass(savedTheme);
      addToast(
        "Account created successfully",
        `Welcome to Keeper, ${newUser.name}. Your workspace is ready to use.`,
        "success",
      );
    } finally {
      setAuthLoading(false);
    }
  };

  const demoLogin = async () => {
    await login({ email: "devang@recall.ai", password: "••••••••••••" });
  };

  const logout = async () => {
    try {
      await AuthService.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setItems([]);
      setCollections([]);
      setRecentSearches([]);
      setSyncStatus("idle");
      setImportLimits({ total: 30, used: 0, remaining: 30 });
    }
  };

  const updateProfile = async (updates: { name?: string; email?: string; avatar?: string }) => {
    if (!user) throw new Error("Not authenticated");
    const updated = await AuthService.updateProfile(user.id, updates);
    setUser(updated);
    addToast("Profile updated", "Your account information was successfully updated.", "success");
  };

  const updatePlan = async (tier: "basic" | "pro") => {
    if (!user) throw new Error("Not authenticated");
    const updated = await AuthService.updatePlan(user.id, tier);
    setUser(updated);
  };

  const syncBillingTier = useCallback((tier: "free" | "basic" | "pro") => {
    setUser((current) => current ? { ...current, tier } : current);
  }, []);

  const updatePassword = async (data: { currentPassword: string; newPassword: string }) => {
    if (!user) throw new Error("Not authenticated");
    await AuthService.updatePassword(user.id, data);
    addToast("Password changed", "Your password was successfully updated.", "success");
  };

  // Keyboard shortcut listener (CMD+K / CTRL+K and CMD+B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "n") {
        e.preventDefault();
        setIsAddContentOpen(true);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Toast Notification System (Enterprise deduplication, max 3 limit, cooldown, timer management)
  const toastHistoryRef = useRef<Map<string, number>>(new Map());
  const toastTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // Clean up all active toast timers on unmount
  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timer) => clearTimeout(timer));
      toastTimersRef.current.clear();
    };
  }, []);

  const removeToast = useCallback((id: string) => {
    const timer = toastTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      toastTimersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback((
    title: string,
    description?: string,
    type: ToastMessage["type"] = "success",
    options?: { key?: string; duration?: number; isUserAction?: boolean }
  ) => {
    const now = Date.now();
    const dedupeKey = options?.key || `${type}:${title}:${description || ""}`;

    // Determine whether this toast is a user-initiated action or system/error notification
    const isUserAction = options?.isUserAction !== undefined
      ? options.isUserAction
      : !(type === "error" || type === "warning" || options?.key === "sync-failure");

    if (isUserAction) {
      // For USER_ACTION toasts: dedupe only if an identical toast is currently visible (or within 2s)
      const isIdenticalVisible = toastsRef.current.some(
        (t) => (t.key && t.key === dedupeKey) || (t.title === title && t.description === description)
      );
      const lastShown = toastHistoryRef.current.get(dedupeKey);
      if (isIdenticalVisible || (lastShown && now - lastShown < 2000)) {
        return;
      }
    } else {
      // For system/error toasts: keep the 10s cooldown
      const lastShown = toastHistoryRef.current.get(dedupeKey);
      if (lastShown && now - lastShown < 10_000) {
        return;
      }
    }

    toastHistoryRef.current.set(dedupeKey, now);

    // Garbage-collect old history keys beyond 60s
    if (toastHistoryRef.current.size > 50) {
      for (const [k, ts] of toastHistoryRef.current.entries()) {
        if (now - ts > 60_000) {
          toastHistoryRef.current.delete(k);
        }
      }
    }

    const duration = options?.duration || (type === "error" || type === "warning" ? 6000 : 3500);
    const id = `toast-${now}-${Math.random().toString(36).substring(2, 9)}`;

    const timer = setTimeout(() => {
      removeToast(id);
    }, duration);
    toastTimersRef.current.set(id, timer);

    setToasts((prev) => {
      const next = [...prev];
      // Keep maximum 3 visible notifications (evict oldest)
      while (next.length >= 3) {
        const oldest = next.shift();
        if (oldest) {
          const oldTimer = toastTimersRef.current.get(oldest.id);
          if (oldTimer) {
            clearTimeout(oldTimer);
            toastTimersRef.current.delete(oldest.id);
          }
        }
      }
      return [
        ...next,
        {
          id,
          title,
          description,
          type,
          duration,
          key: dedupeKey,
          timestamp: now,
        },
      ];
    });
  }, [removeToast]);

  const reportServerMutationFailure = useCallback(() => {
    setSyncStatus("error");
    addToast(
      "Sync needs attention",
      "Your local change is retained, but the server did not confirm it. Check synchronization before using another device.",
      "warning",
      { key: "sync-failure", duration: 7000, isUserAction: false }
    );
  }, [addToast]);

  const observeServerMutation = useCallback((request: Promise<Response>) => {
    void request.then((response) => {
      if (!response.ok) throw new Error("Server did not confirm the mutation.");
    }).catch(reportServerMutationFailure);
  }, [reportServerMutationFailure]);

  const resetFilters = () => {
    setSearchFilters(defaultSearchFilters);
  };

  const addRecentSearch = (query: string) => {
    StorageService.addRecentSearch(query, user?.id);
    setRecentSearches(StorageService.getRecentSearches(user?.id));
  };

  const clearRecentSearches = () => {
    StorageService.clearRecentSearches(user?.id);
    setRecentSearches([]);
  };

  // Modal actions
  const openAddContent = (initialUrl = "", initialCollectionId?: string) => {
    setAddContentInitialUrl(initialUrl);
    setAddContentInitialCollectionId(initialCollectionId);
    setIsAddContentOpen(true);
  };

  const closeAddContent = () => {
    setIsAddContentOpen(false);
    setAddContentInitialUrl("");
    setAddContentInitialCollectionId(undefined);
  };

  const openCommandPalette = () => setIsCommandPaletteOpen(true);
  const closeCommandPalette = () => setIsCommandPaletteOpen(false);

  const openCollectionModal = (col?: Collection) => {
    setEditingCollection(col || null);
    setIsCollectionModalOpen(true);
  };

  const closeCollectionModal = () => {
    setIsCollectionModalOpen(false);
    setEditingCollection(null);
  };

  const openQuickNoteModal = (item: SavedItem) => {
    setQuickNoteItem(item);
    setIsQuickNoteModalOpen(true);
  };

  const closeQuickNoteModal = () => {
    setIsQuickNoteModalOpen(false);
    setQuickNoteItem(null);
  };

  // Import limits handlers (Keeper Open-Source Edition: No artificial quotas)
  const deductImportLimits = (count = 1): boolean => {
    const result = StorageService.deductImportLimit(count, user?.id);
    setImportLimits(result.limits);
    return true;
  };

  const canImport = (_count = 1): boolean => {
    // Open-Source Edition: Unlimited imports for all users
    return true;
  };

  const refreshImportLimits = () => {
    const current = StorageService.getImportLimits(user?.id);
    setImportLimits(current);
  };

  const addImportCredits = (count: number) => {
    if (!user || !Number.isInteger(count) || count <= 0) return;
    const current = StorageService.getImportLimits(user.id);
    const updated = StorageService.setImportLimits({ total: current.total + count, used: current.used }, user.id);
    setImportLimits(updated);
  };

  // Content actions
  const addItem = (itemData: Omit<SavedItem, "id" | "savedDate"> & { id?: string; savedDate?: string }): SavedItem => {
    const activeUserId = user?.id || StorageService.getActiveUserId();

    const created = ContentService.addItem(itemData, activeUserId);
    setItems(ContentService.getAll(activeUserId));
    const deductResult = StorageService.deductImportLimit(1, activeUserId);
    setImportLimits(deductResult.limits);

    // Asynchronously synchronize created item to the server
    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      void fetch("/api/media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ item: created }),
      }).then(async (res) => {
        if (!res.ok) throw new Error("Server did not confirm the new item.");
        const payload = await res.json() as { items?: SavedItem[] };
        const serverItem = payload.items?.[0];
        if (serverItem?.metadata?.serverMediaId) {
          ContentService.updateItem(created.id, {
            metadata: {
              ...created.metadata,
              serverMediaId: serverItem.metadata.serverMediaId,
              aiProcessingStatus: serverItem.metadata.aiProcessingStatus || "PENDING",
            },
          }, activeUserId);
          setItems(ContentService.getAll(activeUserId));
        } else {
          throw new Error("Server response did not include the saved media ID.");
        }
      }).catch(reportServerMutationFailure);
    }

    addToast(
      "Saved to Library",
      `"${created.title}" was saved successfully.`,
      "success",
      { key: `item-add:${created.id}`, isUserAction: true }
    );
    return created;
  };

  const updateItem = (id: string, updates: Partial<SavedItem>, options?: UpdateItemOptions) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const previousItem = items.find((item) => item.id === id);
    ContentService.updateItem(id, updates, activeUserId);
    setItems(ContentService.getAll(activeUserId));

    // Asynchronously synchronize update to server
    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      const serverTargetId = previousItem?.metadata?.serverMediaId || id;
      observeServerMutation(fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      }));

      if (Object.prototype.hasOwnProperty.call(updates, "collectionId") && updates.collectionId !== previousItem?.collectionId && previousItem?.metadata?.serverMediaId) {
        observeServerMutation(fetch(`/api/media/${encodeURIComponent(previousItem.metadata.serverMediaId)}/collection`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collectionId: updates.collectionId ?? null }),
        }));
      }
    }

    // Programmatic, background, or default updates are completely silent
    if (options?.silent) {
      return;
    }

    // If an explicit toast is requested by a user-initiated action, show it
    if (options?.toast?.title) {
      addToast(
        options.toast.title,
        options.toast.description,
        "info",
        { key: `item-update:${id}:${options.toast.title}`, isUserAction: true }
      );
    }
  };

  const toggleFavorite = (id: string) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const isFav = ContentService.toggleFavorite(id, activeUserId);
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      const targetItem = items.find((i) => i.id === id);
      const serverTargetId = targetItem?.metadata?.serverMediaId || id;
      observeServerMutation(fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { favorite: isFav } }),
      }));
    }

    addToast(isFav ? "Added to Favorites" : "Removed from Favorites", undefined, "info");
  };

  const archiveItem = (id: string) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    ContentService.archiveItem(id, activeUserId);
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      const targetItem = items.find((i) => i.id === id);
      const serverTargetId = targetItem?.metadata?.serverMediaId || id;
      observeServerMutation(fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { archived: true, trashed: false } }),
      }));
    }

    addToast("Archived item", "Item moved to your archive.", "info");
  };

  const unarchiveItem = (id: string) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    ContentService.unarchiveItem(id, activeUserId);
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      const targetItem = items.find((i) => i.id === id);
      const serverTargetId = targetItem?.metadata?.serverMediaId || id;
      observeServerMutation(fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { archived: false } }),
      }));
    }

    addToast("Restored from archive", "Item is back in your active library.", "success");
  };

  const trashItem = (id: string) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    ContentService.trashItem(id, activeUserId);
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      const targetItem = items.find((i) => i.id === id);
      const serverTargetId = targetItem?.metadata?.serverMediaId || id;
      observeServerMutation(fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { trashed: true } }),
      }));
    }

    addToast("Moved to Trash", "Item can be restored from Trash.", "warning");
  };

  const restoreItem = (id: string) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    ContentService.restoreItem(id, activeUserId);
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      const targetItem = items.find((i) => i.id === id);
      const serverTargetId = targetItem?.metadata?.serverMediaId || id;
      observeServerMutation(fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { trashed: false } }),
      }));
    }

    addToast("Restored item", "Item returned to your library.", "success");
  };

  const permanentDeleteItem = (id: string) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const targetItem = items.find((i) => i.id === id);
    ContentService.permanentDelete(id, activeUserId);
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      const serverTargetId = targetItem?.metadata?.serverMediaId || id;
      observeServerMutation(fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "DELETE",
      }));
    }

    addToast("Permanently deleted", "Item removed forever.", "warning");
  };

  const emptyTrash = () => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const count = ContentService.emptyTrash(activeUserId);
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      observeServerMutation(fetch("/api/media?trashed=true", {
        method: "DELETE",
      }));
    }

    addToast("Trash emptied", `Permanently removed ${count} items.`, "info");
  };

  const recordView = (id: string) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    ContentService.recordView(id, activeUserId);
    setItems(ContentService.getAll(activeUserId));
  };

  const reprocessItem = async (id: string): Promise<SavedItem | null> => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const item = items.find((i) => i.id === id);
    if (!item) return null;
    try {
      addToast("Reprocessing content...", `Fetching verified metadata for "${item.title.slice(0, 24)}..."`, "info");
      const updated = await AIService.reprocessItem(item, collections);
      ContentService.updateItem(id, updated, activeUserId);
      setItems(ContentService.getAll(activeUserId));

      if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
        const serverTargetId = item.metadata?.serverMediaId || id;
        observeServerMutation(fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: updated }),
        }));
      }

      addToast("Content Reprocessed", `Updated metadata & grounded AI summary for "${updated.title}".`, "success");
      return updated;
    } catch (err) {
      console.error("Reprocess error:", err);
      addToast("Reprocessing Failed", "Could not reprocess this item.", "warning");
      return null;
    }
  };

  const reprocessAllItems = async (): Promise<number> => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    addToast("Reprocessing All Saves", "Auditing and re-analyzing all bookmarks against verified source metadata...", "info");
    try {
      const updatedAll = await AIService.reprocessAllItems(items, collections);
      StorageService.saveItems(updatedAll, activeUserId);
      setItems(updatedAll);

      if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
        observeServerMutation(fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: updatedAll }),
        }));
      }

      addToast("Reprocess Complete", `Successfully verified and reprocessed ${updatedAll.length} items.`, "success");
      return updatedAll.length;
    } catch (err) {
      console.error("Reprocess all error:", err);
      addToast("Reprocess failed", "An error occurred while reprocessing.", "warning");
      return 0;
    }
  };

  // Collection actions
  const createCollection = (colData: Omit<Collection, "id" | "createdAt" | "updatedAt">): Collection => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const newCol = CollectionService.create(colData, activeUserId);
    setCollections(CollectionService.getAll(activeUserId));

    // Asynchronously synchronize created collection to server
    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      observeServerMutation(fetch("/api/collections/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: newCol.id,
          name: newCol.name,
          description: newCol.description,
          color: newCol.color,
          icon: newCol.icon,
          isSystem: newCol.isSystem,
        }),
      }));
    }

    addToast("Collection created", `Collection "${newCol.name}" is ready.`, "success");
    return newCol;
  };

  const refreshWorkspaceCollections = async () => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    if (!activeUserId || activeUserId === "anonymous") return;
    try {
      const response = await fetch("/api/collections/sync", { cache: "no-store" });
      if (!response.ok) return;
      const payload = await response.json() as { collections?: Array<{ id: string; name: string; description?: string | null; profile?: Record<string, unknown>; updated_at?: string }> };
      if (Array.isArray(payload.collections)) {
        const serverCollections = payload.collections.map((entry) => {
          const profile = entry.profile || {};
          return {
            id: entry.id,
            name: entry.name,
            description: entry.description || "",
            color: typeof profile.color === "string" ? profile.color : "#d9ad32",
            icon: typeof profile.icon === "string" ? profile.icon : "Folder",
            createdAt: entry.updated_at || new Date().toISOString(),
            updatedAt: entry.updated_at || new Date().toISOString(),
            ...(profile.isSystem === true ? { isSystem: true } : {}),
          } as Collection;
        });
        StorageService.saveCollections(serverCollections, activeUserId);
        setCollections(serverCollections);
      }
    } catch (error) {
      console.warn("Workspace collection refresh failed; keeping local collections.", error);
    }
  };

  const refreshWorkspaceItems = useCallback((): SavedItem[] => {
    const activeId = user?.id || StorageService.getActiveUserId();
    const latest = StorageService.getItems(activeId);
    setItems(latest);
    return latest;
  }, [user?.id]);

  const updateCollection = (id: string, updates: Partial<Omit<Collection, "id" | "createdAt">>) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const updated = CollectionService.update(id, updates, activeUserId);
    setCollections(CollectionService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo") && updated) {
      observeServerMutation(fetch("/api/collections/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: updated.id,
          name: updated.name,
          description: updated.description,
          color: updated.color,
          icon: updated.icon,
          isSystem: updated.isSystem,
        }),
      }));
    }

    addToast("Collection updated", undefined, "info");
  };

  const deleteCollection = (id: string) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    CollectionService.delete(id, activeUserId);
    setCollections(CollectionService.getAll(activeUserId));
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      observeServerMutation(fetch(`/api/collections/sync?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }));
    }

    addToast("Collection deleted", "Items have been unlinked.", "warning");
  };

  const deleteCollectionItems = async (
    collectionId: string,
    itemIds?: string[],
    selectAll?: boolean
  ): Promise<DeleteCollectionItemsResult> => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const result = ContentService.deleteCollectionItems({
      userId: activeUserId,
      collectionId,
      itemIds,
      selectAll,
    });
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      observeServerMutation(fetch(`/api/collections/${encodeURIComponent(collectionId)}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds, selectAll }),
      }));
    }

    const totalCount = result.deleted + result.removedFromCollection;
    const targetCol = collections.find((c) => c.id === collectionId);
    const colName = targetCol ? `"${targetCol.name}"` : "collection";
    addToast(
      "Collection updated",
      `${totalCount} item(s) processed in ${colName} (${result.deleted} moved to Trash, ${result.removedFromCollection} kept in other collections).`,
      "info"
    );
    return result;
  };

  const resetDemoData = () => {
    StorageService.resetToDefaults();
    if (user) {
      setItems(StorageService.getItems(user.id));
      setCollections(StorageService.getCollections(user.id));
      setRecentSearches(StorageService.getRecentSearches(user.id));
      setImportLimits(StorageService.getImportLimits(user.id));
    } else {
      setImportLimits(StorageService.getImportLimits("anonymous"));
    }
    addToast("Sample library restored", "Sample items and collections were restored. Your plan and purchased credits were kept.", "success");
  };

  return (
    <RecallContext.Provider
      value={{
        user,
        isAuthenticated,
        authLoading,
        syncStatus,
        lastSyncTime,
        syncWorkspace: () => syncWorkspace(),
        importLimits,
        deductImportLimits,
        canImport,
        refreshImportLimits,
        addImportCredits,
        items,
        collections,
        viewMode,
        setViewMode,
        theme,
        setTheme,
        searchFilters,
        setSearchFilters,
        resetFilters,
        recentSearches,
        addRecentSearch,
        clearRecentSearches,
        toasts,
        addToast,
        removeToast,
        login,
        signup,
        logout,
        updatePlan,
        syncBillingTier,
        updateProfile,
        updatePassword,
        demoLogin,
        isAddContentOpen,
        addContentInitialUrl,
        addContentInitialCollectionId,
        openAddContent,
        closeAddContent,
        isCommandPaletteOpen,
        openCommandPalette,
        closeCommandPalette,
        isCollectionModalOpen,
        editingCollection,
        openCollectionModal,
        closeCollectionModal,
        isQuickNoteModalOpen,
        quickNoteItem,
        openQuickNoteModal,
        closeQuickNoteModal,
        addItem,
        updateItem,
        toggleFavorite,
        archiveItem,
        unarchiveItem,
        trashItem,
        restoreItem,
        permanentDeleteItem,
        emptyTrash,
        createCollection,
        refreshWorkspaceCollections,
        refreshWorkspaceItems,
        updateCollection,
        deleteCollection,
        deleteCollectionItems,
        resetDemoData,
        recordView,
        reprocessItem,
        reprocessAllItems,
      }}
    >
      {children}
    </RecallContext.Provider>
  );
}

export function useRecall() {
  const context = useContext(RecallContext);
  if (!context) {
    throw new Error("useRecall must be used within a RecallProvider");
  }
  return context;
}

export function useAuth() {
  const {
    user,
    isAuthenticated,
    authLoading,
    login,
    signup,
    logout,
    updatePlan,
    updateProfile,
    updatePassword,
    demoLogin,
  } = useRecall();

  return {
    user,
    isAuthenticated,
    authLoading,
    login,
    signup,
    logout,
    updatePlan,
    updateProfile,
    updatePassword,
    demoLogin,
  };
}
