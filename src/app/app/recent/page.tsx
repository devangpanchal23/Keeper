"use client";

import React, { useState } from "react";
import { useRecall } from "@/context/RecallContext";
import { SaveItemCard } from "@/components/cards/SaveItemCard";
import { SaveItemListRow } from "@/components/cards/SaveItemListRow";
import { EmptyState } from "@/components/common/EmptyState";
import { Clock, Eye, LayoutGrid, List } from "lucide-react";

export default function RecentPage() {
  const { items, viewMode, setViewMode } = useRecall();
  const [tab, setTab] = useState<"saved" | "viewed">("saved");

  const activeItems = items.filter((i) => !i.trashed && !i.archived);

  // Recently Saved: sorted by savedDate descending
  const recentlySaved = [...activeItems].sort(
    (a, b) => new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime()
  );

  // Recently Viewed: sorted by lastViewedAt descending
  const recentlyViewed = [...activeItems]
    .filter((i) => i.lastViewedAt)
    .sort(
      (a, b) =>
        new Date(b.lastViewedAt || 0).getTime() -
        new Date(a.lastViewedAt || 0).getTime()
    );

  const displayItems = tab === "saved" ? recentlySaved : recentlyViewed;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Recent Activity
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Revisit newly added bookmarks or continue where you left off.
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

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-2">
        <button
          onClick={() => setTab("saved")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === "saved"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          Recently Saved ({recentlySaved.length})
        </button>
        <button
          onClick={() => setTab("viewed")}
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
            tab === "viewed"
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
          }`}
        >
          <Eye className="w-3.5 h-3.5" />
          Recently Viewed ({recentlyViewed.length})
        </button>
      </div>

      {/* Items Display */}
      {displayItems.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {displayItems.map((item) => (
              <SaveItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {displayItems.map((item) => (
              <SaveItemListRow key={item.id} item={item} />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={<Clock className="w-6 h-6 text-zinc-400" />}
          title={tab === "saved" ? "No recent saves" : "No viewing history yet"}
          description="Click into bookmarks to read their summaries and build your history log."
        />
      )}
    </div>
  );
}
