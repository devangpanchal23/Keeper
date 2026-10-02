"use client";

import React, { useState } from "react";
import {
  AIEnrichmentMode,
  Collection,
  DuplicateStrategy,
  ImportItem,
  ImportJobOptions,
  Platform,
} from "@/types";
import {
  CheckCircle2,
  Copy,
  FolderPlus,
  Play,
  Settings,
  Sparkles,
  Tag,
  AlertCircle,
  FileCheck2,
  Layers,
  HelpCircle,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useRecall } from "@/context/RecallContext";
import { cn } from "@/lib/utils";
import { PlatformBadge } from "../common/PlatformBadge";

interface PreImportAnalysisProps {
  platform: Platform;
  accountName: string;
  sourceName: string;
  totalDiscovered: number;
  duplicateCount: number;
  newCount: number;
  readyCount?: number;
  alreadySavedCount?: number;
  batchDuplicateCount?: number;
  unsupportedCount?: number;
  sampleItems: ImportItem[];
  collections: Collection[];
  onConfirm: (options: ImportJobOptions) => void;
  onCancel: () => void;
}

export const PreImportAnalysis: React.FC<PreImportAnalysisProps> = ({
  platform,
  accountName,
  sourceName,
  totalDiscovered,
  duplicateCount,
  newCount,
  readyCount = newCount,
  alreadySavedCount,
  batchDuplicateCount,
  unsupportedCount = 0,
  sampleItems,
  collections,
  onConfirm,
  onCancel,
}) => {
  const { importLimits } = useRecall();
  const totalLimit = importLimits?.total ?? 10;
  const usedLimit = importLimits?.used ?? 2;
  const remainingLimit = importLimits?.remaining ?? Math.max(0, totalLimit - usedLimit);
  const isQuotaExhausted = remainingLimit <= 0;
  const isLowQuota = remainingLimit > 0 && remainingLimit < readyCount;

  const [targetCollectionId, setTargetCollectionId] = useState<string>("");
  const [autoOrganize, setAutoOrganize] = useState<boolean>(true);
  const [duplicateStrategy, setDuplicateStrategy] = useState<DuplicateStrategy>("skip");
  const [aiEnrichmentMode, setAiEnrichmentMode] = useState<AIEnrichmentMode>("full");
  const [concurrencyLimit, setConcurrencyLimit] = useState<number>(3);
  const [defaultTagsStr, setDefaultTagsStr] = useState<string>("BulkImport");

  // Fallbacks if alreadySaved / batchDuplicate not broken down separately
  const resolvedAlreadySaved =
    alreadySavedCount !== undefined ? alreadySavedCount : duplicateCount;
  const resolvedBatchDuplicates =
    batchDuplicateCount !== undefined ? batchDuplicateCount : 0;

  const handleStart = () => {
    if (isQuotaExhausted) return;
    const defaultTags = defaultTagsStr
      .split(/[, ]+/)
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean);

    onConfirm({
      targetCollectionId: targetCollectionId || undefined,
      autoOrganize,
      skipDuplicates: duplicateStrategy === "skip",
      duplicateStrategy,
      aiEnrichmentMode,
      defaultTags,
      concurrencyLimit,
    });
  };

  return (
    <div className="space-y-6">
      {/* Import Limits Quota Banner */}
      <div
        className={`p-4 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
          isQuotaExhausted
            ? "border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200"
            : isLowQuota
            ? "border-amber-200 bg-amber-50/80 dark:border-amber-900/60 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200"
            : "border-indigo-100 bg-indigo-50/60 dark:border-indigo-900/40 dark:bg-indigo-950/20 text-indigo-900 dark:text-indigo-200"
        }`}
      >
        <div className="flex items-center gap-2.5">
          <Zap
            className={`w-4 h-4 shrink-0 ${
              isQuotaExhausted
                ? "text-rose-500 fill-rose-500/20"
                : isLowQuota
                ? "text-amber-500 fill-amber-500/20"
                : "text-indigo-500 fill-indigo-500/20"
            }`}
          />
          <div>
            <div className="font-semibold text-zinc-900 dark:text-zinc-100">
              Import Quota: {totalLimit} total → {usedLimit} used →{" "}
              <strong className={isQuotaExhausted ? "text-rose-600 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                {remainingLimit} remaining
              </strong>
            </div>
            {isQuotaExhausted ? (
              <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">
                Remaining import quota is 0. Imports cannot proceed until limits are reset or upgraded.
              </p>
            ) : isLowQuota ? (
              <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-0.5">
                This batch has {readyCount} items, but you have {remainingLimit} limit credits left. Imports will stop when quota reaches 0.
              </p>
            ) : (
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                Every successful item imported will automatically deduct 1 limit credit.
              </p>
            )}
          </div>
        </div>

        <div className="shrink-0 flex items-center gap-2 font-medium">
          <span className="px-2.5 py-1 rounded-lg bg-white/90 dark:bg-zinc-900/90 border border-zinc-200 dark:border-zinc-800 shadow-2xs">
            {remainingLimit} credits left
          </span>
        </div>
      </div>

      {/* 5-Way Pre-Import Metric Breakdown */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {/* Total Detected */}
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider block">
            Total Detected
          </span>
          <div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
            {totalDiscovered}
          </div>
          <span className="text-[11px] text-zinc-400 truncate block">from {sourceName}</span>
        </div>

        {/* Ready / Eligible */}
        <div className="p-4 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40 bg-emerald-50/30 dark:bg-emerald-950/20">
          <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider block">
            Ready to Import
          </span>
          <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
            {readyCount}
          </div>
          <span className="text-[11px] text-zinc-400 block">eligible new items</span>
        </div>

        {/* Already Saved in Keeper */}
        <div className="p-4 rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/30 dark:bg-amber-950/20">
          <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">
            Already Saved
          </span>
          <div className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
            {resolvedAlreadySaved}
          </div>
          <span className="text-[11px] text-zinc-400 block">in your library</span>
        </div>

        {/* In-Batch Duplicates */}
        <div className="p-4 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20">
          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block">
            Batch Duplicates
          </span>
          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400 mt-1">
            {resolvedBatchDuplicates}
          </div>
          <span className="text-[11px] text-zinc-400 block">repeated in file/list</span>
        </div>

        {/* Unsupported */}
        <div className="p-4 rounded-xl border border-rose-200/60 dark:border-rose-900/40 bg-rose-50/30 dark:bg-rose-950/20">
          <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider block">
            Unsupported
          </span>
          <div className="text-2xl font-bold text-rose-600 dark:text-rose-400 mt-1">
            {unsupportedCount}
          </div>
          <span className="text-[11px] text-zinc-400 block">malformed / invalid</span>
        </div>
      </div>

      {/* Import Configuration Options */}
      <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 space-y-5">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Settings className="w-4 h-4 text-indigo-500" />
          Import & Processing Configuration
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Destination Collection */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 block">
              Destination Collection
            </label>
            <select
              value={targetCollectionId}
              onChange={(e) => setTargetCollectionId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Auto-Assign (AI Topic Categorization)</option>
              {collections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-zinc-400">
              Assign all items to a specific collection or let Keeper categorize them intelligently.
            </p>
          </div>

          {/* Duplicate Behavior */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 block">
              Duplicate Handling Behavior
            </label>
            <select
              value={duplicateStrategy}
              onChange={(e) => setDuplicateStrategy(e.target.value as DuplicateStrategy)}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="skip">Skip duplicates (Recommended — preserve existing saves)</option>
              <option value="update">Update existing saves with latest metadata</option>
              <option value="allow">Import anyway (Allow duplicate copies)</option>
            </select>
            <p className="text-[11px] text-zinc-400">
              Determines how Keeper handles URLs that already exist in your workspace.
            </p>
          </div>

          {/* AI Enrichment Mode */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
              AI Enrichment Mode
            </label>
            <select
              value={aiEnrichmentMode}
              onChange={(e) => setAiEnrichmentMode(e.target.value as AIEnrichmentMode)}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="full">Full AI Enrichment (Summary, key points, topics & tags)</option>
              <option value="fast_metadata">Fast Factual Metadata-Only (High speed, zero AI quota use)</option>
            </select>
            <p className="text-[11px] text-zinc-400">
              Full mode synthesizes grounded summaries. Fast mode extracts author, title, thumbnail & tags instantly.
            </p>
          </div>

          {/* Default Tags */}
          <div className="space-y-1.5">
            <label className="font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-zinc-400" />
              Batch Tags (comma-separated)
            </label>
            <input
              type="text"
              value={defaultTagsStr}
              onChange={(e) => setDefaultTagsStr(e.target.value)}
              placeholder="e.g. YouTube, WatchLater, Research"
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-zinc-400">
              These tags will be appended to every imported item in this batch.
            </p>
          </div>
        </div>
      </div>

      {/* Candidate Items Preview Table */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            <Layers className="w-4 h-4 text-zinc-400" />
            Detected Items Preview ({sampleItems.length})
          </h4>
          <span className="text-xs text-zinc-400">
            Showing first {Math.min(sampleItems.length, 50)} items
          </span>
        </div>

        <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white/50 dark:bg-zinc-900/50 max-h-72 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
          {sampleItems.slice(0, 50).map((item, idx) => (
            <div
              key={item.id || idx}
              className="p-3 flex items-center justify-between gap-3 text-xs hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <PlatformBadge platform={item.platform} />
                <div className="min-w-0">
                  <p className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                    {item.title || item.canonicalUrl || item.originalUrl}
                  </p>
                  <p className="text-[11px] text-zinc-400 truncate">{item.originalUrl}</p>
                </div>
              </div>

              <div className="shrink-0 flex items-center gap-2">
                {item.status === "duplicate" ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Duplicate
                  </span>
                ) : item.status === "unsupported" ? (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    title={item.error?.message}
                  >
                    Unsupported
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Ready
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Confirmation Actions */}
      <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2.5 sm:gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-center"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleStart}
          disabled={isQuotaExhausted || (readyCount === 0 && duplicateStrategy === "skip")}
          className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition-all"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isQuotaExhausted
            ? "Limit Reached (0 Remaining)"
            : `Start Import (${readyCount > 0 ? `${readyCount} Items` : "Run Import"})`}
        </button>
      </div>
    </div>
  );
};
