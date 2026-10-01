"use client";

import React from "react";
import { useRecall } from "@/context/RecallContext";
import { SaveItemCard } from "@/components/cards/SaveItemCard";
import { SaveItemListRow } from "@/components/cards/SaveItemListRow";
import { EmptyState } from "@/components/common/EmptyState";
import { Star, LayoutGrid, List } from "lucide-react";

export default function FavoritesPage() {
  const { items, viewMode, setViewMode, openAddContent } = useRecall();

  const favoriteItems = items.filter(
    (item) => item.favorite && !item.trashed && !item.archived
  );

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Star className="w-4 h-4 fill-current" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Favorites
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400">
              {favoriteItems.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Your starred, most valuable bookmarks for quick access.
          </p>
        </div>

        {/* View Switcher */}
        <div className="flex items-center p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 self-start sm:self-auto">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === "grid"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
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
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Items */}
      {favoriteItems.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {favoriteItems.map((item) => (
              <SaveItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {favoriteItems.map((item) => (
              <SaveItemListRow key={item.id} item={item} />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={<Star className="w-6 h-6 text-amber-500 fill-current" />}
          title="No favorite bookmarks yet"
          description="Click the star icon on any card in your library to pin your favorite articles and videos here."
          actionLabel="Browse All Saves"
          onAction={() => (window.location.href = "/app/library")}
        />
      )}
    </div>
  );
}
