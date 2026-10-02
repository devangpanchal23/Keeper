"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Folder,
  ArrowRight,
  Loader2,
  X,
  Layers,
  Check,
  ChevronRight,
  Tag,
  FileText,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ImportItem, OrganizationJobReport, ItemOrganizationResult, SavedItem } from "@/types";
import { CollectionOrganizerService } from "@/services/collection-organizer-service";
import { CollectionService } from "@/services/collection-service";
import { ContentService } from "@/services/content-service";

interface AiOrganizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedImportItems: ImportItem[];
  onSuccess?: () => void;
}

type TabType = "all" | "applied" | "review" | "uncertain";

export const AiOrganizeModal: React.FC<AiOrganizeModalProps> = ({
  isOpen,
  onClose,
  selectedImportItems,
  onSuccess,
}) => {
  const [phase, setPhase] = useState<"idle" | "processing" | "done">("idle");
  const [progress, setProgress] = useState({ completed: 0, total: 0, currentTitle: "" });
  const [report, setReport] = useState<OrganizationJobReport | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("all");
  const [applyingIds, setApplyingIds] = useState<Set<string>>(new Set());
  const [appliedIds, setAppliedIds] = useState<Set<string>>(new Set());

  // Filter valid saved items from the selection
  const validItemsWithSavedId = selectedImportItems.filter((i) => Boolean(i.savedItemId));

  const startOrganization = useCallback(async () => {
    if (validItemsWithSavedId.length === 0) return;

    setPhase("processing");
    setProgress({ completed: 0, total: validItemsWithSavedId.length, currentTitle: "Preparing items..." });

    // Fetch items from storage
    const items: SavedItem[] = [];
    for (const importItem of validItemsWithSavedId) {
      if (importItem.savedItemId) {
        const item = ContentService.getById(importItem.savedItemId);
        if (item) items.push(item);
      }
    }

    const collections = CollectionService.getAll();

    try {
      const jobReport = await CollectionOrganizerService.organizeSelectedItems(
        items,
        collections,
        {
          autoAssignThreshold: 0.75,
          concurrency: 3,
          onProgress: (completed: number, total: number, currentItem?: SavedItem | { title?: string; url?: string } | null) => {
            setProgress({
              completed,
              total,
              currentTitle: currentItem?.title || currentItem?.url || `Item ${completed}/${total}`,
            });
          },
        }
      );

      setReport(jobReport);
      setPhase("done");
      if (onSuccess) {
        onSuccess();
      }
    } catch (err) {
      console.error("[AiOrganizeModal] Organization error:", err);
      setPhase("done");
    }
  }, [validItemsWithSavedId, onSuccess]);

  useEffect(() => {
    if (isOpen && phase === "idle") {
      startOrganization();
    }
  }, [isOpen, phase, startOrganization]);

  if (!isOpen) return null;

  const handleApplySuggestion = (result: ItemOrganizationResult) => {
    if (!report) return;
    setApplyingIds((prev) => new Set(prev).add(result.itemId));
    try {
      CollectionOrganizerService.applyApprovedSuggestions([result], report.userId || "user-demo-1");
      setAppliedIds((prev) => new Set(prev).add(result.itemId));
      if (onSuccess) onSuccess();
    } finally {
      setApplyingIds((prev) => {
        const next = new Set(prev);
        next.delete(result.itemId);
        return next;
      });
    }
  };

  const handleApplyAllSuggestions = () => {
    if (!report) return;
    const suggestedResults = report.results.filter(
      (r) => r.decision === "SUGGESTED" && !appliedIds.has(r.itemId)
    );
    if (suggestedResults.length === 0) return;

    CollectionOrganizerService.applyApprovedSuggestions(suggestedResults, report.userId || "user-demo-1");
    setAppliedIds((prev) => {
      const next = new Set(prev);
      suggestedResults.forEach((r) => next.add(r.itemId));
      return next;
    });
    if (onSuccess) onSuccess();
  };

  // Filtered results for list
  const filteredResults = (report?.results || []).filter((r) => {
    const isNowApplied = appliedIds.has(r.itemId);
    if (activeTab === "applied") return r.decision === "APPLIED" || isNowApplied;
    if (activeTab === "review") return r.decision === "SUGGESTED" && !isNowApplied;
    if (activeTab === "uncertain") return r.decision === "UNCERTAIN" || r.decision === "SKIPPED" || r.decision === "FAILED";
    return true;
  });

  const pendingReviewCount = (report?.results || []).filter(
    (r) => r.decision === "SUGGESTED" && !appliedIds.has(r.itemId)
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] flex flex-col rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 sm:p-6 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold">
              <Sparkles className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                AI Organize Selected Items
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {validItemsWithSavedId.length} items scoped for media resolution, transcription, and collection routing
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {phase === "processing" && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-5">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-indigo-500/20 border-t-indigo-600 animate-spin flex items-center justify-center" />
                <Sparkles className="w-6 h-6 text-indigo-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
              </div>

              <div className="space-y-1 max-w-md">
                <h4 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Organizing Items with AI...
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate px-4">
                  {progress.currentTitle}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md space-y-2">
                <div className="flex justify-between text-xs font-semibold text-zinc-500">
                  <span>
                    {progress.completed} of {progress.total} processed
                  </span>
                  <span>
                    {progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className="h-full bg-indigo-600 rounded-full transition-all duration-300 ease-out"
                    style={{
                      width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="flex items-center gap-4 text-[11px] text-zinc-400 pt-2">
                <span className="flex items-center gap-1.5">
                  <Volume2 className="w-3.5 h-3.5 text-indigo-500" /> Audio Transcribing
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-indigo-500" /> Semantic Analysis
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Folder className="w-3.5 h-3.5 text-indigo-500" /> Collection Matching
                </span>
              </div>
            </div>
          )}

          {phase === "done" && report && (
            <div className="space-y-6">
              {/* Scorecard Overview */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                    AI Organization Results ({report.totalSelected} selected)
                  </h4>
                  {pendingReviewCount > 0 && (
                    <button
                      type="button"
                      onClick={handleApplyAllSuggestions}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Apply All {pendingReviewCount} Suggestions
                    </button>
                  )}
                </div>

                {/* Conceptual Scorecard Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                  {(report.clusters || report.clusterSummary || []).map((cluster) => {
                    const isExisting = cluster.isExisting ?? !cluster.isNew;
                    const itemCount = cluster.itemCount ?? cluster.count ?? 0;
                    const autoAssigned = cluster.autoAssignedCount ?? 0;
                    const suggested = cluster.suggestedCount ?? 0;

                    return (
                      <div
                        key={cluster.collectionName}
                        className={cn(
                          "p-3 rounded-2xl border transition-all",
                          isExisting
                            ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40"
                            : "border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 truncate pr-1">
                            {cluster.collectionName}
                          </span>
                          <span className="text-xs font-black text-indigo-600 dark:text-indigo-400 shrink-0">
                            {itemCount}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-400">
                          {autoAssigned > 0 && (
                            <span className="text-emerald-600 dark:text-emerald-400">
                              {autoAssigned} auto-applied
                            </span>
                          )}
                          {suggested > 0 && (
                            <span className="text-amber-600 dark:text-amber-400">
                              {suggested} suggested
                            </span>
                          )}
                          {autoAssigned === 0 && suggested === 0 && (
                            <span>Unassigned</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Status Tabs */}
              <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800/80 text-xs w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveTab("all")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-medium transition-all",
                    activeTab === "all"
                      ? "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  )}
                >
                  All Items ({report.results.length})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("applied")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-medium transition-all",
                    activeTab === "applied"
                      ? "bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs font-semibold"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  )}
                >
                  Auto-Applied ({((report.autoAssignedCount ?? report.assignedCount ?? 0) + appliedIds.size)})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("review")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-medium transition-all",
                    activeTab === "review"
                      ? "bg-white dark:bg-zinc-900 text-amber-600 dark:text-amber-400 shadow-2xs font-semibold"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  )}
                >
                  Needs Review ({pendingReviewCount})
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("uncertain")}
                  className={cn(
                    "px-3 py-1.5 rounded-lg font-medium transition-all",
                    activeTab === "uncertain"
                      ? "bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 shadow-2xs font-semibold"
                      : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200"
                  )}
                >
                  Uncertain ({report.uncertainCount})
                </button>
              </div>

              {/* Results List */}
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800/80">
                {filteredResults.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400">
                    No items in this category.
                  </div>
                ) : (
                  filteredResults.map((result) => {
                    const isNowApplied = appliedIds.has(result.itemId);
                    const isApplying = applyingIds.has(result.itemId);
                    const effectiveDecision = isNowApplied ? "APPLIED" : result.decision;

                    return (
                      <div
                        key={result.itemId}
                        className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-800/30 transition-colors"
                      >
                        <div className="flex items-start gap-3 min-w-0 max-w-full md:max-w-[70%]">
                          <div className="pt-0.5 shrink-0">
                            {effectiveDecision === "APPLIED" && (
                              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                            )}
                            {effectiveDecision === "SUGGESTED" && (
                              <AlertCircle className="w-4 h-4 text-amber-500" />
                            )}
                            {(effectiveDecision === "UNCERTAIN" ||
                              effectiveDecision === "SKIPPED" ||
                              effectiveDecision === "FAILED") && (
                              <HelpCircle className="w-4 h-4 text-zinc-400" />
                            )}
                          </div>

                          <div className="space-y-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              {result.analysis?.primaryTopic && (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                                  {result.analysis.primaryTopic}
                                </span>
                              )}
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                Intent: {result.analysis?.intent || result.intent}
                              </span>
                              {result.analysis?.resourceAction && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
                                  {result.analysis.resourceAction.action?.toUpperCase()}: &quot;
                                  {result.analysis.resourceAction.trigger}&quot;
                                </span>
                              )}
                              {result.transcription?.status === "completed" && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                  <Volume2 className="w-2.5 h-2.5" />
                                  Transcribed ({result.transcription.language?.toUpperCase() || "AUDIO"})
                                </span>
                              )}
                              {result.transcription?.status === "unavailable" && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-200/50 dark:bg-zinc-800 text-zinc-500 flex items-center gap-1">
                                  Audio Unavailable
                                </span>
                              )}
                            </div>

                            <p className="text-xs text-zinc-600 dark:text-zinc-300">
                              {result.decisionReason || result.reasoning}
                            </p>

                            {result.analysis?.reasoning && (
                              <p className="text-[11px] text-zinc-400 italic">
                                &quot;{result.analysis.reasoning}&quot;
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Decision & Action */}
                        <div className="flex items-center gap-2 shrink-0 md:self-center">
                          {result.collectionMatch?.suggestedCollectionName && (
                            <span className="text-xs font-semibold px-2.5 py-1 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 flex items-center gap-1.5">
                              <Folder className="w-3.5 h-3.5" />
                              {result.collectionMatch.suggestedCollectionName}
                              <span className="text-[10px] opacity-75">
                                ({Math.round(((result.collectionMatch.confidence ?? result.confidence) ?? 0) * 100)}%)
                              </span>
                            </span>
                          )}

                          {effectiveDecision === "APPLIED" && (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <Check className="w-3 h-3" />
                              Assigned
                            </span>
                          )}

                          {effectiveDecision === "SUGGESTED" && (
                            <button
                              type="button"
                              onClick={() => handleApplySuggestion(result)}
                              disabled={isApplying}
                              className="px-3 py-1 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-white text-xs font-semibold shadow-2xs transition-all flex items-center gap-1"
                            >
                              {isApplying ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Check className="w-3 h-3" />
                              )}
                              <span>Accept</span>
                            </button>
                          )}

                          {effectiveDecision === "UNCERTAIN" && (
                            <span className="text-[11px] text-zinc-400">
                              Left in General Library
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-zinc-100 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-950/50 flex items-center justify-between">
          <div className="text-xs text-zinc-400">
            {phase === "done" && report && (
              <span>
                Processed in {Math.round((report.durationMs ?? 0) / 1000)}s • Safe merge preserved source
                authoritative fields
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-zinc-200 dark:text-zinc-900 text-xs font-semibold shadow-sm transition-all"
          >
            {phase === "done" ? "Done" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
};
