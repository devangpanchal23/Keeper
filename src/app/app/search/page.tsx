"use client";

import React, { useState } from "react";
import { useRecall } from "@/context/RecallContext";
import { SearchService } from "@/services/search-service";
import { SaveItemCard } from "@/components/cards/SaveItemCard";
import { SaveItemListRow } from "@/components/cards/SaveItemListRow";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Search,
  X,
  History,
  LayoutGrid,
  List,
} from "lucide-react";

export default function SearchPage() {
  const {
    items,
    collections,
    recentSearches,
    addRecentSearch,
    clearRecentSearches,
    viewMode,
    setViewMode,
  } = useRecall();

  const [query, setQuery] = useState("React performance");
  const [platform, setPlatform] = useState<string>("all");
  const [collectionId, setCollectionId] = useState<string>("all");

  const results = SearchService.search(
    items,
    {
      query,
      platform: platform as any,
      collectionId,
      sortBy: "relevance",
    },
    collections
  );

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      addRecentSearch(query.trim());
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
          Global Search &amp; Knowledge Index
        </h1>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Weighted search across titles, AI summaries, topics, tags, creator handles, and personal notes.
        </p>
      </div>

      {/* Main Search Input Form */}
      <form onSubmit={handleSearchSubmit} className="space-y-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-indigo-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search keywords, topics, creators, or questions..."
            className="w-full pl-12 pr-10 py-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-sm sm:text-base text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Filter Selectors & Recent Searches */}
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Recent Searches */}
          {recentSearches.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-zinc-400 flex items-center gap-1 font-medium text-[11px]">
                <History className="w-3 h-3" /> Recent:
              </span>
              {recentSearches.slice(0, 5).map((recent) => (
                <button
                  type="button"
                  key={recent}
                  onClick={() => setQuery(recent)}
                  className="px-2 py-0.5 rounded-lg bg-zinc-100 dark:bg-zinc-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-950 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                >
                  {recent}
                </button>
              ))}
              <button
                type="button"
                onClick={clearRecentSearches}
                className="text-[10px] text-zinc-400 hover:text-rose-500 ml-1 underline"
              >
                Clear
              </button>
            </div>
          )}

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Platforms</option>
              <option value="youtube">YouTube</option>
              <option value="instagram">Instagram</option>
              <option value="reddit">Reddit</option>
              <option value="twitter">X (Twitter)</option>
              <option value="linkedin">LinkedIn</option>
              <option value="tiktok">TikTok</option>
              <option value="blog">Blogs</option>
            </select>

            <select
              value={collectionId}
              onChange={(e) => setCollectionId(e.target.value)}
              className="px-2.5 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 focus:outline-none cursor-pointer"
            >
              <option value="all">All Collections</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>

            {/* View Switcher */}
            <div className="flex items-center p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={`p-1 rounded ${
                  viewMode === "grid"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-400"
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`p-1 rounded ${
                  viewMode === "list"
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-400"
                }`}
              >
                <List className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Results Count & Match Fields Header */}
      <div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-800 pb-3">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          Found <span className="font-bold text-zinc-900 dark:text-zinc-100">{results.length}</span> matching{" "}
          {results.length === 1 ? "result" : "results"} for &quot;{query}&quot;
        </div>
      </div>

      {/* Results Render */}
      {results.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {results.map(({ item, matchedFields, score }) => (
              <div key={item.id} className="relative">
                {matchedFields.length > 0 && (
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-zinc-400">
                    <span className="font-semibold text-indigo-500">Matched in:</span>
                    {matchedFields.map((f) => (
                      <span
                        key={f}
                        className="px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-500 font-mono capitalize"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                <SaveItemCard item={item} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {results.map(({ item, matchedFields }) => (
              <div key={item.id}>
                {matchedFields.length > 0 && (
                  <div className="mb-1 flex items-center gap-1 text-[10px] text-zinc-400">
                    <span className="font-semibold text-indigo-500">Matched in:</span>
                    {matchedFields.map((f) => (
                      <span
                        key={f}
                        className="px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-500 font-mono capitalize"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                )}
                <SaveItemListRow item={item} />
              </div>
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={<Search className="w-6 h-6 text-zinc-400" />}
          title="No results found"
          description={`We couldn't find any matches for "${query}". Try searching by platform, topic, or broader terms.`}
          actionLabel="Clear Search"
          onAction={() => setQuery("")}
        />
      )}
    </div>
  );
}
