"use client";

import React from "react";
import Link from "next/link";
import { useRecall } from "@/context/RecallContext";
import { Folder, Plus, Edit2, ArrowRight } from "lucide-react";

export default function CollectionsPage() {
  const { collections, items, openCollectionModal } = useRecall();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
              Collections
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {collections.length}
            </span>
          </div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
            Curate and categorize your universal saves into dedicated topic spaces.
          </p>
        </div>

        <button
          onClick={() => openCollectionModal()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-105 active:scale-95 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          New Collection
        </button>
      </div>

      {/* Grid of Collection Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {collections.map((col) => {
          const count = items.filter(
            (i) =>
              !i.trashed &&
              !i.archived &&
              (i.collectionId === col.id || i.collections?.includes(col.id))
          ).length;

          return (
            <div
              key={col.id}
              className="group relative rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-900 shadow-xs hover:shadow-xl transition-all duration-300 p-5 flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-sm"
                    style={{ backgroundColor: col.color }}
                  >
                    <Folder className="w-5 h-5" />
                  </div>

                  <button
                    onClick={() => openCollectionModal(col)}
                    className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    title="Edit Collection"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>

                <Link
                  href={`/app/collections/${col.id}`}
                  className="block text-base font-bold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors line-clamp-1 mb-1.5"
                >
                  {col.name}
                </Link>

                <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                  {col.description || "No description provided."}
                </p>
              </div>

              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between mt-6">
                <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                  {count} {count === 1 ? "save" : "saves"}
                </span>

                <Link
                  href={`/app/collections/${col.id}`}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-400 group-hover:translate-x-0.5 transition-transform"
                >
                  Open <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
