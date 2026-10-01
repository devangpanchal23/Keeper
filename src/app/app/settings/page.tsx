"use client";

import React, { useState } from "react";
import { useRecall } from "@/context/RecallContext";
import { StorageService } from "@/services/storage-service";
import {
  Settings,
  Sun,
  Moon,
  Monitor,
  Sparkles,
  Database,
  RotateCcw,
  Download,
  Check,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

export default function SettingsPage() {
  const {
    user,
    theme,
    setTheme,
    resetDemoData,
    items,
    collections,
    reprocessAllItems,
    addToast,
  } = useRecall();

  const [summaryMode, setSummaryMode] = useState<"quick" | "standard" | "detailed">(
    user?.settings?.defaultSummaryMode || "standard"
  );
  const [aiModel, setAiModel] = useState<string>(
    user?.settings?.aiModel || "Recall Intelligence v2.5 (Fast)"
  );
  const [autoTagging, setAutoTagging] = useState<boolean>(
    user?.settings?.autoTagging ?? true
  );

  const [savedSuccess, setSavedSuccess] = useState(false);

  if (!user) return null;

  const handleSaveSettings = () => {
    const updatedUser = {
      ...user,
      settings: {
        ...user.settings,
        defaultSummaryMode: summaryMode,
        aiModel,
        autoTagging,
      },
    };
    StorageService.saveUser(updatedUser);
    setSavedSuccess(true);
    addToast("Settings saved", "Your workspace preferences were updated.", "success");
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  const handleExportBackup = () => {
    const data = StorageService.exportBackup();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `recall-backup-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    addToast("Backup exported", "Downloaded JSON backup file.", "info");
  };

  const handleResetData = () => {
    if (confirm("Reset prototype to default demo data with 30+ seed items?")) {
      resetDemoData();
    }
  };

  const [isReprocessingAll, setIsReprocessingAll] = useState(false);

  const handleReprocessAll = async () => {
    if (!confirm("Reprocess all saved bookmarks? This will re-fetch verified source metadata, remove ungrounded AI summaries, and regenerate strictly grounded takeaways for all items in your library.")) {
      return;
    }
    setIsReprocessingAll(true);
    try {
      await reprocessAllItems();
    } catch (err) {
      console.error(err);
    } finally {
      setIsReprocessingAll(false);
    }
  };

  const fullContentCount = items.filter((i) => i.contentStatus === "FULL_CONTENT").length;
  const partialContentCount = items.filter((i) => i.contentStatus === "PARTIAL_CONTENT").length;
  const metadataOnlyCount = items.filter((i) => i.contentStatus === "METADATA_ONLY").length;
  const limitedCount = items.filter((i) => i.isLimited).length;

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <Settings className="w-4 h-4" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100">
            Workspace Settings
          </h1>
        </div>
        <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mt-1">
          Manage your AI preferences, theme appearance, and prototype storage.
        </p>
      </div>

      {/* User Profile Card */}
      <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Profile &amp; Subscription
          </h2>
          <Link
            href="/app/profile"
            className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Edit Profile &amp; Password →
          </Link>
        </div>

        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.avatar}
            alt={user.name}
            className="w-16 h-16 rounded-2xl object-cover border-2 border-indigo-500 shadow-md"
          />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {user.name}
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                {user.tier} Plan
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
            <p className="text-[11px] text-zinc-400 mt-0.5">
              Member since {formatDate(user.joinedDate)}
            </p>
          </div>
        </div>
      </div>

      {/* Appearance Section */}
      <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-4">
        <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
          Appearance &amp; Theme
        </h2>

        <div className="grid grid-cols-3 gap-3 max-w-md">
          <button
            onClick={() => setTheme("light")}
            className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
              theme === "light"
                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <Sun className="w-5 h-5 text-amber-500" />
            <span className="text-xs">Light</span>
          </button>

          <button
            onClick={() => setTheme("dark")}
            className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
              theme === "dark"
                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <Moon className="w-5 h-5 text-indigo-500" />
            <span className="text-xs">Dark</span>
          </button>

          <button
            onClick={() => setTheme("system")}
            className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center gap-2 ${
              theme === "system"
                ? "border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 font-semibold"
                : "border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
            }`}
          >
            <Monitor className="w-5 h-5 text-zinc-400" />
            <span className="text-xs">System</span>
          </button>
        </div>
      </div>

      {/* AI Processing Preferences */}
      <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-500" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            AI Engine Configuration
          </h2>
        </div>

        {/* Default Summary Mode */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            Default Summary Depth
          </label>
          <p className="text-xs text-zinc-400">
            Choose the default level of detail presented when inspecting bookmark cards.
          </p>
          <div className="flex gap-2 max-w-md pt-1">
            {(["quick", "standard", "detailed"] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSummaryMode(mode)}
                className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold capitalize transition-all ${
                  summaryMode === mode
                    ? "border-indigo-600 bg-indigo-600 text-white shadow-2xs"
                    : "border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* AI Model Selection */}
        <div className="space-y-1.5 pt-2">
          <label className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
            Simulated AI Provider Model
          </label>
          <p className="text-xs text-zinc-400">
            Select the underlying intelligence tier for link summarization and semantic answers.
          </p>
          <select
            value={aiModel}
            onChange={(e) => setAiModel(e.target.value)}
            className="w-full max-w-md px-3.5 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="Recall Intelligence v2.5 (Fast)">
              Recall Intelligence v2.5 (Fast &amp; Accurate)
            </option>
            <option value="Recall Pro Synthesizer">
              Recall Pro Synthesizer (Deep Multi-Agent Takeaways)
            </option>
            <option value="Claude 3.5 Sonnet (Simulated)">
              Claude 3.5 Sonnet (High Nuance Extraction)
            </option>
            <option value="GPT-4o (Simulated)">
              GPT-4o (Multi-Modal Vision &amp; Web)
            </option>
          </select>
        </div>

        {/* Auto Tagging Toggle */}
        <div className="flex items-center justify-between pt-2 max-w-md">
          <div>
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Automatic AI Tagging
            </div>
            <div className="text-xs text-zinc-400">
              Automatically extract topic and format tags upon saving
            </div>
          </div>
          <input
            type="checkbox"
            checked={autoTagging}
            onChange={(e) => setAutoTagging(e.target.checked)}
            className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
          />
        </div>

        <div className="pt-3">
          <button
            onClick={handleSaveSettings}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-105"
          >
            {savedSuccess ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Preferences Saved!
              </>
            ) : (
              "Save Preferences"
            )}
          </button>
        </div>
      </div>

      {/* Prototype Storage & Data Management */}
      <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-emerald-500" />
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
            Prototype Local Storage &amp; Seed Data
          </h2>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          This is a client-side prototype. All changes survive page refreshes inside browser <code className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 font-mono text-[11px]">localStorage</code>.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 max-w-md text-xs">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-zinc-400 block text-[11px]">Items</span>
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{items.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-zinc-400 block text-[11px]">Collections</span>
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{collections.length}</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-100 dark:border-zinc-800">
            <span className="text-zinc-400 block text-[11px]">Storage</span>
            <span className="font-bold text-sm text-emerald-500">Synced</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          <button
            onClick={handleExportBackup}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Export JSON Backup
          </button>

          <button
            onClick={handleResetData}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reset to 30+ Seed Items
          </button>
        </div>
      </div>

      {/* Content Intelligence Engine & Developer Utilities */}
      <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Content Intelligence &amp; Data Verification
            </h2>
          </div>
          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
            Developer Utility
          </span>
        </div>

        <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">
          Recall strictly isolates real provider metadata from AI-generated analysis. If older bookmarks contain ungrounded summaries or outdated platform details, you can trigger a full library re-audit.
        </p>

        {/* Content Integrity Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-500/20">
            <span className="text-emerald-700 dark:text-emerald-300 block text-[11px] font-medium">Full Content</span>
            <span className="font-bold text-sm text-emerald-900 dark:text-emerald-100">{fullContentCount} items</span>
          </div>
          <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-500/20">
            <span className="text-blue-700 dark:text-blue-300 block text-[11px] font-medium">Partial Content</span>
            <span className="font-bold text-sm text-blue-900 dark:text-blue-100">{partialContentCount} items</span>
          </div>
          <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-500/20">
            <span className="text-amber-700 dark:text-amber-300 block text-[11px] font-medium">Metadata Only</span>
            <span className="font-bold text-sm text-amber-900 dark:text-amber-100">{metadataOnlyCount} items</span>
          </div>
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700">
            <span className="text-zinc-500 dark:text-zinc-400 block text-[11px] font-medium">Limited / Protected</span>
            <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">{limitedCount} items</span>
          </div>
        </div>

        <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              Reprocess All Bookmarks
            </div>
            <div className="text-xs text-zinc-400">
              Re-extract source metadata and regenerate grounded AI takeaways for all {items.length} items.
            </div>
          </div>
          <button
            onClick={handleReprocessAll}
            disabled={isReprocessingAll}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-105 disabled:opacity-50 shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReprocessingAll ? "animate-spin" : ""}`} />
            {isReprocessingAll ? "Reprocessing..." : "Reprocess All"}
          </button>
        </div>
      </div>
    </div>
  );
}
