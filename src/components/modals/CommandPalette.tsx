"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useRecall } from "@/context/RecallContext";
import { SearchService } from "@/services/search-service";
import { PlatformBadge } from "@/components/common/PlatformBadge";
import {
  Search,
  Home,
  Bookmark,
  Sparkles,
  Folder,
  Star,
  Clock,
  Archive,
  Trash2,
  Settings,
  Plus,
  ArrowRight,
  X,
  User,
} from "lucide-react";

export const CommandPalette: React.FC = () => {
  const {
    isCommandPaletteOpen,
    closeCommandPalette,
    items,
    collections,
    openAddContent,
    openCollectionModal,
  } = useRecall();

  const [query, setQuery] = useState("");
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  // Search results
  const searchResults = query.trim()
    ? SearchService.search(items, { query, sortBy: "relevance" }, collections).slice(0, 6)
    : [];

  const matchedCollections = query.trim()
    ? collections.filter((c) => c.name.toLowerCase().includes(query.toLowerCase())).slice(0, 3)
    : [];

  const handleNavigate = (path: string) => {
    closeCommandPalette();
    router.push(path);
  };

  const navItems = [
    { label: "Dashboard", path: "/app", icon: <Home className="w-4 h-4 text-indigo-400" /> },
    { label: "All Saves", path: "/app/library", icon: <Bookmark className="w-4 h-4 text-blue-400" /> },
    { label: "AI Search & Assistant", path: "/app/ai-assistant", icon: <Sparkles className="w-4 h-4 text-purple-400" /> },
    { label: "Collections", path: "/app/collections", icon: <Folder className="w-4 h-4 text-emerald-400" /> },
    { label: "Favorites", path: "/app/favorites", icon: <Star className="w-4 h-4 text-amber-400" /> },
    { label: "Recent Saves", path: "/app/recent", icon: <Clock className="w-4 h-4 text-cyan-400" /> },
    { label: "Archive", path: "/app/archive", icon: <Archive className="w-4 h-4 text-zinc-400" /> },
    { label: "Trash", path: "/app/trash", icon: <Trash2 className="w-4 h-4 text-rose-400" /> },
    { label: "Settings", path: "/app/settings", icon: <Settings className="w-4 h-4 text-zinc-400" /> },
    { label: "Profile & Account", path: "/app/profile", icon: <User className="w-4 h-4 text-indigo-400" /> },
  ];

  const filteredNav = query.trim()
    ? navItems.filter((item) => item.label.toLowerCase().includes(query.toLowerCase()))
    : navItems.slice(0, 5);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-8 sm:pt-20 px-3 sm:px-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={closeCommandPalette}
    >
      <div
        className="w-full max-w-xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] sm:max-h-[75vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-2.5 sm:gap-3 px-3 sm:px-4 py-3 sm:py-3.5 border-b border-zinc-200 dark:border-zinc-800">
          <Search className="w-5 h-5 text-zinc-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search saved bookmarks, tags, or topics..."
            className="flex-1 bg-transparent text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none min-w-0"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="p-1 rounded text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-medium rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 border border-zinc-200 dark:border-zinc-700">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 space-y-4">
          {/* Quick Actions */}
          {!query && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Quick Actions
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 px-1">
                <button
                  onClick={() => {
                    closeCommandPalette();
                    openAddContent();
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-left transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                    <Plus className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      + Add Content
                    </div>
                    <div className="text-[10px] text-zinc-500">Paste any URL to analyze</div>
                  </div>
                </button>

                <button
                  onClick={() => {
                    closeCommandPalette();
                    openCollectionModal();
                  }}
                  className="flex items-center gap-2.5 p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-800/60 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-left transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                    <Folder className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                      New Collection
                    </div>
                    <div className="text-[10px] text-zinc-500">Create workspace folder</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Bookmarks Search Match */}
          {searchResults.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Saved Bookmarks ({searchResults.length})
              </div>
              <div className="space-y-1">
                {searchResults.map(({ item }) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigate(`/app/item/${item.id}`)}
                    className="w-full flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.thumbnail}
                        alt={item.title}
                        className="w-10 h-8 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                          {item.title}
                        </div>
                        <div className="text-[11px] text-zinc-500 flex items-center gap-1.5 truncate">
                          <span>{item.creator.name}</span>
                          <span>•</span>
                          <span className="capitalize">{item.platform}</span>
                        </div>
                      </div>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                      <PlatformBadge platform={item.platform} showIconOnly />
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Collections Match */}
          {matchedCollections.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Collections
              </div>
              <div className="space-y-1">
                {matchedCollections.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => handleNavigate(`/app/collections/${col.id}`)}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70 text-left transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: col.color }}
                      />
                      <span className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                        {col.name}
                      </span>
                    </div>
                    <span className="text-[11px] text-zinc-400">View Collection</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Navigation Links */}
          {filteredNav.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
                Navigation
              </div>
              <div className="space-y-1">
                {filteredNav.map((nav) => (
                  <button
                    key={nav.path}
                    onClick={() => handleNavigate(nav.path)}
                    className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800/70 text-left transition-colors group"
                  >
                    <div className="flex items-center gap-2.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
                      {nav.icon}
                      <span>{nav.label}</span>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {query.trim() && searchResults.length === 0 && matchedCollections.length === 0 && (
            <div className="text-center py-8 text-zinc-400 text-xs">
              No bookmarks or collections matched &quot;{query}&quot;. Press Enter to do a full search in library.
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 text-[11px] text-zinc-500">
          <span>Navigate with mouse or shortcuts</span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 font-mono text-[9px] rounded bg-zinc-200 dark:bg-zinc-800">
              CMD+K
            </kbd>{" "}
            toggle
          </span>
        </div>
      </div>
    </div>
  );
};
