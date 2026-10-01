"use client";

import React, { use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecall } from "@/context/RecallContext";
import { SaveItemCard } from "@/components/cards/SaveItemCard";
import { SaveItemListRow } from "@/components/cards/SaveItemListRow";
import { EmptyState } from "@/components/common/EmptyState";
import {
  Folder,
  ArrowLeft,
  Edit2,
  Trash2,
  Plus,
  LayoutGrid,
  List,
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
    openAddContent,
    viewMode,
    setViewMode,
  } = useRecall();

  const collection = collections.find((c) => c.id === resolvedParams.id);

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

  // Filter items belonging to this collection
  const collectionItems = items.filter(
    (item) =>
      !item.trashed &&
      !item.archived &&
      (item.collectionId === collection.id || item.collections?.includes(collection.id))
  );

  const handleDelete = () => {
    if (confirm(`Are you sure you want to delete collection "${collection.name}"?`)) {
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

            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
                  {collection.name}
                </h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
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
          <div className="flex items-center gap-2 self-start">
            <button
              onClick={() => openCollectionModal(collection)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
            >
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </button>
            <button
              onClick={handleDelete}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-rose-200 dark:border-rose-900/50 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/40 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
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

      {/* Items */}
      {collectionItems.length > 0 ? (
        viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {collectionItems.map((item) => (
              <SaveItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="space-y-2.5">
            {collectionItems.map((item) => (
              <SaveItemListRow key={item.id} item={item} />
            ))}
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
    </div>
  );
}
