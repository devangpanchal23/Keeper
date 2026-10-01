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
  Sparkles,
} from "lucide-react";

interface SaveItemCardProps {
  item: SavedItem;
}

export const SaveItemCard: React.FC<SaveItemCardProps> = ({ item }) => {
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

  const handleCardClick = () => {
    recordView(item.id);
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex flex-col rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 hover:bg-zinc-50/50 dark:hover:bg-zinc-900/90 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden glow-card"
    >
      {/* Thumbnail & Badges Container */}
      <div className="relative w-full h-44 bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
        {item.thumbnail ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.thumbnail}
            alt={item.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-zinc-400">
            <BookOpen className="w-10 h-10 opacity-30" />
          </div>
        )}

        {/* Top Overlay Badges */}
        <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-1.5 pointer-events-auto">
            <PlatformBadge platform={item.platform} />
            <ContentTypeBadge type={item.contentType} />
          </div>

          {/* Quick Actions (Favorite) */}
          <div className="flex items-center gap-1 pointer-events-auto">
            <button
              onClick={(e) => {
                e.stopPropagation();
                toggleFavorite(item.id);
              }}
              className={`p-1.5 rounded-full backdrop-blur-md transition-all ${
                item.favorite
                  ? "bg-amber-500/90 text-white shadow-md shadow-amber-500/30 scale-105"
                  : "bg-black/40 text-zinc-300 hover:text-white hover:bg-black/60 opacity-0 group-hover:opacity-100"
              }`}
              title={item.favorite ? "Favorited" : "Add to favorites"}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
            </button>
          </div>
        </div>

        {/* Collection Pill bottom left */}
        {collection && (
          <div className="absolute bottom-2.5 left-2.5 pointer-events-none">
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium backdrop-blur-md bg-black/60 text-zinc-200 border border-white/10"
              style={{ borderLeftColor: collection.color, borderLeftWidth: 3 }}
            >
              <Folder className="w-2.5 h-2.5 opacity-80" />
              {collection.name}
            </span>
          </div>
        )}

        {/* Duration / Read Time Badge */}
        {(item.metadata.duration || item.metadata.readTime) && (
          <div className="absolute bottom-2.5 right-2.5 pointer-events-none">
            <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-medium backdrop-blur-md bg-black/70 text-zinc-200">
              {item.metadata.duration || item.metadata.readTime}
            </span>
          </div>
        )}
      </div>

      {/* Card Content Body */}
      <div className="flex-1 p-4 flex flex-col justify-between">
        <div>
          {/* Creator & Date */}
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              {item.creator.avatar && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.creator.avatar}
                  alt={item.creator.name}
                  className="w-4 h-4 rounded-full object-cover shrink-0"
                />
              )}
              <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 truncate">
                {item.creator.name}
              </span>
              {item.isLimited && (
                <span className="shrink-0 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20" title="Limited content available">
                  Limited
                </span>
              )}
            </div>
            <span className="text-[11px] text-zinc-400 shrink-0">
              {formatDate(item.savedDate)}
            </span>
          </div>

          {/* Title */}
          <Link
            href={`/app/item/${item.id}`}
            className="block group/title text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:text-indigo-600 dark:hover:text-indigo-400 line-clamp-2 leading-snug transition-colors mb-2"
          >
            {item.title}
          </Link>

          {/* AI Quick Takeaway */}
          {item.aiSummary?.quick && (
            <div className="flex items-start gap-1.5 p-2 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 text-[11.5px] text-zinc-700 dark:text-zinc-300 mb-3">
              <Sparkles className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
              <p className="line-clamp-2 leading-relaxed">
                {item.aiSummary.quick}
              </p>
            </div>
          )}

          {/* Tags */}
          {item.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {item.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag}
                  className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                >
                  #{tag}
                </span>
              ))}
              {item.tags.length > 3 && (
                <span className="px-1 py-0.5 text-[10px] text-zinc-400">
                  +{item.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/60 flex items-center justify-between mt-auto">
          {/* Personal Note indicator if exists */}
          {item.personalNotes ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openQuickNoteModal(item);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-medium hover:underline"
              title={item.personalNotes}
            >
              <StickyNote className="w-3 h-3" />
              Note attached
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                openQuickNoteModal(item);
              }}
              className="inline-flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              <StickyNote className="w-3 h-3" />
              Add note
            </button>
          )}

          {/* Action Menu button & popup */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen(!menuOpen);
              }}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              aria-label="Item actions"
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
                  className="absolute right-0 bottom-full mb-1 w-44 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700/80 shadow-2xl p-1 z-40 text-xs text-zinc-700 dark:text-zinc-300 animate-in fade-in zoom-in-95 duration-150"
                >
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-zinc-400" />
                    Open Original
                  </a>

                  <Link
                    href={`/app/item/${item.id}`}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-zinc-400" />
                    View Details
                  </Link>

                  <button
                    onClick={() => {
                      toggleFavorite(item.id);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        item.favorite
                          ? "text-amber-500 fill-amber-500"
                          : "text-zinc-400"
                      }`}
                    />
                    {item.favorite ? "Unfavorite" : "Favorite"}
                  </button>

                  <button
                    onClick={() => {
                      openQuickNoteModal(item);
                      setMenuOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
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
                        className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                        Restore
                      </button>
                      <button
                        onClick={() => {
                          permanentDeleteItem(item.id);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Forever
                      </button>
                    </>
                  ) : item.archived ? (
                    <>
                      <button
                        onClick={() => {
                          unarchiveItem(item.id);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5 text-zinc-400" />
                        Unarchive
                      </button>
                      <button
                        onClick={() => {
                          trashItem(item.id);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Move to Trash
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          archiveItem(item.id);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Archive className="w-3.5 h-3.5 text-zinc-400" />
                        Archive
                      </button>
                      <button
                        onClick={() => {
                          trashItem(item.id);
                          setMenuOpen(false);
                        }}
                        className="w-full text-left flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
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
    </div>
  );
};
