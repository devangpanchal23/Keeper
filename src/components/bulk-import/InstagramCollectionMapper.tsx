"use client";

import React, { useState, useMemo } from "react";
import { Collection } from "@/types";
import {
  DiscoveredInstagramCollection,
  InstagramExportCandidate,
} from "@/services/bulk-import/adapters/instagram-export-adapter";
import { ParsedImportCandidate } from "@/services/bulk-import/export-parser";
import { CollectionService } from "@/services/collection-service";
import {
  FolderPlus,
  Layers,
  CheckSquare,
  Square,
  ArrowRight,
  FolderTree,
  FolderCheck,
  CheckCircle2,
  Sparkles,
  Info,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface InstagramCollectionMapperProps {
  discoveredCollections: DiscoveredInstagramCollection[];
  uncollectedCount: number;
  allCandidates: InstagramExportCandidate[];
  existingCollections: Collection[];
  onCreateCollection?: (name: string) => Promise<Collection> | Collection;
  onConfirm: (selectedCandidates: ParsedImportCandidate[]) => void;
  onCancel: () => void;
}

type MappingMode = "single_destination" | "preserve_source_collections";

export const InstagramCollectionMapper: React.FC<InstagramCollectionMapperProps> = ({
  discoveredCollections,
  uncollectedCount,
  allCandidates,
  existingCollections,
  onCreateCollection,
  onConfirm,
  onCancel,
}) => {
  // 1. Selection State (default: all collections selected)
  const [selectedColNames, setSelectedColNames] = useState<Set<string>>(
    () => new Set(discoveredCollections.map((c) => c.name))
  );
  const [includeUncollected, setIncludeUncollected] = useState<boolean>(true);

  // 2. Mapping Mode State
  const [mappingMode, setMappingMode] = useState<MappingMode>(
    discoveredCollections.length > 0 ? "preserve_source_collections" : "single_destination"
  );

  // Option A: Single Destination
  const [singleTargetCollectionId, setSingleTargetCollectionId] = useState<string>("");

  // Option B: Multi-collection mapping
  // Map of instagramColName -> targetKeeperCollectionId or "__NEW__"
  const [colTargetMap, setColTargetMap] = useState<Record<string, string>>(() => {
    const initialMap: Record<string, string> = {};
    for (const sourceCol of discoveredCollections) {
      // Find matching existing collection by case-insensitive name
      const match = existingCollections.find(
        (ec) => ec.name.toLowerCase().trim() === sourceCol.name.toLowerCase().trim()
      );
      if (match) {
        initialMap[sourceCol.name] = match.id;
      } else {
        // Default to creating a new matching collection
        initialMap[sourceCol.name] = "__NEW__";
      }
    }
    return initialMap;
  });

  // Explicit confirmation state for creating new collections
  const [confirmCreateCollections, setConfirmCreateCollections] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);

  // Calculate selected counts
  const selectedCandidates = useMemo(() => {
    return allCandidates.filter((item) => {
      if (item.sourceCollection) {
        return selectedColNames.has(item.sourceCollection);
      }
      return includeUncollected;
    });
  }, [allCandidates, selectedColNames, includeUncollected]);

  const allSelected =
    selectedColNames.size === discoveredCollections.length &&
    (uncollectedCount === 0 || includeUncollected);

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedColNames(new Set());
      setIncludeUncollected(false);
    } else {
      setSelectedColNames(new Set(discoveredCollections.map((c) => c.name)));
      setIncludeUncollected(true);
    }
  };

  const toggleCollection = (name: string) => {
    const next = new Set(selectedColNames);
    if (next.has(name)) {
      next.delete(name);
    } else {
      next.add(name);
    }
    setSelectedColNames(next);
  };

  // Find collections that need creation
  const newCollectionsToCreate = useMemo(() => {
    if (mappingMode !== "preserve_source_collections") return [];
    const needed: string[] = [];
    for (const colName of Array.from(selectedColNames)) {
      if (colTargetMap[colName] === "__NEW__") {
        needed.push(colName);
      }
    }
    return needed;
  }, [mappingMode, selectedColNames, colTargetMap]);

  const handleContinue = async () => {
    if (selectedCandidates.length === 0) return;
    setMappingError(null);
    setIsProcessing(true);
    const createdInThisRun: string[] = [];

    try {
      // Map to hold resolution: sourceColName -> keeperCollectionId
      const resolvedCollectionIds: Record<string, string | undefined> = {};

      if (mappingMode === "preserve_source_collections") {
        // Create any new collections with explicit confirmation and rollback safety
        for (const colName of newCollectionsToCreate) {
          if (onCreateCollection) {
            try {
              const created = await onCreateCollection(colName);
              if (!created || !created.id) {
                throw new Error(`Failed to generate collection ID for "${colName}"`);
              }
              createdInThisRun.push(created.id);
              resolvedCollectionIds[colName] = created.id;
            } catch (createErr: any) {
              // Roll back any collections created during this run to avoid orphan collections
              for (const rollbackId of createdInThisRun) {
                try {
                  CollectionService.delete(rollbackId);
                } catch {}
              }
              const msg = createErr instanceof Error ? createErr.message : String(createErr);
              setMappingError(
                `Failed to create collection "${colName}": ${msg}. Any newly created collections were safely rolled back. Import mapping was aborted.`
              );
              setIsProcessing(false);
              return; // Terminate without calling onConfirm
            }
          }
        }

        // Fill in existing mappings
        for (const colName of Array.from(selectedColNames)) {
          if (!resolvedCollectionIds[colName]) {
            const targetId = colTargetMap[colName];
            if (targetId && targetId !== "__NEW__") {
              resolvedCollectionIds[colName] = targetId;
            }
          }
        }
      }

      // Transform candidates with destination collections assigned
      const mappedCandidates: ParsedImportCandidate[] = selectedCandidates.map((c) => {
        let destCollectionId: string | undefined = undefined;
        let destCollectionName: string | undefined = undefined;

        if (mappingMode === "single_destination") {
          destCollectionId = singleTargetCollectionId || undefined;
          const assignedCol = existingCollections.find((ec) => ec.id === destCollectionId);
          destCollectionName = assignedCol?.name;
        } else if (c.sourceCollection) {
          destCollectionId = resolvedCollectionIds[c.sourceCollection];
          const assignedCol = existingCollections.find((ec) => ec.id === destCollectionId);
          destCollectionName = assignedCol?.name || c.sourceCollection;
        }

        return {
          originalUrl: c.originalUrl,
          platform: "instagram",
          title: c.title,
          sourceContext: c.sourceCollection || "Instagram Saved",
          savedTimestamp: c.savedTimestamp,
          collectionId: destCollectionId,
          collectionName: destCollectionName,
        };
      });

      onConfirm(mappedCandidates);
    } catch (err) {
      console.error("Failed to map collections", err);
      setMappingError("An unexpected error occurred during collection mapping.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Error banner if collection creation failed */}
      {mappingError && (
        <div className="p-4 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50 dark:bg-rose-950/20 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-rose-950 dark:text-rose-200">
              Collection Creation Aborted
            </p>
            <p className="text-rose-800 dark:text-rose-300/90 leading-relaxed">
              {mappingError}
            </p>
          </div>
        </div>
      )}
      {/* Header Banner */}
      <div className="p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-pink-500/10 text-pink-600 dark:text-pink-400 flex items-center justify-center font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Instagram Saved Content Discovered
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {allCandidates.length} total items found across{" "}
                {discoveredCollections.length} saved collection{discoveredCollections.length !== 1 ? "s" : ""}
                {uncollectedCount > 0 ? ` and ${uncollectedCount} general saved posts` : ""}.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {allSelected ? <CheckSquare className="w-3.5 h-3.5 text-indigo-600" /> : <Square className="w-3.5 h-3.5" />}
            <span>{allSelected ? "Deselect All" : "Select All"}</span>
          </button>
        </div>
      </div>

      {/* Discovered Collections Selection Grid */}
      {discoveredCollections.length > 0 ? (
        <div className="space-y-3">
          <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
            Select Collections to Import
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {discoveredCollections.map((col) => {
              const isSelected = selectedColNames.has(col.name);
              return (
                <div
                  key={col.name}
                  onClick={() => toggleCollection(col.name)}
                  className={cn(
                    "p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none",
                    isSelected
                      ? "border-pink-500/80 bg-pink-50/30 dark:bg-pink-950/20 ring-1 ring-pink-500/20"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 opacity-60 hover:opacity-100"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "w-4 h-4 rounded flex items-center justify-center transition-colors",
                          isSelected
                            ? "bg-pink-600 text-white"
                            : "border border-zinc-300 dark:border-zinc-700"
                        )}
                      >
                        {isSelected && <CheckCircle2 className="w-3.5 h-3.5 fill-current" />}
                      </div>
                      <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                        {col.name}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                      {col.count}
                    </span>
                  </div>

                  {col.sampleUrls.length > 0 && (
                    <p className="text-[10px] text-zinc-400 font-mono truncate mt-2">
                      {col.sampleUrls[0]}
                    </p>
                  )}
                </div>
              );
            })}

            {uncollectedCount > 0 && (
              <div
                onClick={() => setIncludeUncollected(!includeUncollected)}
                className={cn(
                  "p-4 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between select-none",
                  includeUncollected
                    ? "border-pink-500/80 bg-pink-50/30 dark:bg-pink-950/20 ring-1 ring-pink-500/20"
                    : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 opacity-60 hover:opacity-100"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={cn(
                        "w-4 h-4 rounded flex items-center justify-center transition-colors",
                        includeUncollected
                          ? "bg-pink-600 text-white"
                          : "border border-zinc-300 dark:border-zinc-700"
                      )}
                    >
                      {includeUncollected && <CheckCircle2 className="w-3.5 h-3.5 fill-current" />}
                    </div>
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
                      All Other Saved Posts
                    </span>
                  </div>
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                    {uncollectedCount}
                  </span>
                </div>
                <p className="text-[10px] text-zinc-400 mt-2">
                  Posts saved without a specific collection
                </p>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 text-xs text-zinc-500">
          No separate collection folders detected in export. All {allCandidates.length} saves will be imported together.
        </div>
      )}

      {/* Keeper Collection Mapping Options */}
      <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 space-y-5">
        <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <FolderTree className="w-4 h-4 text-indigo-500" />
          Keeper Collection Destination Mapping
        </h4>

        {/* Mode Selector Tabs */}
        {discoveredCollections.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setMappingMode("preserve_source_collections")}
              className={cn(
                "p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer",
                mappingMode === "preserve_source_collections"
                  ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-zinc-900 dark:text-zinc-100 mb-1">
                <FolderCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                Option B: Preserve Instagram Collection Organization
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Retain original folders. Maps each Instagram collection directly to a matching Keeper collection.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setMappingMode("single_destination")}
              className={cn(
                "p-3.5 rounded-xl border-2 text-left transition-all cursor-pointer",
                mappingMode === "single_destination"
                  ? "border-indigo-600 bg-indigo-50/40 dark:bg-indigo-950/30"
                  : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
              )}
            >
              <div className="flex items-center gap-2 font-bold text-xs text-zinc-900 dark:text-zinc-100 mb-1">
                <Layers className="w-4 h-4 text-zinc-600 dark:text-zinc-400" />
                Option A: Single Collection or Auto-Assign
              </div>
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
                Import everything into one Keeper collection, or let Keeper AI categorize them automatically.
              </p>
            </button>
          </div>
        )}

        {/* Option A: Single Destination Collection */}
        {mappingMode === "single_destination" && (
          <div className="space-y-2">
            <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
              Destination Collection in Keeper
            </label>
            <select
              value={singleTargetCollectionId}
              onChange={(e) => setSingleTargetCollectionId(e.target.value)}
              className="w-full p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Auto-Assign (AI Topic Categorization)</option>
              {existingCollections.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Option B: Source Collection Mapping Table */}
        {mappingMode === "preserve_source_collections" && (
          <div className="space-y-3">
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
              {Array.from(selectedColNames).map((colName) => {
                const currentTarget = colTargetMap[colName] || "__NEW__";
                return (
                  <div
                    key={colName}
                    className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs bg-white/50 dark:bg-zinc-900/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                        Instagram: <span className="text-pink-600 dark:text-pink-400 font-bold">{colName}</span>
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-400 hidden sm:block" />
                      <span className="text-zinc-400 text-[11px]">Keeper:</span>
                      <select
                        value={currentTarget}
                        onChange={(e) =>
                          setColTargetMap((prev) => ({
                            ...prev,
                            [colName]: e.target.value,
                          }))
                        }
                        className="p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="__NEW__">+ Create new collection &quot;{colName}&quot;</option>
                        {existingCollections.map((ec) => (
                          <option key={ec.id} value={ec.id}>
                            {ec.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Explicit Confirmation for New Collections */}
            {newCollectionsToCreate.length > 0 && (
              <div className="p-4 rounded-xl border border-indigo-200/80 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 space-y-2">
                <div className="flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold text-indigo-950 dark:text-indigo-200">
                      New Keeper Collections Confirmation Required
                    </p>
                    <p className="text-indigo-800 dark:text-indigo-300/90 leading-relaxed">
                      The following {newCollectionsToCreate.length} collection{newCollectionsToCreate.length !== 1 ? "s" : ""} will be created in your Keeper library:
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {newCollectionsToCreate.map((n) => (
                        <span
                          key={n}
                          className="px-2 py-0.5 rounded-md bg-white dark:bg-zinc-800 border border-indigo-200 dark:border-indigo-800 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="flex items-center gap-2 pt-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={confirmCreateCollections}
                    onChange={(e) => setConfirmCreateCollections(e.target.checked)}
                    className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
                    I confirm creating these {newCollectionsToCreate.length} new collection{newCollectionsToCreate.length !== 1 ? "s" : ""} in Keeper
                  </span>
                </label>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          Cancel
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-zinc-500 dark:text-zinc-400">
            Selected: <span className="text-zinc-900 dark:text-zinc-100 font-bold">{selectedCandidates.length}</span> items
          </span>

          <button
            type="button"
            onClick={handleContinue}
            disabled={
              selectedCandidates.length === 0 ||
              isProcessing ||
              (newCollectionsToCreate.length > 0 && !confirmCreateCollections)
            }
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
          >
            <span>{isProcessing ? "Configuring..." : "Continue to Import Preview"}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
