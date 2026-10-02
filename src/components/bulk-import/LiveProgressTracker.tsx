"use client";

import React from "react";
import { ImportJob } from "@/types";
import {
  Pause,
  Play,
  XCircle,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Layers,
  Sparkles,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LiveProgressTrackerProps {
  job: ImportJob;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}

export const LiveProgressTracker: React.FC<LiveProgressTrackerProps> = ({
  job,
  onPause,
  onResume,
  onCancel,
}) => {
  const percentage =
    job.totalItems > 0 ? Math.round((job.processedItems / job.totalItems) * 100) : 0;

  const currentProcessingItem = job.items.find((i) => i.status === "processing");
  const isPaused = job.status === "paused";

  return (
    <div className="space-y-6">
      {/* Background Resilience Notice */}
      <div className="p-3.5 rounded-xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-500/5 dark:bg-indigo-500/10 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-300 min-w-0">
          <Info className="w-4 h-4 shrink-0" />
          <span>
            <strong>Durable Background Job:</strong> You can safely navigate away or refresh. Progress persists in durable storage.
          </span>
        </div>
        <span className="font-mono text-[11px] text-indigo-500 font-semibold uppercase tracking-wider shrink-0">
          {job.status}
        </span>
      </div>

      {/* Hero Progress Gauge */}
      <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              {isPaused ? (
                <Pause className="w-5 h-5" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                Importing {job.sourceName}
                <span className="text-xs font-normal text-zinc-400">({percentage}%)</span>
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Processed {job.processedItems} of {job.totalItems} items
                {job.estimatedSecondsRemaining !== undefined && job.estimatedSecondsRemaining > 0
                  ? ` • ~${job.estimatedSecondsRemaining}s remaining`
                  : ""}
              </p>
            </div>
          </div>

          {/* Job Control Buttons */}
          <div className="flex flex-wrap items-center gap-2">
            {isPaused ? (
              <button
                type="button"
                onClick={onResume}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                Resume
              </button>
            ) : (
              <button
                type="button"
                onClick={onPause}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all"
              >
                <Pause className="w-3.5 h-3.5" />
                Pause
              </button>
            )}

            <button
              type="button"
              onClick={onCancel}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 dark:text-red-400 text-xs font-semibold transition-all"
            >
              <XCircle className="w-3.5 h-3.5" />
              Cancel
            </button>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full h-3 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden p-0.5">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-cyan-400 rounded-full transition-all duration-300 shadow-sm"
            style={{ width: `${Math.min(100, Math.max(2, percentage))}%` }}
          />
        </div>

        {/* Live Counters */}
        <div className="grid grid-cols-4 gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/80 text-center">
          <div>
            <span className="text-[10px] text-zinc-400 font-semibold uppercase">Imported</span>
            <div className="text-base font-bold text-emerald-600 dark:text-emerald-400">
              {job.successCount}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-semibold uppercase">Skipped Dupes</span>
            <div className="text-base font-bold text-amber-600 dark:text-amber-400">
              {job.duplicateCount}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-semibold uppercase">Failed</span>
            <div className="text-base font-bold text-red-600 dark:text-red-400">
              {job.failedCount}
            </div>
          </div>
          <div>
            <span className="text-[10px] text-zinc-400 font-semibold uppercase">Pending</span>
            <div className="text-base font-bold text-zinc-600 dark:text-zinc-400">
              {job.totalItems - job.processedItems}
            </div>
          </div>
        </div>
      </div>

      {/* Currently Processing Pulse */}
      {currentProcessingItem && (
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 flex items-center justify-between text-xs animate-pulse">
          <div className="flex items-center gap-2.5 truncate max-w-[80%]">
            <Sparkles className="w-4 h-4 text-indigo-500 shrink-0" />
            <span className="text-zinc-500 font-medium">Extracting metadata & AI tags:</span>
            <span className="text-zinc-800 dark:text-zinc-200 font-mono text-[11px] truncate">
              {currentProcessingItem.originalUrl}
            </span>
          </div>
          <span className="text-[11px] font-semibold text-indigo-500">Processing...</span>
        </div>
      )}
    </div>
  );
};
