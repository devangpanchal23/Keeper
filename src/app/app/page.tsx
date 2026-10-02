"use client";

import React from "react";
import Link from "next/link";
import { useRecall } from "@/context/RecallContext";
import { AIService } from "@/services/ai-service";
import { SaveItemCard } from "@/components/cards/SaveItemCard";
import {
  Bookmark,
  Folder,
  Star,
  Sparkles,
  Clock,
  ArrowRight,
  TrendingUp,
  Brain,
  Plus,
} from "lucide-react";

export default function DashboardPage() {
  const {
    items,
    collections,
    openAddContent,
    openCollectionModal,
    user,
  } = useRecall();

  const activeItems = items.filter((i) => !i.trashed && !i.archived);
  const favoriteItems = activeItems.filter((i) => i.favorite);
  const aiProcessedCount = activeItems.filter((i) => !!i.aiSummary?.quick).length;

  // Recently saved (first 6)
  const recentlySaved = [...activeItems]
    .sort((a, b) => new Date(b.savedDate).getTime() - new Date(a.savedDate).getTime())
    .slice(0, 6);

  // Recently viewed (sorted by lastViewedAt)
  const recentlyViewed = [...activeItems]
    .filter((i) => i.lastViewedAt)
    .sort(
      (a, b) =>
        new Date(b.lastViewedAt || 0).getTime() -
        new Date(a.lastViewedAt || 0).getTime()
    )
    .slice(0, 3);

  // AI Insights
  const insights = AIService.generateDashboardInsights(items);

  // Suggested AI Collections dynamically clustered from library
  const suggestedCollections = AIService.getSuggestedCollections(items, collections);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8">
      {/* Top Greeting & Quick Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
            Workspace Overview
          </h1>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Welcome back, {user?.name || "there"}. All your universal saves are indexed and searchable.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          <Link
            href="/app/ai-assistant"
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-medium border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors shadow-2xs whitespace-nowrap"
          >
            <Brain className="w-4 h-4 text-purple-500 shrink-0" />
            Ask AI Assistant
          </Link>

          <button
            onClick={() => openAddContent()}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 whitespace-nowrap"
          >
            <Plus className="w-4 h-4 shrink-0" />
            + Add Content
          </button>
        </div>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
        {/* Total Saves */}
        <Link
          href="/app/library"
          className="p-3.5 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs hover:border-indigo-500/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Total Saves
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
              <Bookmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {activeItems.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block truncate">
            Across 10 platforms
          </span>
        </Link>

        {/* Collections */}
        <Link
          href="/app/collections"
          className="p-3.5 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Collections
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
              <Folder className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {collections.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block truncate">
            Curated categories
          </span>
        </Link>

        {/* Favorites */}
        <Link
          href="/app/favorites"
          className="p-3.5 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs hover:border-amber-500/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Favorites
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
              <Star className="w-4 h-4 fill-current" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {favoriteItems.length}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block truncate">
            {insights.favoriteRatio} of your library
          </span>
        </Link>

        {/* AI Processed */}
        <Link
          href="/app/ai-assistant"
          className="p-3.5 sm:p-5 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs hover:border-purple-500/40 hover:shadow-md transition-all group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              AI Processed
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 sm:mt-3 text-2xl sm:text-3xl font-bold text-zinc-900 dark:text-zinc-100">
            {aiProcessedCount}
          </div>
          <span className="text-[11px] text-zinc-400 mt-1 block truncate">
            100% indexed with summaries
          </span>
        </Link>
      </div>

      {/* AI Insights & Assistant Teaser Widget */}
      <div className="p-5 sm:p-6 rounded-3xl border border-indigo-500/20 bg-gradient-to-br from-indigo-950/20 via-zinc-900/40 to-transparent dark:from-indigo-950/40 dark:via-zinc-900/50 backdrop-blur-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border border-indigo-500/20">
              <Sparkles className="w-3 h-3" />
              Keeper Intelligence
            </div>
            <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              AI Knowledge Graph Highlight
            </h3>
            <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
              {insights.weeklyHighlight}
            </p>

            {/* Top Topics Chips */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              <span className="text-xs font-medium text-zinc-400 mr-1">Trending:</span>
              {insights.topTopics.map((topic) => (
                <span
                  key={topic.name}
                  className="px-2 py-0.5 rounded-lg text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60"
                >
                  {topic.name} ({topic.count})
                </span>
              ))}
            </div>
          </div>

          <Link
            href="/app/ai-assistant"
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-105 shrink-0"
          >
            Ask Questions About Saves
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* Recently Saved Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Recently Saved
            </h2>
          </div>
          <Link
            href="/app/library"
            className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            View All ({activeItems.length}) <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {recentlySaved.map((item) => (
            <SaveItemCard key={item.id} item={item} />
          ))}
        </div>
      </div>

      {/* Collections Carousel / Grid Preview */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Folder className="w-4 h-4 text-indigo-500" />
            <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Collections
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => openCollectionModal()}
              className="text-xs font-medium text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400"
            >
              + New Collection
            </button>
            <Link
              href="/app/collections"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Browse All
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {collections.slice(0, 5).map((col) => {
            const count = items.filter(
              (i) =>
                !i.trashed &&
                !i.archived &&
                (i.collectionId === col.id || i.collections?.includes(col.id))
            ).length;

            return (
              <Link
                key={col.id}
                href={`/app/collections/${col.id}`}
                className="p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all hover:scale-[1.02] shadow-2xs group"
              >
                <div
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-white mb-3 shadow-xs"
                  style={{ backgroundColor: col.color }}
                >
                  <Folder className="w-4 h-4" />
                </div>
                <div className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                  {col.name}
                </div>
                <span className="text-[11px] text-zinc-400 mt-0.5 block">
                  {count} saves
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Suggested AI Collections & Recently Viewed Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Suggested AI Collections */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Suggested AI Collections
              </h3>
            </div>
            <span className="text-[10px] uppercase font-semibold tracking-wider text-zinc-400">
              Auto-Clustered
            </span>
          </div>

          <div className="space-y-2.5">
            {suggestedCollections.map((s) => (
              <div
                key={s.name}
                className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                    {s.name}
                  </div>
                  <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                    {s.description}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {s.tags.map((t) => (
                      <span
                        key={t}
                        className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-200/60 dark:bg-zinc-700/60 text-zinc-600 dark:text-zinc-300"
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  onClick={() => {
                    openCollectionModal();
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white transition-colors shrink-0"
                >
                  Create
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Recently Viewed */}
        <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-500" />
              <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Recently Viewed
              </h3>
            </div>
            <Link
              href="/app/recent"
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              See all
            </Link>
          </div>

          <div className="space-y-2">
            {recentlyViewed.length > 0 ? (
              recentlyViewed.map((item) => (
                <Link
                  key={item.id}
                  href={`/app/item/${item.id}`}
                  className="flex items-center justify-between p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group"
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
                      <div className="text-[11px] text-zinc-400 truncate">
                        {item.creator.name} • {item.platform}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              ))
            ) : (
              <div className="text-xs text-zinc-400 py-4 text-center">
                Click on any save to see your viewing history here.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
