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
import { AIProcessingState, SavedItem } from "@/types";
import {
  INSTAGRAM_REEL_PLACEHOLDER,
  INSTAGRAM_POST_PLACEHOLDER,
} from "@/services/media/instagram-placeholders";
import { CONTENT_PREVIEW_PLACEHOLDER } from "@/services/media/content-placeholder";
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
  User,
  Layers,
  Volume2,
  FileText,
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
    createCollection,
    refreshWorkspaceCollections,
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

  useEffect(() => {
    const itemId = item?.id;
    const serverMediaId = item?.metadata?.serverMediaId;
    const status = item?.metadata?.aiProcessingStatus;
    const terminalFailure = ["FAILED", "EXTRACTION_FAILED", "TRANSCRIPTION_FAILED", "ANALYSIS_FAILED", "ORGANIZATION_FAILED", "INDEXING_FAILED"].includes(String(status));
    if (!itemId || typeof serverMediaId !== "string" || (!terminalFailure && !["QUEUED", "PENDING", "EXTRACTING", "TRANSCRIBING", "ANALYZING", "GENERATING_TAGS", "MATCHING_COLLECTION", "ORGANIZING", "INDEXING"].includes(String(status)))) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/media/${encodeURIComponent(serverMediaId)}/reprocess`, { cache: "no-store" });
        if (!response.ok) return;
        const result = await response.json() as { data?: SavedItem; processingStatus?: string; processingError?: string | null };
        if (!result.data || stopped) return;
        const processingStatus = (result.processingStatus || status) as AIProcessingState;
        const updated = {
          ...result.data,
          metadata: { ...result.data.metadata, aiProcessingStatus: processingStatus, aiProcessingError: result.processingError || undefined },
        };
        updateItem(itemId, updated);
        if (processingStatus === "COMPLETED") void refreshWorkspaceCollections();
        if (!["COMPLETED", "FAILED", "EXTRACTION_FAILED", "TRANSCRIPTION_FAILED", "ANALYSIS_FAILED", "ORGANIZATION_FAILED", "INDEXING_FAILED"].includes(processingStatus || "")) timer = setTimeout(refresh, 5000);
      } catch {
        if (!stopped) timer = setTimeout(refresh, 8000);
      }
    };
    timer = setTimeout(refresh, terminalFailure ? 0 : 2500);
    return () => { stopped = true; clearTimeout(timer); };
  }, [item?.id, item?.metadata?.serverMediaId, item?.metadata?.aiProcessingStatus]);

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
  const contentRepresentation = item.metadata?.contentRepresentation;
  const assetClassification = item.metadata?.assetClassification;
  const generatedContent = item.metadata?.generatedContent as { detailedDescription?: string | null; topics?: string[]; collectionReason?: string | null } | undefined;
  const processingStatus = String(item.metadata?.aiProcessingStatus || "COMPLETED");
  const failedProcessing = ["FAILED", "EXTRACTION_FAILED", "TRANSCRIPTION_FAILED", "ANALYSIS_FAILED", "ORGANIZATION_FAILED", "INDEXING_FAILED"].includes(processingStatus);
  const generatedTags = item.metadata?.aiGeneratedTags || [];
  const aiOrganization = item.metadata?.aiOrganization || {};
  const collectionMatches = Array.isArray(aiOrganization.collectionMatches)
    ? aiOrganization.collectionMatches as Array<{ collectionId: string; name: string; confidence: number; reasoning?: string }>
    : [];
  const suggestedNewCollection = aiOrganization.suggestedNewCollection as { name: string; confidence: number; reason?: string; collectionId?: string; created?: boolean } | undefined;

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
        const tags = [...item.tags, clean];
        const userTags = [...new Set([...(item.metadata?.userTags || []), clean])];
        const suppressedAiTags = item.metadata?.suppressedAiTags || [];
        updateItem(item.id, { tags, metadata: { ...item.metadata, userTags, suppressedAiTags } });
        void persistTagChanges(tags, userTags, suppressedAiTags);
        setTagInput("");
      }
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    const tags = item.tags.filter((tag) => tag !== tagToRemove);
    const userTags = (item.metadata?.userTags || []).filter((tag: string) => tag !== tagToRemove);
    const wasAiGenerated = generatedTags.some((tag) => tag.name === tagToRemove);
    const suppressedAiTags = wasAiGenerated
      ? [...new Set([...(item.metadata?.suppressedAiTags || []), tagToRemove])]
      : (item.metadata?.suppressedAiTags || []);
    updateItem(item.id, { tags, metadata: { ...item.metadata, userTags, suppressedAiTags } });
    void persistTagChanges(tags, userTags, suppressedAiTags);
  };

  const persistTagChanges = async (tags: string[], userTags: string[], suppressedAiTags: string[]) => {
    const serverMediaId = item.metadata?.serverMediaId;
    if (typeof serverMediaId !== "string") return;
    try {
      const response = await fetch(`/api/media/${encodeURIComponent(serverMediaId)}/tags`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tags, userTags, suppressedAiTags }),
      });
      if (!response.ok) addToast("Tags not synced", "Your edit is saved in this browser but could not be synced to the workspace.", "warning");
    } catch {
      addToast("Tags not synced", "Your edit is saved in this browser but could not be synced to the workspace.", "warning");
    }
  };

  const handleCollectionChange = async (newColId: string) => {
    updateItem(item.id, {
      collectionId: newColId || undefined,
      collections: newColId ? [newColId] : [],
    });
    const serverMediaId = item.metadata?.serverMediaId;
    if (typeof serverMediaId !== "string") return;
    try {
      const response = await fetch(`/api/media/${encodeURIComponent(serverMediaId)}/collection`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collectionId: newColId || null }),
      });
      if (!response.ok) addToast("Collection not synced", "The collection change is saved locally but could not be synced to the workspace.", "warning");
    } catch {
      addToast("Collection not synced", "The collection change is saved locally but could not be synced to the workspace.", "warning");
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    addToast("Link copied", "Item link copied to clipboard.", "info");
  };

  const handleReprocess = async () => {
    setIsReprocessing(true);
    try {
      const serverMediaId = item.metadata?.serverMediaId;
      if (typeof serverMediaId === "string") {
        const response = await fetch(`/api/media/${encodeURIComponent(serverMediaId)}/reprocess`, { method: "POST" });
        const result = await response.json() as { error?: string; data?: SavedItem };
        if (!response.ok || !result.data) throw new Error(result.error || "Could not queue content reprocessing.");
        updateItem(item.id, result.data);
        addToast("Reprocessing queued", "Keeper is refreshing source evidence, transcript, tags, and collection suggestions.", "info");
      } else {
        await reprocessItem(item.id);
      }
    } catch (error) {
      addToast("Reprocessing failed", error instanceof Error ? error.message : "Could not reprocess this item.", "warning");
    } finally {
      setIsReprocessing(false);
    }
  };

  const acceptNewCollectionSuggestion = async () => {
    if (!suggestedNewCollection) return;
    if (suggestedNewCollection.collectionId) {
      await handleCollectionChange(suggestedNewCollection.collectionId);
      await refreshWorkspaceCollections();
      return;
    }
    const collection = createCollection({
      name: suggestedNewCollection.name,
      description: suggestedNewCollection.reason || "A topic suggested from this workspace's saved content.",
      color: "#d9ad32", icon: "Folder", isSystem: false,
    });
    const sync = await fetch("/api/collections/sync", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(collection),
    });
    if (!sync.ok) {
      addToast("Collection created locally", "Workspace sync failed. Try saving the item again after checking your connection.", "warning");
      return;
    }
    await handleCollectionChange(collection.id);
  };

  // Canonical formatting & defensive identity presentation
  const getFormattedIdentity = () => {
    let formattedCreator = "";
    if (item.platform === "reddit") {
      if (item.creator.status === "deleted" || !item.creator.username) {
        formattedCreator = "Deleted user";
      } else {
        const cleanUsername = (item.creator.username || item.creator.name || "").replace(/^u\//i, "");
        formattedCreator = cleanUsername ? `u/${cleanUsername}` : "Deleted user";
      }
    } else if (item.platform === "instagram") {
      const cleanUsername = (item.creator.username || item.creator.handle || item.creator.name || "").replace(/^@/, "");
      formattedCreator = cleanUsername ? `@${cleanUsername}` : "";
    } else if (item.platform === "x" || item.platform === "twitter") {
      const name = item.creator.displayName || item.creator.name || "";
      const rawUser = (item.creator.username || item.creator.handle || "").replace(/^@/, "").trim();
      if (name && rawUser && name.toLowerCase() !== rawUser.toLowerCase()) {
        formattedCreator = `${name} (@${rawUser})`;
      } else if (rawUser) {
        formattedCreator = `@${rawUser}`;
      } else {
        formattedCreator = name;
      }
    } else {
      formattedCreator = item.creator.displayName || item.creator.name || "";
    }

    // Secondary identity (e.g. handle if distinct and not redundant)
    let secondaryIdentity = "";
    if (item.platform !== "reddit" && item.platform !== "x" && item.platform !== "twitter" && item.creator.handle) {
      const handleClean = item.creator.handle.replace(/^[@u]\//i, "").replace(/^@/, "");
      const nameClean = (item.creator.name || "").replace(/^[@u]\//i, "").replace(/^@/, "");
      if (handleClean.toLowerCase() !== nameClean.toLowerCase()) {
        secondaryIdentity = item.creator.handle;
      }
    }

    // Defensive deduplication: unique non-empty
    const rawParts = [formattedCreator, secondaryIdentity].filter(Boolean);
    const uniqueParts: string[] = [];
    for (const part of rawParts) {
      const norm = part.toLowerCase().replace(/^[u@]\//i, "").replace(/^[@r\/]/i, "");
      if (!uniqueParts.some((p) => p.toLowerCase().replace(/^[u@]\//i, "").replace(/^[@r\/]/i, "") === norm)) {
        uniqueParts.push(part);
      }
    }
    return uniqueParts;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-8">
      {/* Top Navigation */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="flex flex-wrap items-center gap-2">
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
          src={item.thumbnail || CONTENT_PREVIEW_PLACEHOLDER}
          alt={item.title}
          onError={(e) => {
            const target = e.currentTarget;
            if (!target.dataset.fallback) {
              target.dataset.fallback = "true";
              target.src =
                item.platform === "instagram"
                  ? (item.contentType === "reel" ? INSTAGRAM_REEL_PLACEHOLDER : INSTAGRAM_POST_PLACEHOLDER)
                  : CONTENT_PREVIEW_PLACEHOLDER;
            }
          }}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-102"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/20" />

        {/* Top Badges */}
        <div className="absolute top-4 left-4 right-16 flex flex-wrap items-center gap-1.5 sm:gap-2">
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-300">
            {item.creator.avatar && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.creator.avatar}
                alt={item.creator.name}
                className="w-5 h-5 rounded-full object-cover shrink-0"
              />
            )}
            {getFormattedIdentity().map((part, idx) => (
              <span key={idx} className={idx === 0 ? "font-semibold truncate max-w-[150px] sm:max-w-xs" : "text-zinc-400 font-mono text-[11px] truncate max-w-[120px]"}>
                {part}
              </span>
            ))}
            {item.community?.name && item.community.name !== "reddit" && (
              <>
                <span className="text-zinc-400">in</span>
                <span className="font-semibold text-orange-400 truncate max-w-[120px]">r/{item.community.name.replace(/^r\//i, "")}</span>
              </>
            )}
            <span>•</span>
            <span className="text-zinc-400">{formatDate(item.savedDate)}</span>
          </div>

          <h1 className="text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight leading-snug drop-shadow-md line-clamp-2 sm:line-clamp-3">
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

      {processingStatus !== "COMPLETED" && (
        <div role={failedProcessing ? "alert" : "status"} className={`rounded-2xl border px-4 py-3 text-sm ${failedProcessing ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/30 dark:text-rose-200" : "border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900/70 dark:bg-indigo-950/30 dark:text-indigo-200"}`}>
          <div className="font-semibold">{failedProcessing ? `Processing ${processingStatus.toLowerCase().replaceAll("_", " ")}` : `Keeper is ${processingStatus.toLowerCase().replaceAll("_", " ")}`}</div>
          {failedProcessing && item.metadata?.aiProcessingError && <p className="mt-1 text-xs">{item.metadata.aiProcessingError}</p>}
          {failedProcessing && <button type="button" onClick={() => void handleReprocess()} disabled={isReprocessing} className="mt-2 rounded-lg border border-rose-300 px-3 py-1.5 text-xs font-semibold hover:bg-rose-100 disabled:opacity-50 dark:border-rose-800 dark:hover:bg-rose-950/50">{isReprocessing ? "Retrying…" : "Retry processing"}</button>}
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
            {generatedContent?.detailedDescription && (
              <div className="pt-4 border-t border-zinc-100 dark:border-zinc-800 space-y-2">
                <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Generated content</div>
                <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">{generatedContent.detailedDescription}</p>
                {generatedContent.topics?.length ? <p className="text-xs text-zinc-500">Topics: {generatedContent.topics.join(" · ")}</p> : null}
              </div>
            )}
          </div>

          {assetClassification && (
            <section className="p-5 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-2" aria-label="Asset classification">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Asset classification</h3>
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${assetClassification.isAsset === true ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"}`}>
                  {assetClassification.isAsset === null ? "Not enough evidence" : assetClassification.isAsset ? `Useful ${assetClassification.assetType || "asset"}` : "No reusable asset detected"}
                </span>
              </div>
              {assetClassification.reason && <p className="text-sm text-zinc-600 dark:text-zinc-400">{assetClassification.reason}</p>}
              {assetClassification.assetScore !== null && <p className="text-[11px] text-zinc-500">Grounded rule score: {Math.round(assetClassification.assetScore * 100)}% · {assetClassification.method}</p>}
            </section>
          )}

          {/* Audio Transcript Section (Available when transcribed) */}
          {(item.metadata?.transcript || (typeof item.provenance?.transcript?.value === "string" && item.provenance.transcript.value)) && (
            <div className="p-6 rounded-3xl border border-indigo-200/80 dark:border-indigo-900/50 bg-indigo-50/20 dark:bg-indigo-950/10 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-indigo-950 dark:text-indigo-200 font-bold text-sm">
                <Volume2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <h3>Audio Transcript</h3>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                  {item.provenance?.transcript?.source || "Speech to Text"}
                </span>
              </div>
              <p className="text-xs sm:text-sm text-zinc-700 dark:text-zinc-300 leading-relaxed whitespace-pre-wrap font-sans bg-white dark:bg-zinc-900/60 p-4 rounded-2xl border border-zinc-200/80 dark:border-zinc-800/80">
                {item.metadata?.transcript || item.provenance?.transcript?.value}
              </p>
            </div>
          )}

          {/* Source Caption Section */}
          {(item.metadata?.caption || (typeof item.provenance?.caption?.value === "string" && item.provenance.caption.value)) && (
            <div className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3">
              <div className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100 font-bold text-sm">
                <FileText className="w-4 h-4 text-zinc-500" />
                <h3>Post Caption</h3>
              </div>
              <p className="text-xs sm:text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed whitespace-pre-wrap bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800">
                {item.metadata?.caption || item.provenance?.caption?.value}
              </p>
            </div>
          )}

          {/* Normalized source representation used by the shared AI pipeline */}
          {contentRepresentation && (
            <section className="p-6 rounded-3xl border border-zinc-200/80 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 shadow-xs space-y-3" aria-labelledby="content-representation-heading">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id="content-representation-heading" className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                  {contentRepresentation.type === "transcript" ? "Transcript & source text" : "Source text analyzed"}
                </h3>
                <span className="rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide bg-indigo-500/10 text-indigo-700 dark:text-indigo-300">
                  {contentRepresentation.status} · {contentRepresentation.source.replaceAll("_", " ")}
                </span>
              </div>
              {contentRepresentation.text ? (
                <p className="max-h-72 overflow-auto whitespace-pre-wrap rounded-2xl border border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/40 p-4 text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {contentRepresentation.text}
                </p>
              ) : (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">No readable source text or transcript was available. The saved URL and verified metadata are preserved.</p>
              )}
              {contentRepresentation.type !== "transcript" && ["video", "reel", "short"].includes(item.contentType) && (
                <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                  Transcript unavailable{contentRepresentation.source !== "none" ? ` — analyzed from source ${contentRepresentation.source.replaceAll("_", " ")}.` : "."}
                </p>
              )}
              {contentRepresentation.failureReason && (
                <p className="text-xs text-zinc-500">Processing note: {contentRepresentation.failureReason}</p>
              )}
              <p className="text-[11px] text-zinc-500">
                Extraction: {contentRepresentation.extractionMethod} · Language: {contentRepresentation.language || "not detected"} · Evidence score: {Math.round(contentRepresentation.confidence * 100)}%
              </p>
              {contentRepresentation.sourceSegments?.length ? (
                <div className="flex flex-wrap gap-1.5" aria-label="Content provenance sources">
                  {contentRepresentation.sourceSegments.map((segment, index) => (
                    <span key={`${segment.source}-${index}`} title={segment.text.slice(0, 200)} className="rounded-full border border-zinc-200 dark:border-zinc-700 px-2 py-1 text-[10px] text-zinc-600 dark:text-zinc-400">
                      {segment.source.replaceAll("_", " ")}
                    </span>
                  ))}
                </div>
              ) : null}
            </section>
          )}

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
              {generatedTags.length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">AI generated tags · grounded evidence</div>
                  <div className="flex flex-wrap gap-1.5">
                    {generatedTags.map((tag) => (
                      <span key={tag.normalizedName} title={`Evidence: ${tag.evidence}`} className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 dark:border-indigo-900 bg-indigo-50 dark:bg-indigo-950/40 px-2 py-1 text-[11px] text-indigo-800 dark:text-indigo-200">
                        {tag.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {(collectionMatches.length > 0 || suggestedNewCollection) && (
              <div className="space-y-2 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">AI collection suggestions</div>
                {collectionMatches.map((match) => (
                  <div key={match.collectionId} className="rounded-xl border border-zinc-200 dark:border-zinc-800 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200">{match.name}</span>
                      <span className="text-[11px] tabular-nums text-indigo-600 dark:text-indigo-300">{Math.round(match.confidence * 100)}% match</span>
                    </div>
                    {match.reasoning && <p className="text-[11px] leading-relaxed text-zinc-500">{match.reasoning}</p>}
                    <button type="button" onClick={() => void handleCollectionChange(match.collectionId)} className="text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:underline">
                      {item.collectionId === match.collectionId ? "Current collection" : "Use this collection"}
                    </button>
                  </div>
                ))}
                {suggestedNewCollection && (
                  <div className="rounded-xl border border-amber-300/70 bg-amber-50/70 dark:bg-amber-950/20 p-3 space-y-2">
                    <p className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">{suggestedNewCollection.created ? "Keeper created collection:" : "New collection suggestion:"} {suggestedNewCollection.name}</p>
                    <p className="text-[11px] text-zinc-600 dark:text-zinc-400">{suggestedNewCollection.reason}</p>
                    <button type="button" onClick={() => void acceptNewCollectionSuggestion()} className="text-xs font-semibold text-amber-800 dark:text-amber-300 hover:underline">{suggestedNewCollection.collectionId ? "Use this collection" : "Create and use collection"}</button>
                  </div>
                )}
              </div>
            )}

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
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 shrink-0">
                  <User className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Author
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate text-right min-w-0">
                  {getFormattedIdentity()[0] || item.creator.name}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 shrink-0">
                  <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Platform
                </span>
                <span className="font-semibold text-zinc-900 dark:text-zinc-200 uppercase text-[11px] shrink-0">
                  {item.platform === "x" ? "X" : item.platform}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 shrink-0">
                  <Layers className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Content Type
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-200 capitalize text-xs shrink-0">
                  {item.contentType} Post
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 shrink-0">
                  <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Source
                </span>
                <span className="font-mono text-zinc-900 dark:text-zinc-200 truncate text-right min-w-0">
                  {item.metadata.domain || (item.platform === "x" ? "x.com" : `${item.platform}.com`)}
                </span>
              </div>

              {item.community?.name && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <Globe className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Community
                  </span>
                  <span className="font-semibold text-orange-600 dark:text-orange-400 truncate text-right min-w-0">
                    r/{item.community.name.replace(/^r\//i, "")}
                  </span>
                </div>
              )}

              {item.metadata.duration && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Duration
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate text-right min-w-0">
                    {item.metadata.duration}
                  </span>
                </div>
              )}

              {item.metadata.publishedAt && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <Calendar className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Published
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate text-right min-w-0">
                    {item.metadata.publishedAt}
                  </span>
                </div>
              )}

              {item.metadata.readTime && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <Clock className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Read Time
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate text-right min-w-0">
                    {item.metadata.readTime}
                  </span>
                </div>
              )}

              {item.metadata.upvotes !== undefined && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <ThumbsUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Upvotes
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate text-right min-w-0">
                    {item.metadata.upvotes}
                  </span>
                </div>
              )}

              {item.metadata.comments !== undefined && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <MessageSquare className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Comments
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate text-right min-w-0">
                    {item.metadata.comments}
                  </span>
                </div>
              )}

              {item.metadata.likes && (
                <div className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-1.5 shrink-0">
                    <ThumbsUp className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Likes / Stars
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate text-right min-w-0">
                    {item.metadata.likes}
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5 shrink-0">
                  <Eye className="w-3.5 h-3.5 text-zinc-400 shrink-0" /> Views
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-200 truncate text-right min-w-0">
                  {item.viewCount || 1} times
                </span>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-[11px]">
                <span className="shrink-0">Saved on</span>
                <span className="truncate text-right min-w-0">{formatFullDate(item.savedDate)}</span>
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

              {item.metadata?.contentIntent && (
                <div className="flex items-start justify-between gap-2 text-zinc-600 dark:text-zinc-400">
                  <span className="text-[11px] text-zinc-400">Content Intent</span>
                  <span className="font-semibold text-[11px] text-emerald-600 dark:text-emerald-400 uppercase tracking-wider text-right">
                    {item.metadata.contentIntent}
                  </span>
                </div>
              )}

              {item.metadata?.evidenceLevel && (
                <div className="flex items-start justify-between gap-2 text-zinc-600 dark:text-zinc-400">
                  <span className="text-[11px] text-zinc-400">Evidence Level</span>
                  <span className="font-mono text-[11px] font-medium text-zinc-800 dark:text-zinc-200 text-right">
                    {item.metadata.evidenceLevel}
                  </span>
                </div>
              )}
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
