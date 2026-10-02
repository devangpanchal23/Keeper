"use client";

import React from "react";
import { Platform } from "@/types";
import { ShieldCheck, CheckCircle2, Globe, Layers } from "lucide-react";
import {
  YoutubeIcon,
  InstagramIcon,
  PlatformBadge,
} from "@/components/common/PlatformBadge";
import { cn } from "@/lib/utils";

interface PlatformCardProps {
  platform: Platform;
  isSelected: boolean;
  onSelect: (p: Platform) => void;
}

export const PlatformCard: React.FC<PlatformCardProps> = ({
  platform,
  isSelected,
  onSelect,
}) => {
  const getPlatformDetails = (p: Platform) => {
    switch (p) {
      case "youtube":
        return {
          title: "YouTube & Shorts",
          subtitle: "Playlists, Liked Videos, Takeout CSV",
          description: "Import playlists and liked videos via Google OAuth, or complete Watch Later via Takeout CSV.",
          badge: "OAuth & Takeout",
          gradient: "from-red-600 to-rose-500 shadow-red-500/30",
          selectedBorder: "border-red-500 bg-red-500/5 dark:bg-red-500/10 ring-red-500/30",
        };
      case "instagram":
        return {
          title: "Instagram & Reels",
          subtitle: "Saved Reels, Posts, Collections",
          description: "Import your saved Instagram Reels and post collections via official data export or direct URL lists.",
          badge: "Export & URLs",
          gradient: "from-amber-500 via-pink-600 to-purple-600 shadow-pink-500/30",
          selectedBorder: "border-pink-500 bg-pink-500/5 dark:bg-pink-500/10 ring-pink-500/30",
        };
      case "reddit":
        return {
          title: "Reddit Posts & Threads",
          subtitle: "Saved Submissions & Comments",
          description: "Import Reddit saved posts, comments, text discussions, and media threads via JSON/CSV export or URLs.",
          badge: "JSON, CSV & URLs",
          gradient: "from-orange-600 to-amber-500 shadow-orange-500/30",
          selectedBorder: "border-orange-500 bg-orange-500/5 dark:bg-orange-500/10 ring-orange-500/30",
        };
      case "x":
      case "twitter":
        return {
          title: "X / Twitter",
          subtitle: "Posts, Threads & Bookmarks",
          description: "Import X/Twitter posts, threads, and media previews cleanly with author and verification status.",
          badge: "URLs & Lists",
          gradient: "from-zinc-900 to-zinc-700 shadow-zinc-800/30",
          selectedBorder: "border-zinc-500 bg-zinc-500/5 dark:bg-zinc-500/10 ring-zinc-500/30",
        };
      case "linkedin":
        return {
          title: "LinkedIn",
          subtitle: "Pulse Articles & Posts",
          description: "Import professional updates and LinkedIn Pulse articles with authoritative title extraction.",
          badge: "URLs & Lists",
          gradient: "from-blue-600 to-cyan-600 shadow-blue-500/30",
          selectedBorder: "border-blue-500 bg-blue-500/5 dark:bg-blue-500/10 ring-blue-500/30",
        };
      default:
        return {
          title: "Multi-Platform & Web",
          subtitle: "Bookmarks, CSV, Mixed URL Lists",
          description: "Import any mixed batch from browser bookmarks (HTML), CSV spreadsheets, or text lists across the web.",
          badge: "Universal Batch",
          gradient: "from-indigo-600 to-violet-600 shadow-indigo-500/30",
          selectedBorder: "border-indigo-500 bg-indigo-500/5 dark:bg-indigo-500/10 ring-indigo-500/30",
        };
    }
  };

  const details = getPlatformDetails(platform);

  return (
    <button
      type="button"
      onClick={() => onSelect(platform)}
      className={cn(
        "relative flex flex-col text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer overflow-hidden group",
        isSelected
          ? cn("shadow-lg ring-1", details.selectedBorder)
          : "border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-md"
      )}
    >
      {isSelected && (
        <div className="absolute top-4 right-4 text-emerald-500 bg-emerald-500/10 p-1 rounded-full">
          <CheckCircle2 className="w-5 h-5 fill-current" />
        </div>
      )}

      {/* Platform Header */}
      <div className="flex items-center gap-3.5 mb-3">
        <div
          className={cn(
            "w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md transition-transform group-hover:scale-105 bg-gradient-to-tr",
            details.gradient
          )}
        >
          {platform === "youtube" ? (
            <YoutubeIcon className="w-6 h-6" />
          ) : platform === "instagram" ? (
            <InstagramIcon className="w-6 h-6" />
          ) : platform === "website" ? (
            <Layers className="w-6 h-6" />
          ) : (
            <PlatformBadge platform={platform} showIconOnly={true} />
          )}
        </div>
        <div>
          <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
            {details.title}
          </h3>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {details.subtitle}
          </span>
        </div>
      </div>

      {/* Description */}
      <p className="text-xs text-zinc-600 dark:text-zinc-300 leading-relaxed mb-4">
        {details.description}
      </p>

      {/* Capabilities summary pill */}
      <div className="mt-auto pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-zinc-500 dark:text-zinc-400">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          Safe import
        </span>
        <span className="font-semibold px-2 py-0.5 rounded-full text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
          {details.badge}
        </span>
      </div>
    </button>
  );
};
