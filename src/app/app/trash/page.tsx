"use client";

import React from "react";
import { useRecall } from "@/context/RecallContext";
import { SaveItemCard } from "@/components/cards/SaveItemCard";
import { SaveItemListRow } from "@/components/cards/SaveItemListRow";
import { EmptyState } from "@/components/common/EmptyState";
import { Trash2, LayoutGrid, List } from "lucide-react";

export default function TrashPage() {
  const { items, emptyTrash, viewMode, setViewMode } = useRecall();

  const trashedItems = items.filter((i) => i.trashed);

  const handleEmptyTrash = () => {
    if (confirm("Are you sure you want to permanently delete all items in Trash? This cannot be undone.")) {
      emptyTrash();
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Trash
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400">
              {trashedItems.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Items in trash can be restored back to your library or permanently deleted.
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          {trashedItems.length > 0 && (
            <button
              onClick={handleEmptyTrash}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Empty Trash
            </button>
          )}

          {/* View Switcher */}
          <div className="flex items-center p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
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
      </div>

      {/* Trashed Items Display */}
      {trashedItems.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {trashedItems.map((item) => (
              <SaveItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {trashedItems.map((item) => (
              <SaveItemListRow key={item.id} item={item} />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={<Trash2 className="w-6 h-6 text-zinc-400" />}
          title="Trash is empty"
          description="Deleted bookmarks will appear here before being permanently removed."
        />
      )}
    </div>
  );
}
