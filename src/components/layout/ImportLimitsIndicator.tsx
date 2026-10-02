"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRecall } from "@/context/RecallContext";
import { Zap, AlertCircle, CheckCircle2 } from "lucide-react";

export function ImportLimitsIndicator() {
  const { importLimits } = useRecall();
  const [isOpen, setIsOpen] = useState(false);

  const total = importLimits?.total ?? 10;
  const used = importLimits?.used ?? 2;
  const remaining = importLimits?.remaining ?? Math.max(0, total - used);
  const percentage = Math.min(100, Math.round((used / Math.max(1, total)) * 100));

  const isExhausted = remaining <= 0;
  const isWarning = remaining > 0 && remaining <= 2;

  return (
    <div className="relative shrink-0">
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="View Import Limits"
        className={`group flex items-center gap-1.5 sm:gap-2 px-2 sm:px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all duration-150 shrink-0 ${
          isExhausted
            ? "border-rose-300 bg-rose-50/70 text-rose-700 dark:border-rose-800/80 dark:bg-rose-950/40 dark:text-rose-300 hover:bg-rose-100/70"
            : isWarning
            ? "border-amber-300 bg-amber-50/70 text-amber-700 dark:border-amber-800/80 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100/70"
            : "border-zinc-200 bg-white/80 dark:border-zinc-800 dark:bg-zinc-900/80 text-zinc-700 dark:text-zinc-200 hover:border-indigo-300 dark:hover:border-indigo-700 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20"
        } shadow-2xs backdrop-blur-sm active:scale-98`}
        title={`Import Limits: ${total} total limit • ${used} used • ${remaining} remaining`}
      >
        <div className="flex items-center gap-1.5">
          <Zap
            className={`w-3.5 h-3.5 shrink-0 transition-transform group-hover:scale-110 ${
              isExhausted
                ? "text-rose-500 fill-rose-500/20 animate-pulse"
                : isWarning
                ? "text-amber-500 fill-amber-500/20"
                : "text-indigo-500 fill-indigo-500/20"
            }`}
          />

          {/* Desktop Display: Full sequence '10 total → 2 used → 8 remaining' */}
          <div className="hidden xl:flex items-center gap-1.5 font-medium tracking-tight text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">
              <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{total}</strong> total
            </span>
            <span className="text-zinc-300 dark:text-zinc-600">→</span>
            <span className="text-zinc-500 dark:text-zinc-400">
              <strong className="text-indigo-600 dark:text-indigo-400 font-semibold">{used}</strong> used
            </span>
            <span className="text-zinc-300 dark:text-zinc-600">→</span>
            <span className={isExhausted ? "text-rose-600 dark:text-rose-400 font-bold" : isWarning ? "text-amber-600 dark:text-amber-400 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
              <strong>{remaining}</strong> left
            </span>
          </div>

          {/* Laptop / Medium Display: '10 total • 2 used' */}
          <div className="hidden sm:flex xl:hidden items-center gap-1 font-medium tracking-tight text-xs">
            <span className="text-zinc-500 dark:text-zinc-400">
              <strong className="text-zinc-800 dark:text-zinc-200 font-semibold">{total}</strong> tot •
            </span>
            <span className="text-indigo-600 dark:text-indigo-400 font-semibold">
              <strong>{used}</strong> used
            </span>
          </div>

          {/* Mobile Display: Compact badge with used and total */}
          <div className="flex sm:hidden items-center gap-0.5 text-xs">
            <span className={isExhausted ? "text-rose-600 font-bold" : isWarning ? "text-amber-600 font-bold" : "text-indigo-600 dark:text-indigo-400 font-bold"}>
              {used}
            </span>
            <span className="text-zinc-400 text-[10px]">/{total}</span>
          </div>
        </div>

        {/* Visual Progress Bar Pill */}
        <div className="hidden lg:block w-10 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden shrink-0 ml-0.5">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              isExhausted
                ? "bg-rose-500"
                : isWarning
                ? "bg-amber-500"
                : "bg-indigo-600 dark:bg-indigo-500"
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </button>

      {/* Popover Breakdown Menu */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-30"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-72 sm:w-80 max-w-[calc(100vw-2rem)] rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-4 z-40 text-xs text-zinc-700 dark:text-zinc-300 animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${isExhausted ? "bg-rose-500/10 text-rose-500" : isWarning ? "bg-amber-500/10 text-amber-500" : "bg-indigo-500/10 text-indigo-500"}`}>
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                    Import Limits
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Live quota deduction
                  </p>
                </div>
              </div>

              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                  isExhausted
                    ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                    : isWarning
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                }`}
              >
                {isExhausted ? "Depleted" : isWarning ? "Low Limit" : "Active"}
              </span>
            </div>

            {/* Sequence Representation: 10 total → 2 used → 8 remaining */}
            <div className="mt-3.5 p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800 text-center">
              <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium mb-1">
                Current Allocation Flow
              </div>
              <div className="flex items-center justify-center gap-1.5 text-xs font-semibold">
                <span className="text-zinc-800 dark:text-zinc-200">{total} total</span>
                <span className="text-zinc-400">→</span>
                <span className="text-indigo-600 dark:text-indigo-400">{used} used</span>
                <span className="text-zinc-400">→</span>
                <span className={isExhausted ? "text-rose-600 font-bold" : "text-emerald-600 dark:text-emerald-400 font-bold"}>
                  {remaining} remaining
                </span>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-center">
                <div className="text-[10px] uppercase font-bold text-zinc-400">Total</div>
                <div className="text-lg font-bold text-zinc-900 dark:text-zinc-100 mt-0.5">
                  {total}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-center">
                <div className="text-[10px] uppercase font-bold text-zinc-400">Used</div>
                <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
                  {used}
                </div>
              </div>
              <div className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 border border-zinc-100 dark:border-zinc-800 text-center">
                <div className="text-[10px] uppercase font-bold text-zinc-400">Remaining</div>
                <div className={`text-lg font-bold mt-0.5 ${isExhausted ? "text-rose-600" : isWarning ? "text-amber-600" : "text-emerald-600 dark:text-emerald-400"}`}>
                  {remaining}
                </div>
              </div>
            </div>

            {/* Visual Progress Bar */}
            <div className="mt-3.5 space-y-1.5">
              <div className="flex justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                <span>Usage Progress</span>
                <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                  {percentage}% ({used}/{total})
                </span>
              </div>
              <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all duration-300 rounded-full ${
                    isExhausted
                      ? "bg-rose-500"
                      : isWarning
                      ? "bg-amber-500"
                      : "bg-indigo-600 dark:bg-indigo-500"
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>

            {/* Rules Note */}
            <div className="mt-3.5 p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-zinc-600 dark:text-zinc-300 flex items-start gap-2">
              <CheckCircle2 className="w-3.5 h-3.5 text-indigo-500 mt-0.5 shrink-0" />
              <span>
                Every successful imported item (YouTube video, Short, Instagram post, or Reel) automatically deducts <strong>1 limit</strong>.
              </span>
            </div>

            {isExhausted && (
              <div className="mt-2 p-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-[11px] text-rose-700 dark:text-rose-300 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                <span>You have 0 remaining imports. Upgrade your plan to continue saving items.</span>
              </div>
            )}

            <Link
              href="/#pricing"
              onClick={() => setIsOpen(false)}
              className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900"
            >
              <Zap className="h-3.5 w-3.5" />
              Explore plans &amp; upgrade
            </Link>

            {/* Action Bar */}
            <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex justify-end">
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-[11px] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
