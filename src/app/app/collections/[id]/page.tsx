"use client";

import React, { use, useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecall } from "@/context/RecallContext";
import { SaveItemCard } from "@/components/cards/SaveItemCard";
import { SaveItemListRow } from "@/components/cards/SaveItemListRow";
import { EmptyState } from "@/components/common/EmptyState";
import { SavedItem } from "@/types";
import {
  Folder,
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  LayoutGrid,
  List,
  ChevronDown,
  CheckSquare,
  AlertCircle,
  X,
  AlertTriangle,
  FolderX,
} from "lucide-react";

export default function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const {
    collections,
    items,
    openCollectionModal,
    deleteCollection,
    deleteCollectionItems,
    openAddContent,
    viewMode,
    setViewMode,
  } = useRecall();

  // Selection & Mode State
  const [deleteMenuOpen, setDeleteMenuOpen] = useState(false);
  const [isSingleDeleteMode, setIsSingleDeleteMode] = useState(false);
  const [isMultiDeleteMode, setIsMultiDeleteMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [isAllSelected, setIsAllSelected] = useState(false);

  // Confirmation Modals State
  const [singleTargetItem, setSingleTargetItem] = useState<SavedItem | null>(null);
  const [multiConfirmOpen, setMultiConfirmOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);

  const collection = collections.find((c) => c.id === resolvedParams.id);

  // Reset selection states on navigation or collection change
  useEffect(() => {
    setIsSingleDeleteMode(false);
    setIsMultiDeleteMode(false);
    setSelectedItemIds(new Set());
    setIsAllSelected(false);
    setSingleTargetItem(null);
    setMultiConfirmOpen(false);
    setDeleteMenuOpen(false);
  }, [resolvedParams.id]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setDeleteMenuOpen(false);
      }
    }
    if (deleteMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [deleteMenuOpen]);

  if (!collection) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link
          href="/app/collections"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Collections
        </Link>
        <EmptyState
          title="Collection Not Found"
          description="This collection may have been deleted or moved."
          actionLabel="View All Collections"
          onAction={() => router.push("/app/collections")}
        />
      </div>
    );
  }

  // Filter items belonging to this collection strictly
  const collectionItems = items.filter(
    (item) =>
      !item.trashed &&
      !item.archived &&
      (item.collectionId === collection.id || item.collections?.includes(collection.id))
  );

  const selectedCount = isAllSelected ? collectionItems.length : selectedItemIds.size;

  // Toggle individual item selection in multi-delete mode
  const handleToggleSelect = (itemId: string) => {
    const next = new Set(selectedItemIds);
    if (isAllSelected) {
      // If was select-all, unchecking one item switches to explicit set minus that item
      collectionItems.forEach((it) => next.add(it.id));
      next.delete(itemId);
      setIsAllSelected(false);
    } else {
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      if (next.size === collectionItems.length && collectionItems.length > 0) {
        setIsAllSelected(true);
      }
    }
    setSelectedItemIds(next);
  };

  // Toggle select-all
  const handleToggleSelectAll = () => {
    if (isAllSelected || selectedItemIds.size === collectionItems.length) {
      setSelectedItemIds(new Set());
      setIsAllSelected(false);
    } else {
      const allIds = new Set(collectionItems.map((i) => i.id));
      setSelectedItemIds(allIds);
      setIsAllSelected(true);
    }
  };

  // Handle single item click when in single delete mode
  const handleItemClickInSingleMode = (item: SavedItem) => {
    setSingleTargetItem(item);
  };

  // Execute single item deletion
  const handleConfirmSingleDelete = async () => {
    if (!singleTargetItem) return;
    setIsDeleting(true);
    try {
      await deleteCollectionItems(collection.id, [singleTargetItem.id]);
      setSingleTargetItem(null);
      setIsSingleDeleteMode(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Execute multi-item deletion
  const handleConfirmMultiDelete = async () => {
    if (selectedCount === 0) return;
    setIsDeleting(true);
    try {
      const ids = isAllSelected ? undefined : Array.from(selectedItemIds);
      await deleteCollectionItems(collection.id, ids, isAllSelected);
      setSelectedItemIds(new Set());
      setIsAllSelected(false);
      setIsMultiDeleteMode(false);
      setMultiConfirmOpen(false);
    } finally {
      setIsDeleting(false);
    }
  };

  // Legacy delete entire collection
  const handleDeleteCollection = () => {
    setDeleteMenuOpen(false);
    if (confirm(`Are you sure you want to delete collection "${collection.name}"? All saved items inside will be unlinked.`)) {
      deleteCollection(collection.id);
      router.push("/app/collections");
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Back link */}
      <div>
        <Link
          href="/app/collections"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> All Collections
        </Link>
      </div>

      {/* Collection Hero Header */}
      <div className="relative p-6 sm:p-8 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs overflow-hidden">
        <div
          className="absolute top-0 left-0 right-0 h-2"
          style={{ backgroundColor: collection.color }}
        />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pt-2">
          <div className="flex items-start gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-md shrink-0"
              style={{ backgroundColor: collection.color }}
            >
              <Folder className="w-7 h-7" />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
                <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                  {collection.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 shrink-0">
                  {collectionItems.length} saves
                </span>
              </div>
              {collection.description && (
                <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1.5 max-w-2xl leading-relaxed">
                  {collection.description}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 self-start flex-wrap">
            <button
              onClick={() => openCollectionModal(collection)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>

            {/* Production Delete Menu Dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setDeleteMenuOpen(!deleteMenuOpen)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
                aria-haspopup="true"
                aria-expanded={deleteMenuOpen}
              >
                <Trash2 className="w-3.5 h-3.5" />
                Delete
                <ChevronDown className="w-3 h-3 opacity-70" />
              </button>

              {deleteMenuOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-56 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-1.5 z-40 text-xs animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      setDeleteMenuOpen(false);
                      setIsSingleDeleteMode(true);
                      setIsMultiDeleteMode(false);
                    }}
                    disabled={collectionItems.length === 0}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    <div>
                      <div className="font-semibold">Delete Single</div>
                      <div className="text-[11px] text-zinc-400">Pick an item to delete</div>
                    </div>
                  </button>

                  <button
                    onClick={() => {
                      setDeleteMenuOpen(false);
                      setIsMultiDeleteMode(true);
                      setIsSingleDeleteMode(false);
                      setSelectedItemIds(new Set());
                      setIsAllSelected(false);
                    }}
                    disabled={collectionItems.length === 0}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <CheckSquare className="w-3.5 h-3.5 text-rose-500" />
                    <div>
                      <div className="font-semibold">Delete Multiple</div>
                      <div className="text-[11px] text-zinc-400">Select multiple or all items</div>
                    </div>
                  </button>

                  <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1.5" />

                  <button
                    onClick={handleDeleteCollection}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                  >
                    <FolderX className="w-3.5 h-3.5" />
                    <div>
                      <div className="font-semibold">Delete Collection</div>
                      <div className="text-[11px] text-zinc-400">Remove collection folder</div>
                    </div>
                  </button>
                </div>
              )}
            </div>

            <button
              onClick={() => openAddContent()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Link
            </button>
          </div>
        </div>
      </div>

      {/* SINGLE DELETE MODE BANNER */}
      {isSingleDeleteMode && (
        <div className="flex items-center justify-between gap-3 p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 text-xs shadow-xs animate-in fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <span>
              <strong>Single Delete Mode:</strong> Click any saved item below in <em>&quot;{collection.name}&quot;</em> to delete or remove it.
            </span>
          </div>
          <button
            onClick={() => setIsSingleDeleteMode(false)}
            className="px-3 py-1 rounded-xl bg-white dark:bg-zinc-800 border border-amber-300 dark:border-amber-700 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-amber-100 dark:hover:bg-zinc-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* MULTIPLE DELETE SELECTION TOOLBAR */}
      {isMultiDeleteMode && (
        <div className="sticky top-4 z-20 flex flex-wrap items-center justify-between gap-2.5 p-3 sm:p-3.5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-800 shadow-xl border border-zinc-700/60 animate-in fade-in slide-in-from-top-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-zinc-800 dark:bg-zinc-700 text-zinc-200">
              {selectedCount} selected
            </span>
            <button
              onClick={() => {
                const allIds = new Set(collectionItems.map((i) => i.id));
                setSelectedItemIds(allIds);
                setIsAllSelected(true);
              }}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
            >
              Select All
            </button>
            <button
              onClick={() => {
                setSelectedItemIds(new Set());
                setIsAllSelected(false);
              }}
              className="text-xs font-medium px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors"
            >
              Clear
            </button>
            <span className="text-[11px] text-zinc-400 hidden sm:inline">
              (Scoped strictly to &quot;{collection.name}&quot;)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <button
              onClick={() => {
                setIsMultiDeleteMode(false);
                setSelectedItemIds(new Set());
                setIsAllSelected(false);
              }}
              className="px-3 py-1.5 rounded-xl text-xs font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors"
            >
              Cancel
            </button>
            <button
              disabled={selectedCount === 0 || isDeleting}
              onClick={() => setMultiConfirmOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 disabled:opacity-40 disabled:cursor-not-allowed text-white shadow-sm transition-all"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete Selected ({selectedCount})
            </button>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-zinc-400">
          Saved Items ({collectionItems.length})
        </h2>

        {/* View Switcher */}
        <div className="flex items-center p-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <button
            onClick={() => setViewMode("grid")}
            className={`p-1.5 rounded-lg transition-colors ${
              viewMode === "grid"
                ? "bg-indigo-600 text-white shadow-2xs"
                : "text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            }`}
            aria-label="Grid view"
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
            aria-label="List view"
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Items */}
      {collectionItems.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {collectionItems.map((item) => {
              const isSelected = isAllSelected || selectedItemIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isSingleDeleteMode) {
                      handleItemClickInSingleMode(item);
                    }
                  }}
                  className={isSingleDeleteMode ? "cursor-pointer" : undefined}
                >
                  <SaveItemCard
                    item={item}
                    selectable={isMultiDeleteMode}
                    selected={isSelected}
                    onToggleSelect={() => handleToggleSelect(item.id)}
                  />
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-2.5">
            {collectionItems.map((item) => {
              const isSelected = isAllSelected || selectedItemIds.has(item.id);
              return (
                <div
                  key={item.id}
                  onClick={() => {
                    if (isSingleDeleteMode) {
                      handleItemClickInSingleMode(item);
                    }
                  }}
                  className={isSingleDeleteMode ? "cursor-pointer" : undefined}
                >
                  <SaveItemListRow
                    item={item}
                    selectable={isMultiDeleteMode}
                    selected={isSelected}
                    onToggleSelect={() => handleToggleSelect(item.id)}
                  />
                </div>
              );
            })}
          </div>
        )
      ) : (
        <EmptyState
          icon={<Folder className="w-6 h-6 text-indigo-500" />}
          title="No bookmarks in this collection yet"
          description="Save links directly to this folder, or assign existing library bookmarks to it."
          actionLabel="+ Add Content to Collection"
          onAction={() => openAddContent()}
        />
      )}

      {/* SINGLE DELETE CONFIRMATION MODAL */}
      {singleTargetItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <button
                onClick={() => setSingleTargetItem(null)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Delete this saved item?
              </h3>
              <p className="text-xs text-zinc-600 dark:text-zinc-300 font-medium line-clamp-2 bg-zinc-50 dark:bg-zinc-800/60 p-2.5 rounded-xl border border-zinc-100 dark:border-zinc-800">
                &quot;{singleTargetItem.title}&quot;
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                {(singleTargetItem.collections && singleTargetItem.collections.length > 1)
                  ? `This item belongs to multiple collections. It will be removed from "${collection.name}" while keeping your copy in other collections intact.`
                  : `This item will be moved to Trash. You can restore it at any time from Trash.`}
              </p>
              <div className="text-[11px] font-semibold text-zinc-400">
                This action applies only to collection &quot;{collection.name}&quot;.
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setSingleTargetItem(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSingleDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? "Deleting..." : (singleTargetItem.collections && singleTargetItem.collections.length > 1) ? "Remove from Collection" : "Move to Trash"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MULTIPLE DELETE CONFIRMATION MODAL */}
      {multiConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-md rounded-3xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <button
                onClick={() => setMultiConfirmOpen(false)}
                className="p-1 rounded-xl text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Delete {selectedCount} selected {selectedCount === 1 ? "item" : "items"}?
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
                These items will be moved to Trash. If any selected item is also saved in another collection, it will be unlinked from &quot;{collection.name}&quot; while keeping other collections intact.
              </p>
              <div className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800/80 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700">
                Collection: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{collection.name}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setMultiConfirmOpen(false)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmMultiDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm transition-all disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {isDeleting ? "Processing..." : `Delete ${selectedCount} Items`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
