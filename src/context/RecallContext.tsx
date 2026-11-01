"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Collection, DeleteCollectionItemsResult, ImportLimits, SavedItem, SearchFilters, ToastMessage, User, ViewMode } from "@/types";
import { StorageService } from "@/services/storage-service";
import { ContentService } from "@/services/content-service";
import { CollectionService } from "@/services/collection-service";
import { AIService } from "@/services/ai-service";
import { AuthService } from "@/services/auth-service";
import { MigrationService } from "@/services/migration-service";
import { getCanonicalIdentityKey, isSameContentItem } from "@/lib/media-identity";

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
  addToast: (title: string, description?: string, type?: ToastMessage["type"]) => void;
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
  updateItem: (id: string, updates: Partial<SavedItem>) => void;
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
    if (!activeId || activeId === "anonymous") return;

    setSyncStatus("syncing");

    try {
      // 1. Repair any corrupted entity records safely and idempotently
      MigrationService.repairUserData(activeId);

      // 2. Discover and safely merge local-only legacy data into this user account
      const migration = MigrationService.migrateLegacyData(activeId);

      // 3 & 4. Synchronize collections and media concurrently for fast loading
      const syncCollections = async () => {
        try {
          if (migration.collectionsToSync.length > 0) {
            await fetch("/api/collections/sync", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ collections: migration.collectionsToSync }),
            });
          }

          const colRes = await fetch("/api/collections/sync", { cache: "no-store" });
          if (colRes.ok) {
            const colData = await colRes.json() as {
              collections?: Array<{
                id: string;
                name: string;
                description?: string | null;
                profile?: Record<string, unknown>;
                updated_at?: string;
              }>;
            };
            if (Array.isArray(colData.collections)) {
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
            }
          }
        } catch (colErr) {
          console.warn("Could not synchronize collections with server; using local collections:", colErr);
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
            if (syncRes.ok) {
              const syncPayload = await syncRes.json() as { items?: SavedItem[] };
              if (Array.isArray(syncPayload.items)) {
                currentItems = syncPayload.items;
                StorageService.saveItems(currentItems, activeId);
                setItems(currentItems);
              }
            }
          } else {
            const mediaRes = await fetch("/api/media", { cache: "no-store" });
            if (mediaRes.ok) {
              const mediaPayload = await mediaRes.json() as { items?: SavedItem[] };
              if (Array.isArray(mediaPayload.items)) {
                // Index local items by canonical identity key to prevent cross-device duplicates
                const localByKey = new Map<string, SavedItem>();
                for (const item of currentItems) {
                  const key = getCanonicalIdentityKey(item.url) || item.url.toLowerCase().trim();
                  localByKey.set(key, item);
                }

                const serverItems = mediaPayload.items.map((serverItem) => {
                  const key = getCanonicalIdentityKey(serverItem.url) || serverItem.url.toLowerCase().trim();
                  const localItem = localByKey.get(key);
                  if (localItem) localByKey.delete(key);
                  return localItem ? ContentService.safeMerge(localItem, serverItem) : serverItem;
                });

                // Check remaining local items: do not re-upload if already matched by content equivalence
                const unSyncedLocal: SavedItem[] = [];
                for (const localItem of localByKey.values()) {
                  const alreadyMatched = serverItems.some((s) => isSameContentItem(s, localItem));
                  if (!alreadyMatched) {
                    unSyncedLocal.push(localItem);
                  }
                }

                if (unSyncedLocal.length > 0) {
                  void fetch("/api/media", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items: unSyncedLocal }),
                  });
                }

                // Final deduplication pass to ensure local state and storage are completely clean
                const combined = [...serverItems, ...unSyncedLocal];
                const seenKeys = new Set<string>();
                const deduped: SavedItem[] = [];
                for (const item of combined) {
                  const key = getCanonicalIdentityKey(item.url) || item.url.toLowerCase().trim();
                  if (!seenKeys.has(key)) {
                    seenKeys.add(key);
                    deduped.push(item);
                  }
                }

                currentItems = deduped;
                StorageService.saveItems(currentItems, activeId);
                setItems(currentItems);
              }
            }
          }
        } catch (mediaErr) {
          console.warn("Could not synchronize media with server; using local storage:", mediaErr);
          throw mediaErr;
        }
      };

      await Promise.all([syncCollections(), syncMedia()]);
      setSyncStatus("synced");
      setLastSyncTime(new Date().toISOString());
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

  // Toast Helpers
  const addToast = (title: string, description?: string, type: ToastMessage["type"] = "success") => {
    const id = `toast-${Date.now()}-${Math.random()}`;
    const newToast: ToastMessage = { id, title, description, type, duration: 4000 };
    setToasts((prev) => [...prev, newToast]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

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
        if (res.ok) {
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
          }
        }
      }).catch((err) => {
        console.warn("Could not immediately sync item to server:", err);
      });
    }

    addToast(
      "Item saved to Recall",
      `"${created.title}" is now analyzed and indexed.`,
      "success"
    );
    return created;
  };

  const updateItem = (id: string, updates: Partial<SavedItem>) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const previousItem = items.find((item) => item.id === id);
    ContentService.updateItem(id, updates, activeUserId);
    setItems(ContentService.getAll(activeUserId));

    // Asynchronously synchronize update to server
    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      const serverTargetId = previousItem?.metadata?.serverMediaId || id;
      void fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      }).catch((error: unknown) => {
        console.warn("Could not sync item update to server:", error);
      });

      if (Object.prototype.hasOwnProperty.call(updates, "collectionId") && updates.collectionId !== previousItem?.collectionId && previousItem?.metadata?.serverMediaId) {
        void fetch(`/api/media/${encodeURIComponent(previousItem.metadata.serverMediaId)}/collection`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collectionId: updates.collectionId ?? null }),
        }).catch((err) => {
          console.warn("Could not sync AI organization correction:", err);
        });
      }
    }

    addToast("Updated successfully", undefined, "info");
  };

  const toggleFavorite = (id: string) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const isFav = ContentService.toggleFavorite(id, activeUserId);
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      const targetItem = items.find((i) => i.id === id);
      const serverTargetId = targetItem?.metadata?.serverMediaId || id;
      void fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { favorite: isFav } }),
      }).catch((err) => console.warn("Could not sync favorite to server:", err));
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
      void fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { archived: true, trashed: false } }),
      }).catch((err) => console.warn("Could not sync archive state to server:", err));
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
      void fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { archived: false } }),
      }).catch((err) => console.warn("Could not sync unarchive state to server:", err));
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
      void fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { trashed: true } }),
      }).catch((err) => console.warn("Could not sync trash state to server:", err));
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
      void fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates: { trashed: false } }),
      }).catch((err) => console.warn("Could not sync restore state to server:", err));
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
      void fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
        method: "DELETE",
      }).catch((err) => console.warn("Could not sync permanent deletion to server:", err));
    }

    addToast("Permanently deleted", "Item removed forever.", "warning");
  };

  const emptyTrash = () => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    const count = ContentService.emptyTrash(activeUserId);
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      void fetch("/api/media?trashed=true", {
        method: "DELETE",
      }).catch((err) => console.warn("Could not sync empty trash to server:", err));
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
        void fetch(`/api/media/${encodeURIComponent(serverTargetId)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ updates: updated }),
        }).catch((err) => console.warn("Could not sync reprocessed item to server:", err));
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
        void fetch("/api/media", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ items: updatedAll }),
        }).catch((err) => console.warn("Could not sync reprocessed batch to server:", err));
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
      void fetch("/api/collections/sync", {
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
      }).catch((err) => {
        console.warn("Could not sync collection creation to server:", err);
      });
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
      void fetch("/api/collections/sync", {
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
      }).catch((err) => {
        console.warn("Could not sync collection update to server:", err);
      });
    }

    addToast("Collection updated", undefined, "info");
  };

  const deleteCollection = (id: string) => {
    const activeUserId = user?.id || StorageService.getActiveUserId();
    CollectionService.delete(id, activeUserId);
    setCollections(CollectionService.getAll(activeUserId));
    setItems(ContentService.getAll(activeUserId));

    if (typeof window !== "undefined" && isAuthenticated && !activeUserId.startsWith("user-demo")) {
      void fetch(`/api/collections/sync?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      }).catch((err) => {
        console.warn("Could not sync collection deletion to server:", err);
      });
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
      void fetch(`/api/collections/${encodeURIComponent(collectionId)}/items`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds, selectAll }),
      }).catch((err) => {
        console.warn("Could not sync collection items delete to server:", err);
      });
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
