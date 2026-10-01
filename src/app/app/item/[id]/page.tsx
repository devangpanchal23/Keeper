"use client";

import React, { use, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRecall } from "@/context/RecallContext";
import { AIService } from "@/services/ai-service";
import { PlatformBadge } from "@/components/common/PlatformBadge";
import { ContentTypeBadge } from "@/components/common/ContentTypeBadge";
import { SaveItemCard } from "@/components/cards/SaveItemCard";
import { EmptyState } from "@/components/common/EmptyState";
import { formatFullDate, formatDate } from "@/lib/utils";
import {
  ArrowLeft,
  ExternalLink,
  Star,
  Folder,
  Tag,
  StickyNote,
  Archive,
  ArchiveRestore,
  Trash2,
  Sparkles,
  CheckCircle2,
  Clock,
  Calendar,
  Eye,
  ThumbsUp,
  MessageSquare,
  Globe,
  Share2,
  Check,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

export default function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const router = useRouter();
  const {
    items,
    collections,
    updateItem,
    reprocessItem,
    toggleFavorite,
    archiveItem,
    unarchiveItem,
    trashItem,
    restoreItem,
    permanentDeleteItem,
    addToast,
    recordView,
  } = useRecall();

  const item = items.find((i) => i.id === resolvedParams.id);

  // Local state for reprocessing
  const [isReprocessing, setIsReprocessing] = useState(false);

  // Local state for summary mode: quick | standard | detailed
  const [summaryMode, setSummaryMode] = useState<"quick" | "standard" | "detailed">("standard");

  // Local state for personal notes auto-saving
  const [notes, setNotes] = useState("");
  const [noteSaved, setNoteSaved] = useState(false);

  // Tag editing state
  const [tagInput, setTagInput] = useState("");

  useEffect(() => {
    if (item) {
      setNotes(item.personalNotes || "");
      recordView(item.id);
    }
  }, [item?.id]);

  if (!item) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <Link
          href="/app/library"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-6"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Library
        </Link>
        <EmptyState
          title="Bookmark Not Found"
          description="This item might have been deleted or does not exist."
          actionLabel="Go to Library"
          onAction={() => router.push("/app/library")}
        />
      </div>
    );
  }

  const currentCollection = collections.find((c) => c.id === item.collectionId);

  // Related items
  const relatedItems = AIService.getRelatedItems(item, items, 3);

  // Save notes
  const handleSaveNotes = () => {
    updateItem(item.id, { personalNotes: notes });
    setNoteSaved(true);
    setTimeout(() => setNoteSaved(false), 2000);
  };

  // Add / remove tags
  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, "");
      if (clean && !item.tags.includes(clean)) {
        updateItem(item.id, { tags: [...item.tags, clean] });
        setTagInput("");
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    updateItem(item.id, { tags: item.tags.filter((t) => t !== tagToRemove) });
  };

  const handleCollectionChange = (newColId: string) => {
    updateItem(item.id, {
      collectionId: newColId || undefined,
      collections: newColId ? [newColId] : [],
    });
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast("Link copied", "Item link copied to clipboard.", "info");
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      await reprocessItem(item.id);
    } finally {
      setIsReprocessing(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={handleReprocess}
            disabled={isReprocessing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
            title="Refetch real source metadata and regenerate grounded AI analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isReprocessing ? "animate-spin text-indigo-500" : ""}`} />
            <span className="hidden sm:inline">{isReprocessing ? "Reprocessing..." : "Reprocess Content"}</span>
          </button>

          <button
            onClick={handleShare}
            className="p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
            title="Share Bookmark"
          >
            <Share2 className="w-4 h-4" />
          </button>

          <a
            href={item.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-105"
          >
            <span>Open Original</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Hero Media Preview */}
      <div className="relative w-full h-64 sm:h-80 md:h-96 rounded-3xl overflow-hidden bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 shadow-xl group">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.thumbnail}
          alt={item.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <PlatformBadge platform={item.platform} />
          <ContentTypeBadge type={item.contentType} />
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider backdrop-blur-md ${
            item.contentStatus === "FULL_CONTENT"
              ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
              : item.contentStatus === "PARTIAL_CONTENT"
              ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
              : item.contentStatus === "METADATA_ONLY"
              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
              : "bg-rose-500/20 text-rose-300 border border-rose-500/30"
          }`}>
            {item.contentStatus ? item.contentStatus.replace("_", " ") : "VERIFIED SOURCE"}
          </span>
        </div>

        {/* Top Right Actions */}
        <div className="absolute top-4 right-4 flex items-center gap-2">
          <button
            onClick={() => toggleFavorite(item.id)}
            className={`p-2.5 rounded-full backdrop-blur-md transition-transform ${
              item.favorite
                ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105"
                : "bg-black/50 text-white hover:bg-black/70"
            }`}
          >
            <Star className="w-4 h-4 fill-current" />
          </button>
        </div>

        {/* Bottom Banner Title Overlay */}
        <div className="absolute bottom-4 left-4 right-4 text-white space-y-2">
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            {item.creator.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.creator.avatar}
                alt={item.creator.name}
                className="w-5 h-5 rounded-full object-cover"
              />
            )}
            <span className="font-semibold">{item.creator.name}</span>
            {item.creator.handle && (
              <span className="text-zinc-400 font-mono text-[11px]">
                {item.creator.handle}
              </span>
            )}
            <span>•</span>
            <span className="text-zinc-400">{formatDate(item.savedDate)}</span>
          </div>

          <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-snug drop-shadow-md">
            {item.title}
          </h1>
        </div>
      </div>

      {/* Limited Content Warning Banner */}
      {item.isLimited && (
        <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200 flex items-start gap-3 text-xs sm:text-sm leading-relaxed">
          <AlertCircle className="w-5 h-5 shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1">
            <span className="font-semibold text-amber-950 dark:text-amber-100 block">
              Limited content available
            </span>
            <p className="text-xs text-amber-800 dark:text-amber-300">
              {item.limitedReason || "We saved this resource, but some source information couldn't be retrieved due to platform or authentication restrictions. AI summary is grounded only in verified metadata."}
            </p>
          </div>
        </div>
      )}

      {/* Main Grid: Left Details & Right Metadata Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: AI Summaries & Takeaways (2 spans) */}
        <div className="lg:col-span-2 space-y-6">
          {/* AI Summary Box */}
          <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  AI Summary
                </h2>
              </div>

              {/* Mode Switcher: Quick, Standard, Detailed */}
              <div className="flex items-center p-1 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-xs">
                {(["quick", "standard", "detailed"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSummaryMode(mode)}
                    className={`px-3 py-1 rounded-lg font-semibold capitalize transition-all ${
                      summaryMode === mode
                        ? "bg-white dark:bg-zinc-700 text-indigo-600 dark:text-indigo-300 shadow-2xs"
                        : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            {/* Render Summary Text */}
            <div className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300 whitespace-pre-line font-normal">
              {summaryMode === "quick" && item.aiSummary.quick}
              {summaryMode === "standard" && item.aiSummary.standard}
              {summaryMode === "detailed" && item.aiSummary.detailed}
            </div>

            {/* Key Takeaways */}
            {item.keyPoints && item.keyPoints.length > 0 && (
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2.5">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">
                  Key Takeaways
                </div>
                <ul className="space-y-2 text-xs sm:text-sm text-zinc-700 dark:text-zinc-300">
                  {item.keyPoints.map((kp, idx) => (
                    <li key={idx} className="flex items-start gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                      <span>{kp}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Personal Notes Section */}
          <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-sm">
                <StickyNote className="w-4 h-4 text-amber-500" />
                <h3>Personal Notes &amp; Thoughts</h3>
              </div>
              {noteSaved && (
                <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
            </div>

            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleSaveNotes}
              placeholder="Jot down notes, next steps, or why you saved this..."
              className="w-full p-3.5 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-sm text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
            />
            <div className="flex justify-end">
              <button
                onClick={handleSaveNotes}
                className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-2xs"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Metadata & Organization Panel (1 span) */}
        <div className="space-y-6">
          {/* Organization: Collection & Tags */}
          <div className="p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Organization
            </h3>

            {/* Collection Select */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1.5">
                <Folder className="w-3.5 h-3.5 text-indigo-500" />
                Collection
              </label>
              <select
                value={item.collectionId || ""}
                onChange={(e) => handleCollectionChange(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">(None - General Library)</option>
                {collections.map((col) => (
                  <option key={col.id} value={col.id}>
                    {col.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Tags list & add */}
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 mb-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-500" />
                Tags
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {item.tags.map((t) => (
                  <span
                    key={t}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                  >
                    #{t}
                    <button
                      onClick={() => handleRemoveTag(t)}
                      className="text-zinc-400 hover:text-rose-500"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type tag & press enter..."
                className="w-full px-3 py-1.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Topics */}
            {item.topics.length > 0 && (
              <div>
                <div className="text-[11px] font-medium text-zinc-400 mb-1">
                  AI Extracted Topics:
                </div>
                <div className="flex flex-wrap gap-1">
                  {item.topics.map((tp) => (
                    <span
                      key={tp}
                      className="text-[11px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                    >
                      {tp}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Raw Metadata Panel */}
          <div className="p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3 text-xs">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider">
              Source Metadata
            </h3>

            <div className="space-y-2 text-zinc-600 dark:text-zinc-400">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-zinc-400" /> Domain
                </span>
                <span className="font-mono text-zinc-900 dark:text-zinc-200">
                  {item.metadata.domain}
                </span>
              </div>

              {item.metadata.duration && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" /> Duration
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    {item.metadata.duration}
                  </span>
                </div>
              )}

              {item.metadata.publishedAt && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400" /> Published
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    {item.metadata.publishedAt}
                  </span>
                </div>
              )}

              {item.metadata.readTime && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-zinc-400" /> Read Time
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    {item.metadata.readTime}
                  </span>
                </div>
              )}

              {item.metadata.upvotes !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ThumbsUp className="w-3.5 h-3.5 text-zinc-400" /> Upvotes
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    {item.metadata.upvotes}
                  </span>
                </div>
              )}

              {item.metadata.comments !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-400" /> Comments
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    {item.metadata.comments}
                  </span>
                </div>
              )}

              {item.metadata.likes && (
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <ThumbsUp className="w-3.5 h-3.5 text-zinc-400" /> Likes / Stars
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200">
                    {item.metadata.likes}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-zinc-400" /> Views
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-200">
                  {item.viewCount || 1} times
                </span>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
                <span>Saved on</span>
                <span>{formatFullDate(item.savedDate)}</span>
              </div>
            </div>
          </div>

          {/* Data Provenance & Verification Card */}
          <div className="p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                <span>Data Provenance</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                item.contentStatus === "FULL_CONTENT"
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                  : item.contentStatus === "PARTIAL_CONTENT"
                  ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                  : item.contentStatus === "METADATA_ONLY"
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
              }`}>
                {item.contentStatus ? item.contentStatus.replace("_", " ") : "VERIFIED SOURCE"}
              </span>
            </div>

            <div className="space-y-2 pt-1">
              <div className="flex items-start justify-between gap-2 text-zinc-600 dark:text-zinc-400">
                <span className="text-[11px] text-zinc-400">Title Source</span>
                <span className="font-mono text-[11px] font-medium text-zinc-800 dark:text-zinc-200 text-right">
                  {item.provenance?.title?.source || `${item.platform}_metadata`}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 text-zinc-600 dark:text-zinc-400">
                <span className="text-[11px] text-zinc-400">Creator Source</span>
                <span className="font-mono text-[11px] font-medium text-zinc-800 dark:text-zinc-200 text-right">
                  {item.provenance?.creator?.source || `${item.platform}_author`}
                </span>
              </div>

              <div className="flex items-start justify-between gap-2 text-zinc-600 dark:text-zinc-400">
                <span className="text-[11px] text-zinc-400">AI Grounding</span>
                <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 text-right">
                  {item.provenance?.summary?.basedOn?.join(" + ") || (item.contentStatus === "METADATA_ONLY" ? "metadata" : "extracted content")}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800">
              <button
                onClick={handleReprocess}
                disabled={isReprocessing}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReprocessing ? "animate-spin text-indigo-500" : ""}`} />
                <span>{isReprocessing ? "Reprocessing..." : "Reprocess Content"}</span>
              </button>
            </div>
          </div>

          {/* Archive / Trash actions */}
          <div className="p-4 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 space-y-2">
            {item.archived ? (
              <button
                onClick={() => unarchiveItem(item.id)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <ArchiveRestore className="w-4 h-4 text-emerald-500" />
                Unarchive Bookmark
              </button>
            ) : (
              <button
                onClick={() => {
                  archiveItem(item.id);
                  router.push("/app/library");
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors"
              >
                <Archive className="w-4 h-4 text-zinc-400" />
                Archive Bookmark
              </button>
            )}

            <button
              onClick={() => {
                if (confirm("Move this item to Trash?")) {
                  trashItem(item.id);
                  router.push("/app/library");
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Delete to Trash
            </button>
          </div>
        </div>
      </div>

      {/* Related Saves Section */}
      {relatedItems.length > 0 && (
        <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-500" />
            <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              Related Knowledge in Your Library
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {relatedItems.map((rel) => (
              <SaveItemCard key={rel.id} item={rel} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
