import React from "react";
import { ViewMode } from "@/types";

export const SkeletonGrid: React.FC<{ viewMode?: ViewMode; count?: number }> = ({
  viewMode = "grid",
  count = 6,
}) => {
  if (viewMode === "list" || viewMode === "compact") {
    return (
      <div className="space-y-3">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 p-3.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 animate-pulse"
          >
            <div className="w-16 h-12 rounded-lg bg-zinc-200 dark:bg-zinc-800 shrink-0" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-800/60 rounded w-1/3" />
            </div>
            <div className="w-20 h-6 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-zinc-200 dark:border-zinc-800/80 bg-white/50 dark:bg-zinc-900/40 p-3.5 flex flex-col gap-3 animate-pulse"
        >
          <div className="w-full h-44 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
          <div className="space-y-2.5 px-1">
            <div className="flex justify-between gap-2">
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-20" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-14" />
            </div>
            <div className="h-5 bg-zinc-200 dark:bg-zinc-800 rounded w-4/5" />
            <div className="h-3 bg-zinc-200 dark:bg-zinc-800/60 rounded w-full" />
            <div className="h-3 bg-zinc-200 dark:bg-zinc-800/60 rounded w-3/4" />
          </div>
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800/50 mt-auto">
            <div className="w-6 h-6 rounded-full bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-3 bg-zinc-200 dark:bg-zinc-800 rounded w-24" />
          </div>
        </div>
      ))}
    </div>
  );
};
