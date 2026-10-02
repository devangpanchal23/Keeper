"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRecall } from "@/context/RecallContext";
import {
  Home,
  Bookmark,
  Sparkles,
  Folder,
  Star,
  Clock,
  Archive,
  Trash2,
  Settings,
  ChevronDown,
  Plus,
  Compass,
  User,
  UploadCloud,
  ArrowUpRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getPlanLabel } from "@/lib/user-plan";

interface SidebarProps {
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ onCloseMobile }) => {
  const pathname = usePathname();
  const { items, collections, user, openCollectionModal } = useRecall();
  const [collectionsExpanded, setCollectionsExpanded] = useState(true);

  // Compute counts
  const activeItems = items.filter((i) => !i.trashed && !i.archived);
  const favoriteCount = activeItems.filter((i) => i.favorite).length;
  const recentCount = activeItems.filter((i) => {
    const time = new Date(i.savedDate).getTime();
    return Date.now() - time < 7 * 24 * 60 * 60 * 1000;
  }).length;
  const archiveCount = items.filter((i) => i.archived && !i.trashed).length;
  const trashCount = items.filter((i) => i.trashed).length;

  const mainNav = [
    {
      label: "Home",
      href: "/app",
      icon: <Home className="w-4 h-4" />,
      exact: true,
    },
    {
      label: "All Saves",
      href: "/app/library",
      icon: <Bookmark className="w-4 h-4" />,
      count: activeItems.length,
    },
    {
      label: "AI Search & Assistant",
      href: "/app/ai-assistant",
      icon: <Sparkles className="w-4 h-4 text-indigo-500" />,
      badge: "AI",
    },
    {
      label: "Favorites",
      href: "/app/favorites",
      icon: <Star className="w-4 h-4 text-amber-500" />,
      count: favoriteCount,
    },
    {
      label: "Recent",
      href: "/app/recent",
      icon: <Clock className="w-4 h-4 text-cyan-500" />,
      count: recentCount,
    },
    {
      label: "Bulk Import",
      href: "/app/bulk-import",
      icon: <UploadCloud className="w-4 h-4 text-emerald-500" />,
      badge: "BATCH",
    },
  ];

  const secondaryNav = [
    {
      label: "Archive",
      href: "/app/archive",
      icon: <Archive className="w-4 h-4" />,
      count: archiveCount,
    },
    {
      label: "Trash",
      href: "/app/trash",
      icon: <Trash2 className="w-4 h-4" />,
      count: trashCount,
    },
    {
      label: "Settings",
      href: "/app/settings",
      icon: <Settings className="w-4 h-4" />,
    },
    {
      label: "Profile",
      href: "/app/profile",
      icon: <User className="w-4 h-4 text-indigo-500" />,
    },
  ];

  return (
    <aside className="w-full md:w-64 h-full flex flex-col border-r border-zinc-200/80 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-md select-none">
      {/* Brand Logo & Tagline */}
      <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-200/80 dark:border-zinc-800/80">
        <Link
          href="/app"
          onClick={onCloseMobile}
          className="flex items-center gap-2.5 group"
        >
          <div className="w-8 h-8 rounded-xl bg-[#dfb944] text-zinc-900 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform font-extrabold tracking-tight">
            K
          </div>
          <div>
            <div className="text-base font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              Keeper
              <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-indigo-500/10 text-indigo-500">
                {getPlanLabel(user?.tier).toUpperCase()}
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-medium truncate max-w-[130px]">
              AI Universal Bookmark
            </p>
          </div>
        </Link>
      </div>

      {/* Navigation Scrollable Body */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {/* Main Nav Items */}
        <div className="space-y-1">
          {mainNav.map((item) => {
            const isActive = item.exact
              ? pathname === item.href
              : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-all group",
                  isActive
                    ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/70 dark:hover:bg-zinc-900/60"
                )}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span
                    className={cn(
                      "text-[11px] px-2 py-0.5 rounded-full font-semibold",
                      isActive
                        ? "bg-indigo-600/10 text-indigo-600 dark:text-indigo-300"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                    )}
                  >
                    {item.count}
                  </span>
                )}
                {item.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-2xs">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Collections Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <button
              onClick={() => setCollectionsExpanded(!collectionsExpanded)}
              className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
            >
              <Folder className="w-3.5 h-3.5" />
              <span>Collections</span>
              <ChevronDown
                className={cn(
                  "w-3 h-3 transition-transform duration-200",
                  collectionsExpanded ? "rotate-0" : "-rotate-90"
                )}
              />
            </button>
            <button
              onClick={() => openCollectionModal()}
              className="p-1 rounded-md text-zinc-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              title="Add New Collection"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {collectionsExpanded && (
            <div className="space-y-0.5 pl-1">
              <Link
                href="/app/collections"
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                  pathname === "/app/collections"
                    ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-semibold"
                    : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
                )}
              >
                <div className="flex items-center gap-2">
                  <Compass className="w-3.5 h-3.5 text-zinc-400" />
                  <span>All Collections</span>
                </div>
                <span className="text-[10px] text-zinc-400">
                  {collections.length}
                </span>
              </Link>

              {collections.map((col) => {
                const isColActive = pathname === `/app/collections/${col.id}`;
                const colItemCount = items.filter(
                  (i) =>
                    !i.trashed &&
                    !i.archived &&
                    (i.collectionId === col.id || i.collections?.includes(col.id))
                ).length;

                return (
                  <Link
                    key={col.id}
                    href={`/app/collections/${col.id}`}
                    onClick={onCloseMobile}
                    className={cn(
                      "flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-colors group",
                      isColActive
                        ? "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                        : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
                    )}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: col.color }}
                      />
                      <span className="truncate">{col.name}</span>
                    </div>
                    {colItemCount > 0 && (
                      <span className="text-[10px] text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                        {colItemCount}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Secondary / System Links */}
        <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800/80 space-y-1">
          {secondaryNav.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={cn(
                  "flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors",
                  isActive
                    ? "bg-zinc-100 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 font-semibold"
                    : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100/50 dark:hover:bg-zinc-900/40"
                )}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon}
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-medium">
                    {item.count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {/* Bottom Storage & AI badge info */}
      <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/30">
        <Link
          href="/#pricing"
          onClick={onCloseMobile}
          className="mb-3 flex min-h-11 items-center justify-between rounded-xl bg-indigo-600 px-3.5 py-2.5 text-white shadow-sm transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-950"
        >
          <span className="flex items-center gap-2 text-xs font-semibold">
            <Sparkles className="h-4 w-4" />
            Upgrade plan
          </span>
          <ArrowUpRight className="h-4 w-4" />
        </Link>
        <div className="p-3 rounded-xl bg-gradient-to-br from-indigo-500/10 via-purple-500/5 to-transparent border border-indigo-500/15">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
            <Sparkles className="w-3.5 h-3.5" />
            AI Workspace Ready
          </div>
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 leading-tight">
            {activeItems.length} items summarized, tagged, and ready for semantic AI search.
          </p>
        </div>
      </div>
    </aside>
  );
};
