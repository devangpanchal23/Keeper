"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Collection, SavedItem, SearchFilters, ToastMessage, User, ViewMode } from "@/types";
import { StorageService } from "@/services/storage-service";
import { ContentService } from "@/services/content-service";
import { CollectionService } from "@/services/collection-service";
import { AIService } from "@/services/ai-service";
import { AuthService } from "@/services/auth-service";

export interface RecallContextType {
  // Auth State
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;

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
  logout: () => void;
  updateProfile: (updates: { name?: string; email?: string; avatar?: string }) => Promise<void>;
  updatePassword: (data: { currentPassword: string; newPassword: string }) => Promise<void>;
  demoLogin: () => Promise<void>;

  // Modals
  isAddContentOpen: boolean;
  addContentInitialUrl: string;
  openAddContent: (initialUrl?: string) => void;
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
  updateCollection: (id: string, updates: Partial<Omit<Collection, "id" | "createdAt">>) => void;
  deleteCollection: (id: string) => void;

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

  // Workspace items and collections
  const [items, setItems] = useState<SavedItem[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [theme, setThemeState] = useState<"light" | "dark" | "system">("dark");
  const [searchFilters, setSearchFilters] = useState<SearchFilters>(defaultSearchFilters);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals state
  const [isAddContentOpen, setIsAddContentOpen] = useState(false);
  const [addContentInitialUrl, setAddContentInitialUrl] = useState("");
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

  // Listen to OS system color scheme changes when theme is "system"
  useEffect(() => {
    if (theme !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyThemeClass("system");
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  // Load user from active session on initial mount
  useEffect(() => {
    try {
      const activeUser = AuthService.getCurrentUser();
      if (activeUser) {
        setUser(activeUser);
        setIsAuthenticated(true);
        const userItems = StorageService.getItems(activeUser.id);
        const userCollections = StorageService.getCollections(activeUser.id);
        const userSearches = StorageService.getRecentSearches(activeUser.id);
        setItems(userItems);
        setCollections(userCollections);
        setRecentSearches(userSearches);

        const savedTheme = activeUser.settings?.theme || "dark";
        setThemeState(savedTheme);
        applyThemeClass(savedTheme);
      } else {
        setUser(null);
        setIsAuthenticated(false);
        setItems([]);
        setCollections([]);
        applyThemeClass("dark");
      }
    } finally {
      setAuthLoading(false);
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Authentication Actions
  // ---------------------------------------------------------------------------

  const login = async (credentials: { email: string; password: string }) => {
    const { user: authedUser } = await AuthService.login(credentials);
    setUser(authedUser);
    setIsAuthenticated(true);

    const userItems = StorageService.getItems(authedUser.id);
    const userCollections = StorageService.getCollections(authedUser.id);
    const userSearches = StorageService.getRecentSearches(authedUser.id);
    setItems(userItems);
    setCollections(userCollections);
    setRecentSearches(userSearches);

    const savedTheme = authedUser.settings?.theme || "dark";
    setThemeState(savedTheme);
    applyThemeClass(savedTheme);
  };

  const signup = async (data: { name: string; email: string; password: string }) => {
    const { user: newUser } = await AuthService.signup(data);
    setUser(newUser);
    setIsAuthenticated(true);

    // Brand new accounts start with isolated storage
    const userItems = StorageService.getItems(newUser.id);
    const userCollections = StorageService.getCollections(newUser.id);
    setItems(userItems);
    setCollections(userCollections);
    setRecentSearches([]);

    const savedTheme = newUser.settings?.theme || "dark";
    setThemeState(savedTheme);
    applyThemeClass(savedTheme);
  };

  const demoLogin = async () => {
    await login({ email: "devang@recall.ai", password: "••••••••••••" });
  };

  const logout = () => {
    AuthService.logout();
    setUser(null);
    setIsAuthenticated(false);
    setItems([]);
    setCollections([]);
  };

  const updateProfile = async (updates: { name?: string; email?: string; avatar?: string }) => {
    if (!user) throw new Error("Not authenticated");
    const updated = await AuthService.updateProfile(user.id, updates);
    setUser(updated);
    addToast("Profile updated", "Your account information was successfully updated.", "success");
  };

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
  const openAddContent = (initialUrl = "") => {
    setAddContentInitialUrl(initialUrl);
    setIsAddContentOpen(true);
  };

  const closeAddContent = () => {
    setIsAddContentOpen(false);
    setAddContentInitialUrl("");
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

  // Content actions
  const addItem = (itemData: Omit<SavedItem, "id" | "savedDate"> & { id?: string; savedDate?: string }): SavedItem => {
    const created = ContentService.addItem(itemData);
    setItems(ContentService.getAll());
    addToast("Item saved to Recall", `"${created.title}" is now analyzed and indexed.`, "success");
    return created;
  };

  const updateItem = (id: string, updates: Partial<SavedItem>) => {
    ContentService.updateItem(id, updates);
    setItems(ContentService.getAll());
    addToast("Updated successfully", undefined, "info");
  };

  const toggleFavorite = (id: string) => {
    const isFav = ContentService.toggleFavorite(id);
    setItems(ContentService.getAll());
    addToast(isFav ? "Added to Favorites" : "Removed from Favorites", undefined, "info");
  };

  const archiveItem = (id: string) => {
    ContentService.archiveItem(id);
    setItems(ContentService.getAll());
    addToast("Archived item", "Item moved to your archive.", "info");
  };

  const unarchiveItem = (id: string) => {
    ContentService.unarchiveItem(id);
    setItems(ContentService.getAll());
    addToast("Restored from archive", "Item is back in your active library.", "success");
  };

  const trashItem = (id: string) => {
    ContentService.trashItem(id);
    setItems(ContentService.getAll());
    addToast("Moved to Trash", "Item can be restored from Trash.", "warning");
  };

  const restoreItem = (id: string) => {
    ContentService.restoreItem(id);
    setItems(ContentService.getAll());
    addToast("Restored item", "Item returned to your library.", "success");
  };

  const permanentDeleteItem = (id: string) => {
    ContentService.permanentDelete(id);
    setItems(ContentService.getAll());
    addToast("Permanently deleted", "Item removed forever.", "warning");
  };

  const emptyTrash = () => {
    const count = ContentService.emptyTrash();
    setItems(ContentService.getAll());
    addToast("Trash emptied", `Permanently removed ${count} items.`, "info");
  };

  const recordView = (id: string) => {
    ContentService.recordView(id);
    setItems(ContentService.getAll());
  };

  const reprocessItem = async (id: string): Promise<SavedItem | null> => {
    const item = items.find((i) => i.id === id);
    if (!item) return null;
    try {
      addToast("Reprocessing content...", `Fetching verified metadata for "${item.title.slice(0, 24)}..."`, "info");
      const updated = await AIService.reprocessItem(item, collections);
      ContentService.updateItem(id, updated);
      setItems(ContentService.getAll());
      addToast("Content Reprocessed", `Updated metadata & grounded AI summary for "${updated.title}".`, "success");
      return updated;
    } catch (err) {
      console.error("Reprocess error:", err);
      addToast("Reprocessing Failed", "Could not reprocess this item.", "warning");
      return null;
    }
  };

  const reprocessAllItems = async (): Promise<number> => {
    addToast("Reprocessing All Saves", "Auditing and re-analyzing all bookmarks against verified source metadata...", "info");
    try {
      const updatedAll = await AIService.reprocessAllItems(items, collections);
      StorageService.saveItems(updatedAll, user?.id);
      setItems(updatedAll);
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
    const newCol = CollectionService.create(colData);
    setCollections(CollectionService.getAll());
    addToast("Collection created", `Collection "${newCol.name}" is ready.`, "success");
    return newCol;
  };

  const updateCollection = (id: string, updates: Partial<Omit<Collection, "id" | "createdAt">>) => {
    CollectionService.update(id, updates);
    setCollections(CollectionService.getAll());
    addToast("Collection updated", undefined, "info");
  };

  const deleteCollection = (id: string) => {
    CollectionService.delete(id);
    setCollections(CollectionService.getAll());
    setItems(ContentService.getAll());
    addToast("Collection deleted", "Items have been unlinked.", "warning");
  };

  const resetDemoData = () => {
    StorageService.resetToDefaults();
    if (user) {
      setItems(StorageService.getItems(user.id));
      setCollections(StorageService.getCollections(user.id));
      setRecentSearches(StorageService.getRecentSearches(user.id));
    }
    addToast("Demo data restored", "Loaded 30+ curated seed bookmarks and collections.", "success");
  };

  return (
    <RecallContext.Provider
      value={{
        user,
        isAuthenticated,
        authLoading,
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
        updateProfile,
        updatePassword,
        demoLogin,
        isAddContentOpen,
        addContentInitialUrl,
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
        updateCollection,
        deleteCollection,
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
    updateProfile,
    updatePassword,
    demoLogin,
  };
}
