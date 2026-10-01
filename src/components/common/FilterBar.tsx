"use client";

import React from "react";
import { useRecall } from "@/context/RecallContext";
import {
  Search,
  LayoutGrid,
  List,
  AlignJustify,
  Star,
  X,
  ArrowUpDown,
  RotateCcw,
} from "lucide-react";

export const FilterBar: React.FC = () => {
  const {
    searchFilters,
    setSearchFilters,
    resetFilters,
    viewMode,
    setViewMode,
    collections,
    items,
  } = useRecall();

  // Extract all unique tags
  const allTags = Array.from(
    new Set(
      items
        .filter((i) => !i.trashed && !i.archived)
        .flatMap((i) => i.tags)
    )
  ).sort();

  const hasActiveFilters =
    searchFilters.query ||
    searchFilters.platform !== "all" ||
    searchFilters.contentType !== "all" ||
    searchFilters.collectionId !== "all" ||
    searchFilters.tag !== "all" ||
    searchFilters.favoriteOnly ||
    searchFilters.dateRange !== "all" ||
    searchFilters.sortBy !== "newest";

  return (
    <div className="space-y-3 mb-6">
      {/* Top row: search input + view mode + sort */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            value={searchFilters.query || ""}
            onChange={(e) =>
              setSearchFilters((prev) => ({ ...prev, query: e.target.value }))
            }
            placeholder="Filter by title, topic, creator, summary..."
            className="w-full pl-9 pr-9 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
          />
          {searchFilters.query && (
            <button
              onClick={() =>
                setSearchFilters((prev) => ({ ...prev, query: "" }))
              }
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Right Controls: Sort & View Toggle */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Sort Selector */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-xs text-zinc-600 dark:text-zinc-400">
            <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
            <select
              value={searchFilters.sortBy || "newest"}
              onChange={(e) =>
                setSearchFilters((prev) => ({
                  ...prev,
                  sortBy: e.target.value as any,
                }))
              }
              className="bg-transparent text-xs text-zinc-900 dark:text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="title">Title A-Z</option>
              <option value="relevance">Most Relevant</option>
            </select>
          </div>

          {/* View Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "grid"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
              title="Grid view"
            >
              <LayoutGrid className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "list"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
              title="List view"
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("compact")}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === "compact"
                  ? "bg-indigo-600 text-white shadow-2xs"
                  : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              }`}
              title="Compact view"
            >
              <AlignJustify className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Second row: Filter Pills & Selectors */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
        {/* Platform Filter */}
        <select
          value={searchFilters.platform || "all"}
          onChange={(e) =>
            setSearchFilters((prev) => ({
              ...prev,
              platform: e.target.value as any,
            }))
          }
          className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0 cursor-pointer"
        >
          <option value="all">All Platforms</option>
          <option value="youtube">YouTube</option>
          <option value="instagram">Instagram</option>
          <option value="reddit">Reddit</option>
          <option value="linkedin">LinkedIn</option>
          <option value="twitter">X (Twitter)</option>
          <option value="tiktok">TikTok</option>
          <option value="pinterest">Pinterest</option>
          <option value="facebook">Facebook</option>
          <option value="threads">Threads</option>
          <option value="blog">Blog</option>
          <option value="website">Website</option>
          <option value="github">GitHub</option>
        </select>

        {/* Content Type Filter */}
        <select
          value={searchFilters.contentType || "all"}
          onChange={(e) =>
            setSearchFilters((prev) => ({
              ...prev,
              contentType: e.target.value as any,
            }))
          }
          className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0 cursor-pointer"
        >
          <option value="all">All Types</option>
          <option value="video">Video</option>
          <option value="short">Short / Reel</option>
          <option value="article">Article</option>
          <option value="post">Post</option>
          <option value="image">Image</option>
          <option value="website">Website</option>
          <option value="product">Product</option>
          <option value="pdf">PDF</option>
        </select>

        {/* Collection Filter */}
        <select
          value={searchFilters.collectionId || "all"}
          onChange={(e) =>
            setSearchFilters((prev) => ({
              ...prev,
              collectionId: e.target.value,
            }))
          }
          className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0 cursor-pointer"
        >
          <option value="all">All Collections</option>
          {collections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>

        {/* Tag Filter */}
        {allTags.length > 0 && (
          <select
            value={searchFilters.tag || "all"}
            onChange={(e) =>
              setSearchFilters((prev) => ({
                ...prev,
                tag: e.target.value,
              }))
            }
            className="px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none focus:ring-1 focus:ring-indigo-500 shrink-0 cursor-pointer"
          >
            <option value="all">All Tags</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                #{tag}
              </option>
            ))}
          </select>
        )}

        {/* Favorites Only toggle */}
        <button
          onClick={() =>
            setSearchFilters((prev) => ({
              ...prev,
              favoriteOnly: !prev.favoriteOnly,
            }))
          }
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border shrink-0 transition-colors ${
            searchFilters.favoriteOnly
              ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
              : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
          }`}
        >
          <Star
            className={`w-3.5 h-3.5 ${
              searchFilters.favoriteOnly ? "fill-current" : ""
            }`}
          />
          Favorites
        </button>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={resetFilters}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors shrink-0"
          >
            <RotateCcw className="w-3 h-3" />
            Reset
          </button>
        )}
      </div>
    </div>
  );
};
