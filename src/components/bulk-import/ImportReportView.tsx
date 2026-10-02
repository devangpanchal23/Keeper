"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ImportItem, ImportReport } from "@/types";
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  ExternalLink,
  Folder,
  ArrowRight,
  Search,
  Filter,
  Calendar,
  Clock,
  Download,
  Share2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PlatformBadge } from "../common/PlatformBadge";
import { ContentTypeBadge } from "../common/ContentTypeBadge";
import { AiOrganizeModal } from "./AiOrganizeModal";

interface ImportReportViewProps {
  report: ImportReport;
  onRetryFailed?: () => void;
  onNewImport: () => void;
  isRetrying?: boolean;
}

type FilterTab = "all" | "imported" | "failed" | "skipped" | "duplicate";

export const ImportReportView: React.FC<ImportReportViewProps> = ({
  report,
  onRetryFailed,
  onNewImport,
  isRetrying,
}) => {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isOrganizeModalOpen, setIsOrganizeModalOpen] = useState(false);

  // Eligible items in this report scope that have a saved item
  const eligibleItems = report.items.filter((item) => Boolean(item.savedItemId));
  const isAllSelected = eligibleItems.length > 0 && eligibleItems.every((item) => selectedIds.has(item.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligibleItems.map((item) => item.id)));
    }
  };

  const handleToggleItem = (itemId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const summary = report.summary;
  const durationSec = Math.round(report.durationMs / 1000);

  // Filter items
  const filteredItems = report.items.filter((item) => {
    // Tab filter
    if (filter === "imported" && item.status !== "success") return false;
    if (filter === "failed" && item.status !== "failed") return false;
    if (filter === "skipped" && item.status !== "skipped") return false;
    if (filter === "duplicate" && item.status !== "duplicate") return false;

    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchUrl = item.originalUrl.toLowerCase().includes(q);
      const matchTitle = (item.title || "").toLowerCase().includes(q);
      const matchCreator = (item.creatorName || "").toLowerCase().includes(q);
      const matchCol = (item.collectionName || "").toLowerCase().includes(q);
      return matchUrl || matchTitle || matchCreator || matchCol;
    }

    return true;
  });

  const failedItems = report.items.filter((i) => i.status === "failed");
  const retryableFailedCount = failedItems.filter((i) => i.error?.isRetryable).length;

  return (
    <div className="space-y-6">
      {/* Report Header Card */}
      <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Import Completed
              </span>
              <span className="text-xs text-zinc-400 capitalize">• {report.platform}</span>
            </div>
            <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100 mt-1">
              Import Report: {report.sourceName}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              Account: {report.accountName} • Duration: {durationSec}s • {new Date(report.completedAt).toLocaleString()}
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => setIsOrganizeModalOpen(true)}
              disabled={selectedIds.size === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-semibold shadow-sm transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />
              AI Organize {selectedIds.size > 0 ? `(${selectedIds.size})` : ""}
            </button>

            {retryableFailedCount > 0 && onRetryFailed && (
              <button
                type="button"
                onClick={onRetryFailed}
                disabled={isRetrying}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <RotateCcw className={cn("w-3.5 h-3.5", isRetrying && "animate-spin")} />
                Retry {retryableFailedCount} Failed Items
              </button>
            )}

            <button
              type="button"
              onClick={onNewImport}
              className="px-4 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-all"
            >
              New Import
            </button>
          </div>
        </div>

        {/* Scorecard Metrics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase">Discovered</span>
            <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
              {summary.totalDiscovered}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-emerald-100 dark:border-emerald-950/40 bg-emerald-50/40 dark:bg-emerald-950/20">
            <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">
              Imported
            </span>
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
              {summary.imported}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-amber-100 dark:border-amber-950/40 bg-amber-50/40 dark:bg-amber-950/20">
            <span className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 uppercase">
              Duplicates
            </span>
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400 mt-0.5">
              {summary.duplicates}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-red-100 dark:border-red-950/40 bg-red-50/40 dark:bg-red-950/20">
            <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 uppercase">
              Failed
            </span>
            <div className="text-lg font-bold text-red-600 dark:text-red-400 mt-0.5">
              {summary.failed}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/40">
            <span className="text-[10px] font-semibold text-zinc-400 uppercase">Skipped</span>
            <div className="text-lg font-bold text-zinc-600 dark:text-zinc-400 mt-0.5">
              {summary.skipped}
            </div>
          </div>

          <div className="p-3 rounded-xl border border-indigo-100 dark:border-indigo-950/40 bg-indigo-50/40 dark:bg-indigo-950/20">
            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 uppercase">
              Success Rate
            </span>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
              {summary.successPercentage}%
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-xs w-full sm:w-auto overflow-x-auto no-scrollbar">
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap",
              filter === "all"
                ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            All Items ({report.items.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter("imported")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap",
              filter === "imported"
                ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            Imported ({summary.imported})
          </button>
          <button
            type="button"
            onClick={() => setFilter("failed")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap",
              filter === "failed"
                ? "bg-white dark:bg-zinc-900 text-red-600 dark:text-red-400 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            Failed ({summary.failed})
          </button>
          <button
            type="button"
            onClick={() => setFilter("duplicate")}
            className={cn(
              "px-3 py-1.5 rounded-lg font-medium transition-all whitespace-nowrap",
              filter === "duplicate"
                ? "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-2xs font-semibold"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
            )}
          >
            Duplicates ({summary.duplicates})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search report items..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Selection Control Bar */}
      <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-100/70 dark:bg-zinc-800/60 border border-zinc-200/60 dark:border-zinc-800 text-xs">
        <label className="flex items-center gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300 font-medium select-none">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={handleToggleSelectAll}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
          />
          <span>
            Select All ({eligibleItems.length} items in this import report)
          </span>
        </label>

        {selectedIds.size > 0 && (
          <span className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
            {selectedIds.size} of {eligibleItems.length} selected
          </span>
        )}
      </div>

      {/* Item-Level Mapping Table / List */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden bg-white/70 dark:bg-zinc-900/70 divide-y divide-zinc-100 dark:divide-zinc-800/80">
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center text-xs text-zinc-400">
            No items matching your selected filter.
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
            >
              {/* Item Overview & Mapping */}
              <div className="flex items-start gap-3 min-w-0 max-w-full md:max-w-[70%]">
                {item.savedItemId ? (
                  <div className="pt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(item.id)}
                      onChange={() => handleToggleItem(item.id)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="w-4 shrink-0" />
                )}

                <div className="pt-0.5 shrink-0">
                  {item.status === "success" && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  )}
                  {item.status === "failed" && (
                    <XCircle className="w-5 h-5 text-red-500" />
                  )}
                  {item.status === "duplicate" && (
                    <AlertTriangle className="w-5 h-5 text-amber-500" />
                  )}
                  {item.status === "skipped" && (
                    <div className="w-5 h-5 rounded-full border-2 border-zinc-400" />
                  )}
                </div>

                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <PlatformBadge platform={item.platform} />
                    <ContentTypeBadge type={item.contentType} />
                    {item.collectionName && (
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                        <Folder className="w-2.5 h-2.5" />
                        {item.collectionName}
                      </span>
                    )}
                  </div>

                  <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate">
                    {item.title || item.originalUrl}
                  </h4>

                  {item.creatorName && (
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Creator: {item.creatorName}
                    </p>
                  )}

                  <a
                    href={item.canonicalUrl || item.originalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-zinc-400 hover:text-indigo-500 flex items-center gap-1 truncate font-mono"
                  >
                    <span>{item.originalUrl}</span>
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                  </a>

                  {/* Failure Diagnostics Box */}
                  {item.error && (
                    <div className="mt-2 p-2.5 rounded-xl border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 text-[11px] space-y-1">
                      <div className="font-semibold text-red-800 dark:text-red-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span>Failure Category: {item.error.category}</span>
                        {item.error.isRetryable && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700 dark:text-amber-300">
                            Retryable
                          </span>
                        )}
                      </div>
                      <p className="text-red-700 dark:text-red-400">{item.error.message}</p>
                      {item.error.suggestedAction && (
                        <p className="text-zinc-500 dark:text-zinc-400 text-[10px]">
                          <strong>Action:</strong> {item.error.suggestedAction}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Destination Action Link (Direct navigation to locate in Keeper) */}
              <div className="flex items-center gap-2 shrink-0 md:self-center">
                {item.savedItemId ? (
                  <Link
                    href={`/app/item/${item.savedItemId}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 text-xs font-semibold transition-all"
                  >
                    <span>Locate in Keeper</span>
                    <ArrowRight className="w-3 h-3 text-indigo-500" />
                  </Link>
                ) : (
                  <span className="text-[11px] text-zinc-400">
                    {item.status === "duplicate" ? "Kept existing save" : "Not stored"}
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* AI Organize Modal */}
      <AiOrganizeModal
        isOpen={isOrganizeModalOpen}
        onClose={() => setIsOrganizeModalOpen(false)}
        selectedImportItems={report.items.filter((i) => selectedIds.has(i.id))}
      />
    </div>
  );
};
