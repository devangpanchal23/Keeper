"use client";

import React, { useMemo } from "react";
import { useRecall } from "@/context/RecallContext";
import { SearchService } from "@/services/search-service";
import { FilterBar } from "@/components/common/FilterBar";
import { SaveItemCard } from "@/components/cards/SaveItemCard";
import { SaveItemListRow } from "@/components/cards/SaveItemListRow";
import { EmptyState } from "@/components/common/EmptyState";
import { Plus, Bookmark } from "lucide-react";

export default function LibraryPage() {
  const {
    items,
    collections,
    searchFilters,
    resetFilters,
    viewMode,
    openAddContent,
  } = useRecall();

  // Filter items using SearchService
  const filteredResults = useMemo(() => {
    return SearchService.search(items, searchFilters, collections);
  }, [items, searchFilters, collections]);

  const activeCount = items.filter((i) => !i.trashed && !i.archived).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              All Saves
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {filteredResults.length} / {activeCount}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Browse, filter, and organize your entire universal knowledge library.
          </p>
        </div>

        <button
          onClick={() => openAddContent()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          Add Content
        </button>
      </div>

      {/* Filter and View Controls Bar */}
      <FilterBar />

      {/* Items Display */}
      {filteredResults.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredResults.map(({ item }) => (
              <SaveItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {filteredResults.map(({ item }) => (
              <SaveItemListRow key={item.id} item={item} />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={<Bookmark className="w-6 h-6 text-indigo-500" />}
          title="No bookmarks match your criteria"
          description="Try clearing your search query or selecting a different platform or collection."
          actionLabel="Reset Filters"
          onAction={resetFilters}
          secondaryActionLabel="Add New Content"
          onSecondaryAction={() => openAddContent()}
        />
      )}
    </div>
  );
}
