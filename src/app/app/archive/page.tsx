"use client";

import React from "react";
import { useRecall } from "@/context/RecallContext";
import { SaveItemCard } from "@/components/cards/SaveItemCard";
import { SaveItemListRow } from "@/components/cards/SaveItemListRow";
import { EmptyState } from "@/components/common/EmptyState";
import { Archive, LayoutGrid, List } from "lucide-react";

export default function ArchivePage() {
  const { items, viewMode, setViewMode } = useRecall();

  const archivedItems = items.filter((i) => i.archived && !i.trashed);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-500/10 text-zinc-500 flex items-center justify-center">
              <Archive className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Archive
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {archivedItems.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Inactive bookmarks kept out of your main library but preserved for reference.
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
      {archivedItems.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {archivedItems.map((item) => (
              <SaveItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {archivedItems.map((item) => (
              <SaveItemListRow key={item.id} item={item} />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={<Archive className="w-6 h-6 text-zinc-400" />}
          title="No archived items"
          description="When you archive items from your library cards, they will be preserved safely here."
          actionLabel="View Library"
          onAction={() => (window.location.href = "/app/library")}
        />
      )}
    </div>
  );
}
