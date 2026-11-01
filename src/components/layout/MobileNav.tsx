"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRecall } from "@/context/RecallContext";
import { Home, Bookmark, Sparkles, Folder, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export const MobileNav: React.FC = () => {
  const pathname = usePathname();
  const { openAddContent } = useRecall();

  const links = [
    { label: "Home", href: "/app", icon: <Home className="w-5 h-5" /> },
    { label: "Library", href: "/app/library", icon: <Bookmark className="w-5 h-5" /> },
    { label: "AI Search", href: "/app/ai-assistant", icon: <Sparkles className="w-5 h-5" /> },
    { label: "Collections", href: "/app/collections", icon: <Folder className="w-5 h-5" /> },
  ];

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-[calc(4rem+env(safe-area-inset-bottom,0px))] pb-[env(safe-area-inset-bottom,0px)] border-t border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-lg px-4 flex items-center justify-around touch-manipulation select-none">
      {links.slice(0, 2).map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center min-w-[48px] min-h-[44px] gap-1 text-[11px] font-medium transition-colors touch-manipulation",
              isActive
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}

      {/* Floating Center + Add button */}
      <button
        onClick={() => openAddContent()}
        className="-mt-5 w-12 h-12 min-w-[48px] min-h-[48px] rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-600/40 active:scale-95 transition-transform touch-manipulation cursor-pointer"
        aria-label="Add Content"
      >
        <Plus className="w-6 h-6" />
      </button>

      {links.slice(2).map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-col items-center justify-center min-w-[48px] min-h-[44px] gap-1 text-[11px] font-medium transition-colors touch-manipulation",
              isActive
                ? "text-indigo-600 dark:text-indigo-400"
                : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </Link>
        );
      })}
    </div>
  );
};
