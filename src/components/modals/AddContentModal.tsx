"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { useRecall } from "@/context/RecallContext";
import { ContentService } from "@/services/content-service";
import { ProviderService } from "@/services/provider-service";
import { AIService, AIAnalysisResult } from "@/services/ai-service";
import { PlatformBadge } from "@/components/common/PlatformBadge";
import { ContentTypeBadge } from "@/components/common/ContentTypeBadge";
import { ExtractedContent, SavedItem } from "@/types";
import {
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Folder,
  Tag,
  StickyNote,
  ArrowRight,
  ExternalLink,
  Loader2,
  Link as LinkIcon,
  ShieldAlert,
} from "lucide-react";

type ProcessStep =
  | "idle"
  | "detecting-platform"
  | "extracting-content-id"
  | "fetching-metadata"
  | "extracting-content"
  | "validating-data"
  | "generating-summary"
  | "ready"
  | "duplicate";

const TEST_URLS = [
  { label: "YouTube Video", url: "https://youtu.be/3lZF8W_AaUo" },
  { label: "Instagram Reel", url: "https://www.instagram.com/reel/C3x90ZaLkPq/" },
  { label: "Reddit SaaS", url: "https://www.reddit.com/r/SaaS/comments/1bgf90a/micro_saas_tips/" },
  { label: "X Thread", url: "https://x.com/karpathy/status/17698249824921" },
  { label: "TikTok Recipe", url: "https://www.tiktok.com/@stealth_health/video/73491829182" },
  { label: "Engineering Blog", url: "https://leerob.io/blog/next-caching-deep-dive" },
];

