"use client";

import React, { useState } from "react";
import { ImportMethod, Platform } from "@/types";
import {
  UploadCloud,
  FileText,
  KeyRound,
  AlertCircle,
  HelpCircle,
  ExternalLink,
  CheckCircle2,
  Info,
  Layers,
  Bookmark,
  FileCode,
  Archive,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportSourceSelectorProps {
  platform: Platform;
  selectedMethod: ImportMethod;
  onSelectMethod: (method: ImportMethod) => void;
  onFileLoaded: (content: string, filename: string) => void;
  onArchiveLoaded?: (buffer: ArrayBuffer, filename: string) => void;
  onMultipleFilesLoaded?: (files: Array<{ content: string; filename: string }>) => void;
  onUrlsSubmitted: (urls: string) => void;
  isConnectingOAuth: boolean;
  onConnectOAuth: () => void;
  isConnectedOAuth: boolean;
  oauthAccountName?: string;
  onOpenExportGuide?: () => void;
}

export const ImportSourceSelector: React.FC<ImportSourceSelectorProps> = ({
  platform,
  selectedMethod,
  onSelectMethod,
  onFileLoaded,
  onArchiveLoaded,
  onMultipleFilesLoaded,
  onUrlsSubmitted,
  isConnectingOAuth,
  onConnectOAuth,
  isConnectedOAuth,
  oauthAccountName,
  onOpenExportGuide,
}) => {
  const [rawText, setRawText] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [isReadingFiles, setIsReadingFiles] = useState(false);

  const isInstagram = platform === "instagram";

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processSelectedFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processSelectedFiles(Array.from(e.target.files));
    }
  };

  const processSelectedFiles = async (files: File[]) => {
    if (files.length === 0) return;
    setIsReadingFiles(true);

    try {
      // 1. If single ZIP file provided
      const first = files[0];
      if (first.name.toLowerCase().endsWith(".zip")) {
        const buffer = await first.arrayBuffer();
        if (onArchiveLoaded) {
          onArchiveLoaded(buffer, first.name);
          return;
        }
      }

      // 2. If multiple JSON or text files provided together
      if (files.length > 1) {
        const readPromises = files.map((file) => {
          return new Promise<{ content: string; filename: string }>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) =>
              resolve({
                content: (e.target?.result as string) || "",
                filename: file.name,
              });
            reader.onerror = reject;
            reader.readAsText(file);
          });
        });

        const loadedFiles = await Promise.all(readPromises);
        if (onMultipleFilesLoaded) {
          onMultipleFilesLoaded(loadedFiles);
        } else {
          onFileLoaded(loadedFiles[0].content, loadedFiles[0].filename);
        }
        return;
      }

      // 3. Single standard text/json file
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          onFileLoaded(text, first.name);
        }
      };
      reader.readAsText(first);
    } catch (err) {
      console.error("Failed to read uploaded files", err);
    } finally {
      setIsReadingFiles(false);
    }
  };

  const getPlatformNotice = () => {
    switch (platform) {
      case "youtube":
        return {
          title: "Official Google / YouTube API Capabilities & Restrictions",
          message:
            "Google permits OAuth access to your Created Playlists and Liked Videos. Note: Google officially deprecated programmatic API access to the Watch Later playlist (WL) in YouTube Data API v3. For complete Watch Later imports, use the safe Google Takeout file import below.",
        };
      case "instagram":
        return {
          title: "Official Meta / Instagram API Policy Notice (Updated Post-2024)",
          message:
            "Instagram does not provide third-party API access to Saved Posts or Saved Collections. Use your official Instagram data export instead.",
        };
      case "reddit":
        return {
          title: "Official Reddit Data Export & Link Architecture",
          message:
            "Reddit exports contain saved_posts.csv or user JSON files with post permalinks. Keeper securely extracts authoritative submissions, flairs, author identity, and media discussions without asking for account passwords.",
        };
      case "x":
      case "twitter":
        return {
          title: "X / Twitter Platform Security Architecture",
          message:
            "X Developer API tiers restrict personal bookmark syncing to authenticated user-context tokens. Paste your saved tweet URLs, export text file, or browser bookmark export below to import posts and threads safely.",
        };
      case "linkedin":
        return {
          title: "LinkedIn API Privacy Architecture",
          message:
            "LinkedIn requires enterprise partner permissions to access private member feeds. Paste your post or Pulse article URLs below to import and categorize articles with factual metadata.",
        };
      default:
        return {
          title: "Universal Multi-Platform Import",
          message:
            "Supports Browser Bookmarks HTML files (Chrome, Safari, Firefox, Edge), CSV spreadsheets with links, or any multiline list of URLs across YouTube, Instagram, Reddit, X, LinkedIn, and the open web.",
        };
    }
  };

  const notice = getPlatformNotice();

  return (
    <div className="space-y-6">
      {/* Official Platform Restriction & Security Transparency Banner */}
      <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-500/5 dark:bg-amber-500/10 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              {notice.title}
            </p>
            <p className="text-amber-800 dark:text-amber-300/90 leading-relaxed">
              {notice.message}
            </p>
          </div>
        </div>

        {isInstagram && onOpenExportGuide && (
          <button
            type="button"
            onClick={onOpenExportGuide}
            className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center gap-1 cursor-pointer"
          >
            <span>How to get your export</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Method Selection Tabs */}
      <div
        className={cn(
          "grid gap-3",
          isInstagram ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1 md:grid-cols-3"
        )}
      >
        {/* Method 1: Data Export File Upload */}
        <button
          type="button"
          onClick={() => onSelectMethod("file_export")}
          className={cn(
            "flex flex-col p-4 rounded-xl border-2 text-left transition-all cursor-pointer",
            selectedMethod === "file_export"
              ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600/30"
              : "border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 hover:border-zinc-300 dark:hover:border-zinc-700"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <UploadCloud className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              {isInstagram ? "Official Export (.zip / .json)" : "Files & Bookmarks"}
            </span>
          </div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {isInstagram ? "Import Instagram Export" : "Export File or Bookmarks"}
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {isInstagram
              ? "Upload official Meta Accounts Center JSON files or ZIP archive"
              : "Upload HTML Bookmarks, CSV (Takeout/Watch Later), or JSON exports"}
          </p>
        </button>

        {/* Method 2: OAuth Connect (Only shown for platforms with official OAuth saved access) */}
        {!isInstagram && (
          <button
            type="button"
            onClick={() => onSelectMethod("oauth")}
            className={cn(
              "flex flex-col p-4 rounded-xl border-2 text-left transition-all cursor-pointer",
              selectedMethod === "oauth"
                ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600/30"
                : "border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 hover:border-zinc-300 dark:hover:border-zinc-700"
            )}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              {isConnectedOAuth && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Connected
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
              Account Sync (OAuth)
            </h4>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              Direct official sync for supported account playlists & saves
            </p>
          </button>
        )}

        {/* Method 3: Paste URLs */}
        <button
          type="button"
          onClick={() => onSelectMethod("url_list")}
          className={cn(
            "flex flex-col p-4 rounded-xl border-2 text-left transition-all cursor-pointer",
            selectedMethod === "url_list"
              ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 ring-1 ring-indigo-600/30"
              : "border-zinc-200 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/70 hover:border-zinc-300 dark:hover:border-zinc-700"
          )}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500">
              Bulk URLs
            </span>
          </div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
            {isInstagram ? "Paste Instagram URLs" : "Paste URL List"}
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Paste multiple links separated by newlines, commas, or spaces
          </p>
        </button>
      </div>

      {/* Method Input Body: File Upload */}
      {selectedMethod === "file_export" && (
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          className={cn(
            "border-2 border-dashed rounded-2xl p-8 text-center transition-all bg-white/50 dark:bg-zinc-900/50",
            dragActive
              ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700"
          )}
        >
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
            {isInstagram ? <Archive className="w-6 h-6" /> : <UploadCloud className="w-6 h-6" />}
          </div>
          <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100 mb-1">
            {isInstagram
              ? "Drag & drop your Instagram export (.zip or .json)"
              : "Drag & drop your export or bookmark file"}
          </h4>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4 max-w-md mx-auto">
            {isInstagram
              ? "Select your downloaded Meta export archive (ZIP) or individual JSON files (e.g. saved_collections.json, saved_posts.json). You can select multiple files at once."
              : "Supports YouTube CSV (Takeout Watch Later), playlist CSV exports, or text URL lists."}
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-500 cursor-pointer shadow-md transition-all">
              <span>{isReadingFiles ? "Reading Files..." : "Browse Files"}</span>
              <input
                type="file"
                multiple
                accept={
                  isInstagram
                    ? ".json,.zip,application/json,application/zip"
                    : ".html,.htm,.json,.csv,.txt"
                }
                onChange={handleFileInput}
                disabled={isReadingFiles}
                className="hidden"
              />
            </label>

            {isInstagram && onOpenExportGuide && (
              <button
                type="button"
                onClick={onOpenExportGuide}
                className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs font-semibold transition-all cursor-pointer"
              >
                How to get your export →
              </button>
            )}
          </div>
        </div>
      )}

      {/* Method Input Body: OAuth Connect (Only when selected and not Instagram) */}
      {selectedMethod === "oauth" && !isInstagram && (
        <div className="p-6 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-600 dark:text-red-400 flex items-center justify-center">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  Connect YouTube Account Securely
                </h4>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  OAuth 2.0 authorization with read-only scopes. Sync your YouTube playlists &amp; liked videos.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onConnectOAuth}
              disabled={isConnectingOAuth}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              {isConnectingOAuth ? "Connecting..." : isConnectedOAuth ? "Re-sync Account" : "Connect Account"}
            </button>
          </div>
        </div>
      )}

      {/* Method Input Body: Paste URLs */}
      {selectedMethod === "url_list" && (
        <div className="space-y-4">
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder={
              isInstagram
                ? "Paste multiple Instagram URLs here (one per line, space, or comma separated)...&#10;https://www.instagram.com/p/C3x90ZaLkPq/&#10;https://www.instagram.com/reel/DFxyz123/"
                : "Paste multiple YouTube URLs here (one per line, space, or comma separated)...&#10;https://www.youtube.com/watch?v=3lZF8W_AaUo&#10;https://www.youtube.com/shorts/5e_0B_5b6U0"
            }
            rows={8}
            className="w-full p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />

          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              Duplicates within the batch and links already in your Keeper library will be identified.
            </span>
            <button
              type="button"
              onClick={() => onUrlsSubmitted(rawText)}
              disabled={!rawText.trim()}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition-all cursor-pointer"
            >
              Analyze URLs
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
