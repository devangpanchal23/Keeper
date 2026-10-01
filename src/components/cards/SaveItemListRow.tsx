"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SavedItem } from "@/types";
import { useRecall } from "@/context/RecallContext";
import { PlatformBadge } from "@/components/common/PlatformBadge";
import { ContentTypeBadge } from "@/components/common/ContentTypeBadge";
import { formatDate } from "@/lib/utils";
import {
  Star,
  MoreVertical,
  ExternalLink,
  BookOpen,
  StickyNote,
  Archive,
  ArchiveRestore,
  Trash2,
  Folder,
} from "lucide-react";

interface SaveItemListRowProps {
  item: SavedItem;
}

export const SaveItemListRow: React.FC<SaveItemListRowProps> = ({ item }) => {
  const {
    collections,
    toggleFavorite,
    archiveItem,
    unarchiveItem,
    trashItem,
    restoreItem,
    permanentDeleteItem,
    openQuickNoteModal,
    recordView,
  } = useRecall();

  const [menuOpen, setMenuOpen] = useState(false);

  const collection = collections.find((c) => c.id === item.collectionId);

  return (
    <div
      onClick={() => recordView(item.id)}
      className="group flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50 dark:hover:bg-zinc-900/90 shadow-xs hover:shadow-md transition-all duration-200"
    >
      {/* Left: Thumbnail & Details */}
      <div className="flex items-start sm:items-center gap-3.5 min-w-0 flex-1">
        {/* Thumbnail */}
        <div className="relative w-20 h-14 rounded-lg bg-zinc-100 dark:bg-zinc-800 overflow-hidden shrink-0 border border-zinc-200 dark:border-zinc-700/50">
          {item.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.thumbnail}
              alt={item.title}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-zinc-400">
              <BookOpen className="w-5 h-5 opacity-40" />
            </div>
          )}
          <div className="absolute bottom-1 right-1">
            <PlatformBadge platform={item.platform} showIconOnly className="p-0.5" />
          </div>
        </div>

        {/* Text info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <ContentTypeBadge type={item.contentType} />
            <span className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              {item.creator.name}
            </span>
            {collection && (
              <span
                className="hidden md:inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                style={{ borderLeft: `2.5px solid ${collection.color}` }}
              >
                <Folder className="w-2.5 h-2.5 opacity-70" />
                {collection.name}
              </span>
            )}
          </div>

          <Link
            href={`/app/item/${item.id}`}
            className="block text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-1 transition-colors"
          >
            {item.title}
          </Link>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 line-clamp-1 mt-0.5">
            {item.aiSummary?.quick || item.description}
          </p>
        </div>
      </div>

      {/* Right: Metadata, Tags & Actions */}
      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-100 dark:border-zinc-800/60">
        {/* Tags */}
        <div className="hidden lg:flex items-center gap-1">
          {item.tags.slice(0, 2).map((t) => (
            <span
              key={t}
              className="text-[11px] px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400"
            >
              #{t}
            </span>
          ))}
        </div>

        {/* Date */}
        <span className="text-xs text-zinc-400">{formatDate(item.savedDate)}</span>

        {/* Favorite */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(item.id);
          }}
          className={`p-1.5 rounded-lg transition-colors ${
            item.favorite
              ? "text-amber-500 bg-amber-500/10"
              : "text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          }`}
          title={item.favorite ? "Favorited" : "Favorite"}
        >
          <Star className="w-4 h-4 fill-current" />
        </button>

        {/* Note indicator */}
        {item.personalNotes && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              openQuickNoteModal(item);
            }}
            className="text-amber-500 p-1.5 hover:bg-amber-500/10 rounded-lg"
            title="Has personal note"
          >
            <StickyNote className="w-4 h-4" />
          </button>
        )}

        {/* Dropdown Menu */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <MoreVertical className="w-4 h-4" />
          </button>

          {menuOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                }}
              />
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 top-full mt-1 w-44 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 shadow-2xl p-1 z-40 text-xs text-zinc-700 dark:text-zinc-300"
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                  Open Original
                </a>
                <Link
                  href={`/app/item/${item.id}`}
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                  View Details
                </Link>
                <button
                  onClick={() => {
                    openQuickNoteModal(item);
                    setMenuOpen(false);
                  }}
                  className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <StickyNote className="w-3.5 h-3.5 text-zinc-400" />
                  Edit Notes
                </button>
                <div className="h-px bg-zinc-200 dark:bg-zinc-800 my-1" />
                {item.trashed ? (
                  <>
                    <button
                      onClick={() => {
                        restoreItem(item.id);
                        setMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                    >
                      <ArchiveRestore className="w-3.5 h-3.5" />
                      Restore
                    </button>
                    <button
                      onClick={() => {
                        permanentDeleteItem(item.id);
                        setMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete Forever
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        archiveItem(item.id);
                        setMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    >
                      <Archive className="w-3.5 h-3.5 text-zinc-400" />
                      Archive
                    </button>
                    <button
                      onClick={() => {
                        trashItem(item.id);
                        setMenuOpen(false);
                      }}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Delete
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