export const AddContentModal: React.FC = () => {
  const {
    isAddContentOpen,
    closeAddContent,
    addContentInitialUrl,
    collections,
    addItem,
  } = useRecall();

  const [url, setUrl] = useState("");
  const [step, setStep] = useState<ProcessStep>("idle");
  const [duplicateItem, setDuplicateItem] = useState<SavedItem | null>(null);

  // Editable fields after extraction
  const [title, setTitle] = useState("");
  const [creatorName, setCreatorName] = useState("");
  const [extractedMeta, setExtractedMeta] = useState<ExtractedContent | null>(null);
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [personalNotes, setPersonalNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Populate initial URL if passed
  useEffect(() => {
    if (addContentInitialUrl) {
      setUrl(addContentInitialUrl);
      startSimulation(addContentInitialUrl);
    } else {
      resetState();
    }
  }, [addContentInitialUrl, isAddContentOpen]);

  const resetState = () => {
    setUrl("");
    setStep("idle");
    setDuplicateItem(null);
    setTitle("");
    setCreatorName("");
    setExtractedMeta(null);
    setAiResult(null);
    setSelectedCollectionId("");
    setTags([]);
    setTagInput("");
    setPersonalNotes("");
    setIsSaving(false);
  };

  const startSimulation = async (inputUrl: string) => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;

    // Check duplicate first
    const existing = ContentService.checkDuplicate(trimmed);
    if (existing) {
      setDuplicateItem(existing);
      setStep("duplicate");
      return;
    }

    try {
      // Step 1: Detect Platform
      setStep("detecting-platform");
      await new Promise((r) => setTimeout(r, 200));

      // Step 2: Extract Content ID
      setStep("extracting-content-id");
      await new Promise((r) => setTimeout(r, 150));

      // Step 3: Fetch Real Available Metadata
      setStep("fetching-metadata");
      await new Promise((r) => setTimeout(r, 200));

      // Step 4: Extract Real Available Content
      setStep("extracting-content");
      const extracted = await ProviderService.extractContent(trimmed);
      setExtractedMeta(extracted);
      setTitle(extracted.title);
      setCreatorName(extracted.creator.name);
      await new Promise((r) => setTimeout(r, 200));

      // Step 5: Validate Data
      setStep("validating-data");
      ProviderService.validateContent(extracted);
      await new Promise((r) => setTimeout(r, 150));

      // Step 6: AI Analyze ONLY Extracted Data
      setStep("generating-summary");
      const analysis = await AIService.analyzeExtractedContent(extracted, collections);

      setAiResult(analysis);
      setTags(analysis.tags);
      setSelectedCollectionId(analysis.suggestedCollectionId || collections[0]?.id || "");
      await new Promise((r) => setTimeout(r, 250));

      // Step 7: Ready
      setStep("ready");
    } catch (err) {
      console.error("Content extraction error:", err);
      setStep("ready");
    }
  };

  const handleSave = () => {
    if (!extractedMeta || !aiResult || isSaving) return;
    setIsSaving(true);
    try {

    const originalUrl = url.trim() || extractedMeta.url;
    const finalCreator = {
      ...extractedMeta.creator,
      name: creatorName.trim() || extractedMeta.creator.name,
    };

    const finalProvenance = { ...aiResult.provenance };
    if (title && title.trim() !== extractedMeta.title) {
      finalProvenance.title = {
        value: title.trim(),
        source: "user_edited",
        retrievedAt: new Date().toISOString(),
      };
    }
    if (creatorName && creatorName.trim() !== extractedMeta.creator.name) {
      finalProvenance.creator = {
        value: creatorName.trim(),
        source: "user_edited",
        retrievedAt: new Date().toISOString(),
      };
    }

    addItem({
      title: title || extractedMeta.title,
      url: originalUrl,
      thumbnail: extractedMeta.thumbnail,
      platform: extractedMeta.platform,
      contentType: extractedMeta.contentType,
      creator: finalCreator,
      description: extractedMeta.description,
      collectionId: selectedCollectionId || undefined,
      collections: selectedCollectionId ? [selectedCollectionId] : [],
      tags,
      favorite: false,
      archived: false,
      trashed: false,
      aiSummary: aiResult.summary,
      keyPoints: aiResult.keyPoints,
      topics: aiResult.topics,
      personalNotes,
      metadata: extractedMeta.metadata,
      contentStatus: aiResult.status,
      isLimited: aiResult.isLimited,
      limitedReason: aiResult.limitedReason,
      provenance: finalProvenance,
    });

    // Fire celebration confetti
    try {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.7 },
      });
    } catch {}

    closeAddContent();
    resetState();
  } finally {
    setIsSaving(false);
  }
};

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, "");
      if (clean && !tags.includes(clean)) {
        setTags([...tags, clean]);
        setTagInput("");
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  if (!isAddContentOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Universal Add Content
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Paste any link from YouTube, Instagram, Reddit, X, TikTok, or blogs.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              closeAddContent();
              resetState();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* URL Input Form */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
              Paste URL to Analyze
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <LinkIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://www.youtube.com/watch?v=... or instagram, reddit, x.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700/80 bg-zinc-50 dark:bg-zinc-800/60 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      startSimulation(url);
                    }
                  }}
                />
              </div>
              <button
                onClick={() => startSimulation(url)}
                disabled={!url.trim() || (step !== "idle" && step !== "ready" && step !== "duplicate")}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-98 flex items-center gap-2"
              >
                {step !== "idle" && step !== "ready" && step !== "duplicate" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    Analyze <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>

            {/* Quick Test Links */}
            {step === "idle" && (
              <div className="mt-3">
                <span className="text-[11px] font-medium text-zinc-400">Quick Test URLs:</span>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {TEST_URLS.map((t) => (
                    <button
                      key={t.label}
                      onClick={() => {
                        setUrl(t.url);
                        startSimulation(t.url);
                      }}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 border border-zinc-200 dark:border-zinc-700/60 transition-colors"
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Animated AI Pipeline Steps */}
          {step !== "idle" && step !== "duplicate" && (
            <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-800/40 space-y-2.5">
              <div className="flex items-center justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400">
                <span className="flex items-center gap-1.5 font-semibold text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-3.5 h-3.5" />
                  AI Pipeline Progress
                </span>
                <span>
                  {step === "ready" ? "Complete" : "Analyzing & Processing..."}
                </span>
              </div>

              {/* Progress Steps List */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 text-xs">
                {[
                  { id: "detecting-platform", label: "1. Detect Platform" },
                  { id: "extracting-content-id", label: "2. Extract Content ID" },
                  { id: "fetching-metadata", label: "3. Fetch Metadata" },
                  { id: "extracting-content", label: "4. Extract Content" },
                  { id: "validating-data", label: "5. Validate Data" },
                  { id: "generating-summary", label: "6. AI Grounded Analysis" },
                ].map((s) => {
                  const stepOrder = [
                    "detecting-platform",
                    "extracting-content-id",
                    "fetching-metadata",
                    "extracting-content",
                    "validating-data",
                    "generating-summary",
                    "ready",
                  ];
                  const currentIndex = stepOrder.indexOf(step);
                  const stepIndex = stepOrder.indexOf(s.id);
                  const isDone = currentIndex > stepIndex || step === "ready";
                  const isCurrent = step === s.id;

                  return (
                    <div
                      key={s.id}
                      className={`flex items-center gap-1.5 p-2 rounded-lg border transition-all ${
                        isDone
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-medium"
                          : isCurrent
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-semibold animate-pulse"
                          : "bg-transparent border-transparent text-zinc-400"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                      ) : isCurrent ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full border border-zinc-400/50 shrink-0" />
                      )}
                      <span className="truncate">{s.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* DUPLICATE URL STATE */}
          {step === "duplicate" && duplicateItem && (
            <div className="p-5 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 space-y-3">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold">Already Saved in Your Library</h4>
                  <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-1">
                    This URL was previously saved as &quot;{duplicateItem.title}&quot;. Recall prevents duplicate bookmarks to keep your workspace clean.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 pt-2">
                <Link
                  href={`/app/item/${duplicateItem.id}`}
                  onClick={() => closeAddContent()}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Existing Item
                </Link>
                <button
                  onClick={resetState}
                  className="px-3.5 py-1.5 rounded-lg text-xs font-medium border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Try Another URL
                </button>
              </div>
            </div>
          )}

          {/* READY: PREVIEW & LIVE EDITING BEFORE SAVING */}
          {step === "ready" && extractedMeta && aiResult && (
            <div className="space-y-4 pt-2 border-t border-zinc-200 dark:border-zinc-800 animate-in fade-in-50 duration-300">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                  Review &amp; Edit Before Saving
                </h3>
                <div className="flex items-center gap-2">
                  <PlatformBadge platform={extractedMeta.platform} />
                  <ContentTypeBadge type={extractedMeta.contentType} />
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                    aiResult.status === "FULL_CONTENT"
                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                      : aiResult.status === "PARTIAL_CONTENT"
                      ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20"
                      : aiResult.status === "METADATA_ONLY"
                      ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                  }`}>
                    {aiResult.status.replace("_", " ")}
                  </span>
                </div>
              </div>

              {/* Limited Content Alert */}
              {(extractedMeta.isLimited || aiResult.isLimited) && (
                <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300 flex items-start gap-2.5 text-xs leading-relaxed">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-500 mt-0.5" />
                  <div>
                    <span className="font-semibold block text-amber-900 dark:text-amber-200">Limited content available</span>
                    {extractedMeta.limitedReason || "We saved this resource, but some source information couldn't be retrieved due to platform or privacy restrictions. AI summary is grounded only in verified metadata."}
                  </div>
                </div>
              )}

              {/* Title, Creator & Preview row */}
              <div className="flex gap-4">
                <div className="relative w-28 h-24 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={extractedMeta.thumbnail}
                    alt={extractedMeta.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 block mb-0.5">Title</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-1.5 rounded-lg text-sm font-semibold border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-medium text-zinc-500 block mb-0.5">Creator / Author</label>
                    <input
                      type="text"
                      value={creatorName}
                      onChange={(e) => setCreatorName(e.target.value)}
                      placeholder="e.g. Author or channel name"
                      className="w-full px-3 py-1 rounded-lg text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* AI Summary generated */}
              <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Generated AI Summary
                  </div>
                  <span className="text-[10px] font-normal text-indigo-500/80">
                    Grounded in {aiResult.provenance.summary?.basedOn?.join(" + ") || "metadata"}
                  </span>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {aiResult.summary.standard}
                </p>
              </div>

              {/* Collection Selector & Tags Editor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Collection */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    <Folder className="w-3.5 h-3.5 text-indigo-500" />
                    Collection
                  </label>
                  <select
                    value={selectedCollectionId}
                    onChange={(e) => setSelectedCollectionId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">(None - General Library)</option>
                    {collections.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name} {col.id === aiResult.suggestedCollectionId ? "★ (AI Suggested)" : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-500" />
                    AI Tags (Press Enter to add)
                  </label>
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Type and press Enter..."
                    className="w-full px-3 py-1.5 rounded-xl text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 mb-2"
                  />
                  <div className="flex flex-wrap gap-1">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
                      >
                        #{t}
                        <button
                          type="button"
                          onClick={() => removeTag(t)}
                          className="hover:text-rose-500 transition-colors"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Personal Notes */}
              <div>
                <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1.5">
                  <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                  Personal Note (Optional)
                </label>
                <textarea
                  value={personalNotes}
                  onChange={(e) => setPersonalNotes(e.target.value)}
                  placeholder="Why did you save this? Add personal thoughts or action items..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer Buttons */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            onClick={() => {
              closeAddContent();
              resetState();
            }}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>

          {step === "ready" && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className={`inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-105 active:scale-95 ${
                isSaving ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              {isSaving ? "Saving to Recall..." : "Save Bookmark to Recall"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
