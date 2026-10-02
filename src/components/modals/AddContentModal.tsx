"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import confetti from "canvas-confetti";
import { useRecall } from "@/context/RecallContext";
import { ContentService } from "@/services/content-service";
import { ProviderService } from "@/services/provider-service";
import { AIAnalysisResult } from "@/services/ai-service";
import { CollectionMatchingService } from "@/services/collection-matching-service";
import { PlatformBadge } from "@/components/common/PlatformBadge";
import { ContentTypeBadge } from "@/components/common/ContentTypeBadge";
import { Collection, ExtractedContent, IngestionResult, SavedItem } from "@/types";
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
  Plus,
  Check,
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

const COLOR_PALETTE = [
  "#6366f1", // Indigo
  "#06b6d4", // Cyan
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#ef4444", // Rose
  "#3b82f6", // Blue
  "#84cc16", // Lime
  "#14b8a6", // Teal
];

const TEST_URLS = [
  { label: "YouTube Video", url: "https://youtu.be/3lZF8W_AaUo" },
  { label: "Instagram Reel", url: "https://www.instagram.com/reel/C3x90ZaLkPq/" },
  { label: "Reddit SaaS", url: "https://www.reddit.com/r/SaaS/comments/1bgf90a/micro_saas_tips/" },
  { label: "X Thread", url: "https://x.com/karpathy/status/17698249824921" },
  { label: "TikTok Recipe", url: "https://www.tiktok.com/@stealth_health/video/73491829182" },
  { label: "Engineering Blog", url: "https://leerob.io/blog/next-caching-deep-dive" },
];

const TAG_STOP_WORDS = new Set("about after all also and are because been before between but can comment could for from have into just more most other please that the this with your free my our how what when where who will with using use video reel post instagram youtube link save saved watch".split(" "));
const CATEGORY_TAGS: Record<string, string[]> = {
  Quiz: ["quiz", "quizzes", "trivia", "brain teaser", "brain teasers", "riddle", "riddles", "knowledge test", "question game"],
  Comedy: ["comedy", "comedian", "funny", "humor", "humour", "sketch", "standup", "parody", "satire", "ashish chanchlani", "bhuvan bam", "harsh beniwal", "bb ki vines", "zakir khan"],
  Entertainment: ["entertainment", "music", "movie", "movies", "gaming", "celebrity", "series", "cinema"],
  Technology: ["technology", "programming", "coding", "software", "artificial intelligence", "machine learning"],
  Design: ["design", "graphic design", "web design", "typography", "figma"],
  Education: ["education", "learning", "study", "lesson", "course", "tutorial", "explainer"],
  Travel: ["travel", "destination", "tourism", "itinerary"],
  Food: ["food", "cooking", "recipe", "recipes", "cuisine"],
  Fitness: ["fitness", "workout", "exercise", "health", "wellness"],
  Business: ["business", "marketing", "startup", "entrepreneurship", "sales"],
  News: ["news", "current events", "politics", "breaking news"],
  Sports: ["sports", "cricket", "football", "basketball"],
};

