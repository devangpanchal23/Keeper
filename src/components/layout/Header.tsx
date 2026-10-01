"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecall } from "@/context/RecallContext";
import {
  Search,
  Plus,
  Bell,
  Sun,
  Moon,
  Sparkles,
  Command,
  Settings,
  RotateCcw,
  Check,
  Menu,
  User as UserIcon,
} from "lucide-react";

interface HeaderProps {
  onMobileMenuToggle?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onMobileMenuToggle }) => {
  const {
    openAddContent,
    openCommandPalette,
    theme,
    setTheme,
    user,
    logout,
    resetDemoData,
    items,
  } = useRecall();

  const router = useRouter();
  const [profileOpen, setProfileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const unreadCount = items.filter((i) => !i.trashed && !i.archived && !i.lastViewedAt).length;

  const toggleTheme = () => {
    if (theme === "dark") setTheme("light");
    else setTheme("dark");
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 md:px-6 border-b border-zinc-200/80 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md transition-colors">
      {/* Left: Mobile hamburger & Global Search Trigger */}
      <div className="flex items-center gap-3 flex-1 max-w-md">
        {onMobileMenuToggle && (
          <button
            onClick={onMobileMenuToggle}
            className="md:hidden p-2 rounded-xl text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Toggle mobile menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={openCommandPalette}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-900/60 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-400 text-xs transition-all shadow-2xs group"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-zinc-400 group-hover:text-indigo-500 transition-colors" />
            <span className="text-zinc-500 dark:text-zinc-400">Search bookmarks, AI tags, topics...</span>
          </div>
          <kbd className="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
            <Command className="w-2.5 h-2.5" /> K
          </kbd>
        </button>
      </div>

      {/* Right: + Add Content, Notifications, Theme, Profile */}
      <div className="flex items-center gap-2 md:gap-3">
        {/* + Add Content Primary CTA */}
        <button
          onClick={() => openAddContent()}
          className="inline-flex items-center gap-2 px-3.5 md:px-4 py-2 rounded-xl text-xs md:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 transition-all hover:scale-[1.02] active:scale-98"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Content</span>
          <span className="sm:hidden">Add</span>
        </button>

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            title="Notifications"
          >
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-indigo-500 ring-2 ring-white dark:ring-zinc-950 animate-pulse" />
            )}
          </button>

          {notificationsOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setNotificationsOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-4 z-40 animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    Notifications &amp; AI Updates
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400 font-medium">
                    {unreadCount} unread
                  </span>
                </div>

                <div className="space-y-3 py-3">
                  <div className="flex items-start gap-2.5 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        AI Library Weekly Digest is Ready
                      </p>
                      <p className="text-zinc-500 text-[11px] mt-0.5">
                        Your library is top-weighted in React Performance and Multi-Agent AI systems.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2.5 text-xs">
                    <div className="w-6 h-6 rounded-lg bg-emerald-50 dark:bg-emerald-950 text-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                      <Check className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">
                        33 Seed Bookmarks Synced
                      </p>
                      <p className="text-zinc-500 text-[11px] mt-0.5">
                        All platform mock providers are active with full summaries.
                      </p>
                    </div>
                  </div>
                </div>

                <Link
                  href="/app/ai-assistant"
                  onClick={() => setNotificationsOpen(false)}
                  className="block w-full py-2 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 rounded-xl transition-colors"
                >
                  Ask AI Library Assistant →
                </Link>
              </div>
            </>
          )}
        </div>

        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-xl text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-indigo-600" />
          )}
        </button>

        {/* Profile Avatar & Menu */}
        <div className="relative">
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center gap-2 p-1 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={user?.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(user?.name || "User")}`}
              alt={user?.name || "User profile"}
              className="w-8 h-8 rounded-full object-cover border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800"
            />
          </button>

          {profileOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setProfileOpen(false)}
              />
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl p-2 z-40 text-xs text-zinc-700 dark:text-zinc-300 animate-in fade-in zoom-in-95 duration-150">
                <div className="p-3 border-b border-zinc-100 dark:border-zinc-800">
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-sm">
                    {user?.name || "My Account"}
                  </div>
                  <div className="text-zinc-400 text-[11px] truncate">{user?.email || "No email"}</div>
                  <span className="inline-block mt-1.5 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500">
                    {user?.tier || "Free"} Workspace
                  </span>
                </div>

                <div className="py-1 space-y-0.5">
                  <Link
                    href="/app/profile"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors font-medium text-zinc-900 dark:text-zinc-100"
                  >
                    <UserIcon className="w-3.5 h-3.5 text-indigo-500" />
                    Profile &amp; Account
                  </Link>
                  <Link
                    href="/app/settings"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Settings className="w-3.5 h-3.5 text-zinc-400" />
                    Settings &amp; Preferences
                  </Link>
                  <Link
                    href="/app/ai-assistant"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    AI Assistant
                  </Link>
                  <button
                    onClick={() => {
                      resetDemoData();
                      setProfileOpen(false);
                    }}
                    className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-amber-600 dark:text-amber-400 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Reset Demo Data (30+ items)
                  </button>
                </div>

                <div className="pt-1 border-t border-zinc-100 dark:border-zinc-800">
                  <button
                    onClick={async () => {
                      setProfileOpen(false);
                      await logout();
                      router.push("/sign-in");
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors font-medium"
                  >
                    Log Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