function suggestCaptureTags(content: ExtractedContent, aiTags: string[] = []): string[] {
  const sourceText = [content.title, content.caption, content.bodyText, content.description, ...(content.hashtags || []), ...(content.metadata.hashtags || [])]
    .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
    .join("\n");
  const suggestions = [...aiTags];
  const add = (raw: string) => {
    const value = raw.replace(/^#+/, "").replace(/[_-]+/g, " ").trim();
    const normalized = value.toLocaleLowerCase();
    if (value.length >= 3 && value.length <= 48 && !TAG_STOP_WORDS.has(normalized)
      && !suggestions.some((tag) => tag.toLocaleLowerCase() === normalized)) suggestions.push(value);
  };

  for (const hashtag of sourceText.match(/#[\p{L}\p{N}_-]{2,}/gu) || []) add(hashtag);
  const normalizedSource = sourceText.replace(/([a-z])([A-Z])/g, "$1 $2").toLocaleLowerCase().replace(/[_-]+/g, " ");
  for (const [tag, cues] of Object.entries(CATEGORY_TAGS)) {
    if (cues.some((cue) => normalizedSource.includes(cue))) add(tag);
  }
  const phrases = ["Claude Code", "After Effects", "Machine Learning", "Artificial Intelligence", "TypeScript", "JavaScript", "React", "Python", "Figma", "Premiere Pro", "Blender"];
  for (const phrase of phrases) {
    if (new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(sourceText)) add(phrase);
  }
  for (const token of sourceText.match(/[\p{L}][\p{L}\p{N}+#.-]{2,}/gu) || []) add(token.replace(/[.+#-]+$/g, ""));

  // Always give the user usable, honest organization labels even when the
  // source exposes no caption or hashtags. These describe format/platform only.
  if (!suggestions.length) {
    add(content.platform);
    add(content.contentType);
  }
  return suggestions.slice(0, 10);
}

function matchCaptureCollection(content: ExtractedContent, tags: string[], collections: Collection[]) {
  const candidates = CollectionMatchingService.match(
    [content.title, content.caption, content.bodyText, content.description].filter(Boolean).join("\n"),
    tags.map((name) => ({
      name,
      normalizedName: name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""),
      category: "Topic" as const,
      confidence: 1,
      source: "user" as const,
      evidence: "Suggested from available source details.",
    })),
    collections,
  );
  const best = CollectionMatchingService.selectBestMatch(candidates);
  return best ? { collection: collections.find((collection) => collection.id === best.collectionId), match: best } : null;
}

export const AddContentModal: React.FC = () => {
  const {
    isAddContentOpen,
    closeAddContent,
    addContentInitialUrl,
    collections,
    addItem,
    createCollection,
    canImport,
    importLimits,
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
  const [collectionSuggestionNote, setCollectionSuggestionNote] = useState("");
  const [collectionWasManuallyChanged, setCollectionWasManuallyChanged] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tagSuggestionNote, setTagSuggestionNote] = useState("");
  const [personalNotes, setPersonalNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Inline collection creation state
  const [isCreatingCollection, setIsCreatingCollection] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState(COLOR_PALETTE[2]); // Purple default as preferred in prompt
  const [newColError, setNewColError] = useState("");
  const [isSubmittingCol, setIsSubmittingCol] = useState(false);

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
    setCollectionSuggestionNote("");
    setCollectionWasManuallyChanged(false);
    setTags([]);
    setTagInput("");
    setTagSuggestionNote("");
    setPersonalNotes("");
    setIsSaving(false);
    setIsCreatingCollection(false);
    setNewColName("");
    setNewColColor(COLOR_PALETTE[2]);
    setNewColError("");
    setIsSubmittingCol(false);
  };

  const handleCreateCollection = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = newColName.trim();
    if (!trimmed) {
      setNewColError("Collection name cannot be empty.");
      return;
    }
    if (trimmed.length > 50) {
      setNewColError("Collection name must be 50 characters or less.");
      return;
    }

    const existing = collections.find(
      (c) => c.name.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (existing) {
      setNewColError(`A collection named "${existing.name}" already exists.`);
      return;
    }

    setIsSubmittingCol(true);
    try {
      const created = createCollection({
        name: trimmed,
        color: newColColor,
        icon: "Folder",
      });
      setSelectedCollectionId(created.id);
      setIsCreatingCollection(false);
      setNewColName("");
      setNewColColor(COLOR_PALETTE[2]);
      setNewColError("");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create collection.";
      setNewColError(msg);
    } finally {
      setIsSubmittingCol(false);
    }
  };

  const startSimulation = async (inputUrl: string) => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;
    setImportError(null);

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
      let extracted: ExtractedContent;
      let serverEnrichment: IngestionResult["aiEnrichment"] | null = null;
      {
        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: trimmed, collections }),
        });
        const json = await res.json() as { success?: boolean; error?: string; data?: IngestionResult; job?: { media_id?: string; status?: string } };
        if (res.ok) {
          if (json.success && json.data) {
            const data = json.data;
            serverEnrichment = data.aiEnrichment;
            extracted = {
              contentId: data.sourceData.contentId,
              platform: data.sourceData.platform,
              contentType: data.sourceData.contentType,
              url: trimmed,
              canonicalUrl: data.sourceData.canonicalUrl,
              title: data.sourceData.title,
              creator: data.sourceData.creator,
              community: data.sourceData.community,
              subreddit: data.sourceData.community?.name,
              description: data.sourceData.description || "",
              thumbnail: data.sourceData.thumbnailUrl,
              metadata: {
                domain: `${data.sourceData.platform}.com`,
                publishedAt: data.sourceData.publishedAt,
                duration: data.sourceData.duration,
                views: data.sourceData.viewCount,
                likes: data.sourceData.likeCount,
                serverMediaId: json.job?.media_id,
                aiProcessingStatus: json.job?.status === "QUEUED" ? "QUEUED" : "PENDING",
              },
              suggestedTags: data.aiEnrichment.tags,
              suggestedCollectionName: data.aiEnrichment.suggestedCollectionName || "Watch Later",
              status: data.aiEnrichment.status,
              isLimited: !data.aiEnrichment.isSufficientContent,
              limitedReason: data.sourceData.restrictionReason,
              provenance: data.sourceData.provenance,
              bodyText: data.sourceData.bodyText,
              caption: data.sourceData.caption,
            };
          } else {
            throw new Error("The import service returned an invalid response. Please try again.");
          }
        } else {
          throw new Error(json.error || `Import failed with status ${res.status}.`);
        }
      }

      setExtractedMeta(extracted);
      setTitle(extracted.title);
      if ((extracted.platform === "x" || extracted.platform === "twitter") && extracted.creator.username) {
        const cleanUser = extracted.creator.username.replace(/^@/, "").trim();
        const name = extracted.creator.displayName || extracted.creator.name || "";
        if (name && cleanUser && !name.includes(`@${cleanUser}`)) {
          setCreatorName(`${name} (@${cleanUser})`);
        } else {
          setCreatorName(name || `@${cleanUser}`);
        }
      } else if (extracted.platform === "reddit") {
        if (extracted.creator.status === "deleted" || !extracted.creator.username) {
          setCreatorName("Deleted user");
        } else {
          const cleanUser = extracted.creator.username.replace(/^u\//i, "").trim();
          setCreatorName(`u/${cleanUser}`);
        }
      } else {
        setCreatorName(extracted.creator.displayName || extracted.creator.name);
      }
      await new Promise((r) => setTimeout(r, 200));

      // Step 5: Validate Data
      setStep("validating-data");
      ProviderService.validateContent(extracted);
      await new Promise((r) => setTimeout(r, 150));

      // Step 6: AI Analyze ONLY Extracted Data
      setStep("generating-summary");
      if (!serverEnrichment) throw new Error("The server did not return the queued item state; no local AI analysis was run.");
      const serverMatchedCol = collections.find(
        (c) => c.id === serverEnrichment.suggestedCollectionId || c.name.toLowerCase() === (serverEnrichment.suggestedCollectionName || "").toLowerCase()
      );
      const suggestedTags = suggestCaptureTags(extracted, serverEnrichment.tags || []);
      const tagMatchedResult = matchCaptureCollection(extracted, suggestedTags, collections);
      const tagMatchedCollection = tagMatchedResult?.match;
      const inferredCategory = CollectionMatchingService.inferCollectionCategory(suggestedTags);
      const suggestedCollection = tagMatchedCollection
        ? tagMatchedResult?.collection
        : inferredCategory
        ? undefined
        : serverMatchedCol;
      const selectedSuggestionId = suggestedCollection?.id || (!suggestedCollection && inferredCategory ? `__create__:${inferredCategory}` : "");
      const analysis: AIAnalysisResult = {
        summary: serverEnrichment.summary,
        keyPoints: serverEnrichment.keyPoints || [],
        tags: serverEnrichment.tags || [],
        topics: serverEnrichment.topics || [],
        suggestedCollectionId: suggestedCollection?.id || "",
        suggestedCollectionName: suggestedCollection?.name || inferredCategory || serverEnrichment.suggestedCollectionName || "Uncategorized",
        status: serverEnrichment.status,
        isLimited: !serverEnrichment.isSufficientContent,
        limitedReason: serverEnrichment.confidence < 0.6 ? "AI analysis is queued until verified content is available." : undefined,
        provenance: serverEnrichment.provenance || {},
      };

      setAiResult(analysis);
      setTags(suggestedTags);
      setTagSuggestionNote(suggestedTags.length ? `Suggested from available caption, title, and hashtags.` : "No tags could be suggested from available source details.");
      setSelectedCollectionId(selectedSuggestionId);
      setCollectionWasManuallyChanged(false);
      setCollectionSuggestionNote(tagMatchedCollection
        ? `Auto-selected ${tagMatchedCollection.name} from matching tags (${Math.round(tagMatchedCollection.confidence * 100)}% match). You can change it.`
        : inferredCategory && !suggestedCollection
        ? `A ${inferredCategory} collection will be created when you save this item.`
        : "No clear tag match found. Choose a collection, or keep this in the General Library.");
      await new Promise((r) => setTimeout(r, 250));

      // Step 7: Ready
      setStep("ready");
    } catch (err) {
      console.warn("Content extraction could not complete:", err);
      setImportError(err instanceof Error ? err.message : "The import could not be completed.");
      setStep("idle");
    }
  };

  const handleSave = async () => {
    if (!extractedMeta || !aiResult || isSaving) return;
    setIsSaving(true);
    try {

    let savedCollectionId = selectedCollectionId;
    if (selectedCollectionId.startsWith("__create__:")) {
      const categoryName = selectedCollectionId.slice("__create__:".length).trim();
      const existingCategory = collections.find((collection) => collection.name.trim().toLocaleLowerCase() === categoryName.toLocaleLowerCase());
      const categoryCollection = existingCategory || createCollection({
        name: categoryName,
        description: `Automatically organized ${categoryName.toLocaleLowerCase()} content.`,
        color: COLOR_PALETTE[2],
        icon: "Folder",
      });
      savedCollectionId = categoryCollection.id;
      setSelectedCollectionId(categoryCollection.id);
      try {
        const response = await fetch("/api/collections/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: categoryCollection.id,
            name: categoryCollection.name,
            description: categoryCollection.description,
            color: categoryCollection.color,
            icon: categoryCollection.icon,
          }),
        });
        if (!response.ok) console.warn("The new collection is saved locally but could not sync to workspace storage.");
      } catch (error: unknown) {
        console.warn("The new collection is saved locally but workspace sync failed.", error);
      }
    }

    const originalUrl = url.trim() || extractedMeta.url;
    const cleanEditedName = creatorName.trim();
    let parsedName = cleanEditedName;
    let parsedUsername: string | null = extractedMeta.creator.username ?? null;
    if (extractedMeta.platform === "reddit") {
      if (cleanEditedName.toLowerCase() === "deleted user" || extractedMeta.creator.status === "deleted") {
        parsedName = "Deleted user";
        parsedUsername = null;
      } else {
        const cleanUser = cleanEditedName.replace(/^u\//i, "").trim();
        parsedName = cleanUser ? `u/${cleanUser}` : (extractedMeta.creator.name || "");
        parsedUsername = cleanUser || null;
      }
    } else {
      const handleMatch = cleanEditedName.match(/^(.*?)\s*\(@([a-zA-Z0-9_]+)\)$/);
      if (handleMatch) {
        parsedName = handleMatch[1].trim();
        parsedUsername = handleMatch[2].trim();
      }
    }

    const finalCreator = {
      ...extractedMeta.creator,
      name: parsedName || extractedMeta.creator.name,
      displayName: cleanEditedName || extractedMeta.creator.displayName || extractedMeta.creator.name,
      username: parsedUsername,
    };

    const finalProvenance = { ...aiResult.provenance };
    if (title && title.trim() !== extractedMeta.title) {
      finalProvenance.title = {
        value: title.trim(),
        source: "user_edited",
        retrievedAt: new Date().toISOString(),
      };
    }
    if (cleanEditedName && cleanEditedName !== extractedMeta.creator.name) {
      finalProvenance.creator = {
        value: cleanEditedName,
        source: "user_edited",
        retrievedAt: new Date().toISOString(),
      };
    }

    const savedItem = addItem({
      title: title || extractedMeta.title,
      url: originalUrl,
      thumbnail: extractedMeta.thumbnail,
      platform: extractedMeta.platform,
      contentType: extractedMeta.contentType,
      creator: finalCreator,
      community: extractedMeta.community,
      description: extractedMeta.description,
      collectionId: savedCollectionId && !savedCollectionId.startsWith("__create__:") ? savedCollectionId : undefined,
      collections: savedCollectionId && !savedCollectionId.startsWith("__create__:") ? [savedCollectionId] : [],
      tags,
      favorite: false,
      archived: false,
      trashed: false,
      aiSummary: aiResult.summary,
      keyPoints: aiResult.keyPoints,
      topics: aiResult.topics,
      personalNotes,
      metadata: { ...extractedMeta.metadata, userTags: tags, captureTagSource: "available_source_metadata" },
      contentStatus: aiResult.status,
      isLimited: aiResult.isLimited,
      limitedReason: aiResult.limitedReason,
      provenance: {
        ...finalProvenance,
        tags: { value: tags, source: "capture_tag_suggestions", basedOn: ["available_source_metadata"], retrievedAt: new Date().toISOString() },
      },
    });
    if (typeof savedItem.metadata?.serverMediaId === "string") {
      void fetch(`/api/media/${encodeURIComponent(savedItem.metadata.serverMediaId)}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tags,
          userTags: tags,
          suppressedAiTags: (aiResult?.tags || []).filter((tag) => !tags.some((savedTag) => savedTag.toLowerCase() === tag.toLowerCase())),
        }),
      }).catch((error: unknown) => {
        console.warn("Could not sync capture tags to workspace AI organization.", error);
      });
      // A blank default means "let the worker categorize this item", not a
      // deliberate request to disable auto-organization. Only sync null when
      // the user explicitly selected General Library in the collection control.
      if ((savedCollectionId && !savedCollectionId.startsWith("__create__:")) || collectionWasManuallyChanged) {
        void fetch(`/api/media/${encodeURIComponent(savedItem.metadata.serverMediaId)}/collection`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ collectionId: savedCollectionId && !savedCollectionId.startsWith("__create__:") ? savedCollectionId : null }),
        }).catch((error: unknown) => {
          console.warn("Could not sync the selected collection to workspace AI memory.", error);
        });
      }
    }

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
    } catch (error) {
      console.error("Could not save the content item.", error);
      setImportError(error instanceof Error ? error.message : "Could not save this item.");
    } finally {
      setIsSaving(false);
  }
};

  const handleAddTag = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      const clean = tagInput.trim().replace(/^#/, "");
      if (clean && !tags.includes(clean)) {
        const nextTags = [...tags, clean];
        setTags(nextTags);
        updateAutoCollectionFromTags(nextTags);
        setTagInput("");
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    const nextTags = tags.filter((t) => t !== tagToRemove);
    setTags(nextTags);
    updateAutoCollectionFromTags(nextTags);
  };

  const updateAutoCollectionFromTags = (tagNames: string[]) => {
    if (!extractedMeta || collectionWasManuallyChanged) return;
    const result = matchCaptureCollection(extractedMeta, tagNames, collections);
    const inferredCategory = CollectionMatchingService.inferCollectionCategory(tagNames);
    setSelectedCollectionId(result?.collection?.id || (inferredCategory ? `__create__:${inferredCategory}` : ""));
    setCollectionSuggestionNote(result
      ? `Auto-selected ${result.match.name} from matching tags (${Math.round(result.match.confidence * 100)}% match). You can change it.`
      : inferredCategory
      ? `A ${inferredCategory} collection will be created when you save this item.`
      : "No clear tag match found. Choose a collection, or keep this in the General Library.");
  };

  const handleGenerateTags = () => {
    if (!extractedMeta) return;
    const generated = suggestCaptureTags(extractedMeta, aiResult?.tags || []);
    const nextTags = [...new Set([...tags, ...generated])].slice(0, 24);
    setTags(nextTags);
    updateAutoCollectionFromTags(nextTags);
    setTagSuggestionNote(generated.length ? "Suggestions refreshed from available source details." : "No source details were available for tag suggestions.");
  };

  if (!isAddContentOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-600/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                Universal Add Content
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
                Paste a link from YouTube, Instagram, Reddit, LinkedIn, X, or the web.
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              closeAddContent();
              resetState();
            }}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 ml-2"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Quota Exhaustion Warning */}
          {!canImport && (
            <div className="p-3 rounded-xl border border-rose-200 bg-rose-50/80 dark:border-rose-900/60 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 text-xs flex items-center gap-2">
              <span className="font-bold">Quota Depleted:</span>
              <span>
                You have 0 remaining import credits ({importLimits?.total} total → {importLimits?.used} used). Reset quota in the navbar or upgrade to import more bookmarks.
              </span>
            </div>
          )}

          {/* URL Input Form */}
          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-2">
              Paste URL to Analyze
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1 min-w-0">
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
                disabled={!url.trim() || !canImport || (step !== "idle" && step !== "ready" && step !== "duplicate")}
                className="px-5 py-2.5 rounded-xl text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white shadow-md shadow-indigo-600/20 transition-all hover:scale-[1.02] active:scale-98 flex items-center justify-center gap-2 shrink-0"
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
            {importError && (
              <p role="alert" className="mt-2 text-sm font-medium text-rose-700 dark:text-rose-300">{importError}</p>
            )}

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
                  {step === "ready" ? "Ready to save · AI processing continues in workspace" : "Extracting verified source metadata..."}
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
                  { id: "generating-summary", label: "6. Queue AI Analysis" },
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
                    This URL was previously saved as &quot;{duplicateItem.title}&quot;. Keeper prevents duplicate bookmarks to keep your workspace clean.
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
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
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
                    {extractedMeta.limitedReason || "We saved this resource, but source content is limited. Keeper will not generate AI output until verified text, transcript, or OCR is available."}
                  </div>
                </div>
              )}

              {/* Title, Creator & Preview row */}
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                <div className="relative w-full sm:w-28 h-36 sm:h-24 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={extractedMeta.thumbnail}
                    alt={extractedMeta.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
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

              {/* Analysis state; actual AI runs in the background after the item is saved. */}
              <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30">
                <div className="flex items-center justify-between text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-1">
                  <div className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    {aiResult.status === "METADATA_ONLY" ? "AI analysis queued" : "Verified content analysis"}
                  </div>
                  <span className="text-[10px] font-normal text-indigo-500/80">
                    {aiResult.provenance.summary?.basedOn?.length ? `Grounded in ${aiResult.provenance.summary.basedOn.join(" + ")}` : "No AI output generated yet"}
                  </span>
                </div>
                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {aiResult.status === "METADATA_ONLY" ? "Keeper will analyze verified source text, transcript, or OCR after you save this item." : aiResult.summary.standard}
                </p>
              </div>

              {/* Collection Selector & Tags Editor */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Collection */}
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    <Folder className="w-3.5 h-3.5 text-indigo-500" />
                    Collection
                  </label>
                  <select
                    value={selectedCollectionId}
                    onChange={(e) => {
                      setSelectedCollectionId(e.target.value);
                      setCollectionWasManuallyChanged(true);
                      setCollectionSuggestionNote(e.target.value.startsWith("__create__:")
                        ? `A ${e.target.value.slice("__create__:".length)} collection will be created when you save this item.`
                        : e.target.value ? "Collection selected by you." : "This item will stay in the General Library.");
                    }}
                    className="w-full px-3 py-2 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="">(None - General Library)</option>
                    {selectedCollectionId.startsWith("__create__:") && (
                      <option value={selectedCollectionId}>
                        Create “{selectedCollectionId.slice("__create__:".length)}” collection on save
                      </option>
                    )}
                    {collections.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.name} {col.id === aiResult.suggestedCollectionId ? "★ (Suggested)" : ""}
                      </option>
                    ))}
                  </select>
                  <p className="text-[10px] leading-relaxed text-zinc-500 dark:text-zinc-400">{collectionSuggestionNote}</p>

                  {/* + Create New Collection Action Button */}
                  {!isCreatingCollection ? (
                    <button
                      type="button"
                      onClick={() => {
                        setIsCreatingCollection(true);
                        setNewColError("");
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 transition-colors pt-0.5"
                    >
                      <Plus className="w-3 h-3" />
                      Create New Collection
                    </button>
                  ) : (
                    /* Inline Panel for Creating New Collection */
                    <div className="p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-zinc-800/80 space-y-2.5 animate-in fade-in-50 duration-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider">
                          Create New Collection
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingCollection(false);
                            setNewColError("");
                          }}
                          className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <div>
                        <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                          Collection Name
                        </label>
                        <input
                          type="text"
                          value={newColName}
                          onChange={(e) => {
                            setNewColName(e.target.value);
                            if (newColError) setNewColError("");
                          }}
                          placeholder="e.g. Agentic AI Resources"
                          maxLength={50}
                          autoFocus
                          className="w-full px-2.5 py-1.5 rounded-lg text-xs border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 block mb-1">
                          Collection Color
                        </label>
                        <div className="flex flex-wrap gap-1.5">
                          {COLOR_PALETTE.map((c) => (
                            <button
                              key={c}
                              type="button"
                              onClick={() => setNewColColor(c)}
                              className="w-5 h-5 rounded-full transition-transform flex items-center justify-center border border-white/20 hover:scale-110"
                              style={{ backgroundColor: c }}
                            >
                              {newColColor === c && <Check className="w-3 h-3 text-white" />}
                            </button>
                          ))}
                        </div>
                      </div>

                      {newColError && (
                        <div className="flex items-center justify-between text-[11px] text-rose-600 dark:text-rose-400">
                          <span>{newColError}</span>
                          {collections.find((c) => c.name.trim().toLowerCase() === newColName.trim().toLowerCase()) && (
                            <button
                              type="button"
                              onClick={() => {
                                const matched = collections.find(
                                  (c) => c.name.trim().toLowerCase() === newColName.trim().toLowerCase()
                                );
                                if (matched) {
                                  setSelectedCollectionId(matched.id);
                                  setIsCreatingCollection(false);
                                  setNewColName("");
                                  setNewColError("");
                                }
                              }}
                              className="font-semibold underline ml-2 hover:text-rose-700"
                            >
                              Select Existing
                            </button>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setIsCreatingCollection(false);
                            setNewColError("");
                          }}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200/50 dark:hover:bg-zinc-700"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          disabled={isSubmittingCol || !newColName.trim()}
                          onClick={handleCreateCollection}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50 transition-colors shadow-sm"
                        >
                          {isSubmittingCol ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Create Collection"
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Tags */}
                <div>
                  <div className="mb-1.5 flex items-center justify-between gap-2">
                    <label className="flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      <Tag className="w-3.5 h-3.5 text-indigo-500" />
                      AI Tags (Press Enter to add)
                    </label>
                    <button type="button" onClick={handleGenerateTags} className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300">
                      <Sparkles className="w-3 h-3" /> Generate tags
                    </button>
                  </div>
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
                  <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">{tagSuggestionNote || "Suggestions use available source details; edit them before saving."}</p>
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
        <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-3.5 gap-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
          <button
            onClick={() => {
              closeAddContent();
              resetState();
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-center"
          >
            Cancel
          </button>

          {step === "ready" && (
            <button
              onClick={handleSave}
              disabled={isSaving || !canImport}
              className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 rounded-xl text-xs sm:text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25 transition-all hover:scale-[1.02] active:scale-98 ${
                isSaving || !canImport ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
              }`}
            >
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>
                {isSaving
                  ? "Saving to Keeper..."
                  : !canImport
                  ? "Quota Reached (0 Remaining)"
                  : "Save Bookmark to Keeper"}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
