import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { Collection, SavedItem } from "@/types";
import type { GroundedContentAnalysis } from "@/services/content-analysis-service";
import { MediaAcquisitionService, type MediaAcquisitionResult } from "@/services/media/media-acquisition-service";
import { TranscriptionService } from "@/services/media/transcription-service";
import { ContentIntelligenceService } from "@/services/content-intelligence";
import { CollectionMatchingService } from "@/services/collection-matching-service";
import { TranscriptionResult } from "@/services/media/transcription-service";
import { VisualTextService } from "@/services/media/visual-text-service";
import { ContentAnalysisService } from "@/services/content-analysis-service";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface ClaimedJob {
  id: string;
  workspace_id: string;
  media_id: string;
  attempts: number;
}

interface StoredMedia {
  workspace_id: string;
  payload: SavedItem;
}

function safeSecretMatch(provided: string | null, expected: string | undefined): boolean {
  if (!provided || !expected) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

/** Called by a trusted scheduler/worker runner; it claims and processes at most one durable job. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!safeSecretMatch(request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null, process.env.AI_WORKER_SECRET || process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized worker." }, { status: 401 });
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.searchParams.has("batch") && !requestUrl.searchParams.has("single")) {
    requestUrl.searchParams.delete("batch");
    requestUrl.searchParams.set("single", "1");
    const concurrency = Math.min(5, Math.max(1, Number(requestUrl.searchParams.get("concurrency")) || 3));
    const results: Array<{ status: number; result: { processed?: boolean; status?: string; error?: string; message?: string } }> = await Promise.all(Array.from({ length: concurrency }, async () => {
      const childRequest = new NextRequest(requestUrl, { method: "POST", headers: request.headers });
      const response = await POST(childRequest);
      return { status: response.status, result: await response.json() as { processed?: boolean; status?: string; error?: string; message?: string } };
    }));
    return NextResponse.json({ processed: results.filter((result) => result.result.processed).length, workers: results });
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    return NextResponse.json({ error: "Supabase worker storage is not configured." }, { status: 503 });
  }

  const { data: claimed, error: claimError } = await admin.rpc("keeper_claim_ai_job");
  if (claimError) return NextResponse.json({ error: "Could not claim a processing job." }, { status: 503 });
  const job = (Array.isArray(claimed) ? claimed[0] : null) as ClaimedJob | null;
  if (!job) return NextResponse.json({ processed: false, message: "No due jobs." });
  let failureStatus = "EXTRACTION_FAILED";
  let processingItem: SavedItem | null = null;

  const failJob = async (error: unknown) => {
    const message = error instanceof Error ? error.message : "Media processing failed.";
    const terminal = job.attempts >= 5
      || failureStatus === "EXTRACTION_FAILED"
      || failureStatus === "TRANSCRIPTION_FAILED"
      || message.includes("not configured")
      || message.includes("too short for grounded AI analysis");
    const nextStatus = terminal ? "FAILED" : "QUEUED";
    const delaySeconds = Math.min(3600, 15 * 2 ** Math.max(0, job.attempts - 1));
    await admin.from("keeper_ai_jobs").update({
      status: nextStatus,
      last_error: message.slice(0, 1000),
      available_at: new Date(Date.now() + delaySeconds * 1000).toISOString(),
      locked_until: null,
      updated_at: new Date().toISOString(),
    }).eq("id", job.id);
    const persistedStatus = terminal ? failureStatus : "QUEUED";
    await admin.from("keeper_media").update({ processing_status: persistedStatus, updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
    const failedItem = processingItem;
    if (failedItem?.id) {
      const metadata = failedItem.metadata || {};
      const userTags = Array.isArray(metadata.userTags) ? metadata.userTags.filter((tag): tag is string => typeof tag === "string") : [];
      const priorOrganization = metadata.aiOrganization || {};
      const aiAssignedCollectionIds = Array.isArray(priorOrganization.aiAssignedCollectionIds)
        ? priorOrganization.aiAssignedCollectionIds.filter((id: unknown): id is string => typeof id === "string")
        : [];
      const provenance = { ...(failedItem.provenance || {}) };
      delete provenance.summary;
      delete provenance.generatedTags;
      delete provenance.aiGeneratedTags;
      delete provenance.collectionDecision;
      await admin.from("keeper_media").update({ payload: {
        ...failedItem,
        collections: (failedItem.collections || []).filter((id) => !aiAssignedCollectionIds.includes(id)),
        tags: userTags,
        topics: [],
        keyPoints: [],
        aiSummary: {
          quick: "Verified source content unavailable",
          standard: "Keeper could not complete grounded AI processing for this item.",
          detailed: message.slice(0, 1000),
        },
        contentStatus: "INSUFFICIENT_CONTENT",
        isLimited: true,
        limitedReason: message.slice(0, 1000),
        metadata: {
          ...metadata,
          aiGeneratedTags: [],
          aiProcessingStatus: persistedStatus,
          aiProcessingError: message.slice(0, 1000),
          aiOrganization: { ...priorOrganization, aiAssignedCollectionIds: [] },
        },
        provenance,
      }, updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
      await admin.from("keeper_media_analyses").delete().eq("media_id", job.media_id).eq("workspace_id", job.workspace_id);
    }
    return NextResponse.json({ processed: true, status: nextStatus, error: message }, { status: terminal ? 200 : 202 });
  };

  try {
    const { data: mediaRow, error: mediaError } = await admin.from("keeper_media")
      .select("workspace_id,payload").eq("id", job.media_id).eq("workspace_id", job.workspace_id).single();
    if (mediaError || !mediaRow) throw new Error("Queued media is unavailable in its workspace.");
    const media = mediaRow as unknown as StoredMedia;
    const item = media.payload;
    if (!item?.id || !item.url) throw new Error("Stored media payload is invalid.");
    processingItem = item;
    const priorOrganization = item.metadata?.aiOrganization || {};
    const priorAiCollectionIds = Array.isArray(priorOrganization.aiAssignedCollectionIds)
      ? priorOrganization.aiAssignedCollectionIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const manualCollectionIds = Array.isArray(priorOrganization.manualCollectionIds)
      ? priorOrganization.manualCollectionIds.filter((id: unknown): id is string => typeof id === "string")
      : [];
    const autoOrganizationDisabled = priorOrganization.autoOrganizationDisabled === true;
    const preservedCollections = (item.collections || []).filter((id) => !priorAiCollectionIds.includes(id));
    let acquiredMedia: MediaAcquisitionResult | null = null;
    await admin.from("keeper_media").update({ processing_status: "EXTRACTING", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);

    const { data: priorTranscript } = await admin.from("keeper_media_transcripts").select("*")
      .eq("media_id", job.media_id).eq("workspace_id", job.workspace_id).maybeSingle();
    const storedTranscript = priorTranscript as { text: string; status: string; language?: string; segments?: TranscriptionResult["segments"]; duration_seconds?: number; confidence?: number; provider?: string; model_version?: string; failure_reason?: string } | null;
    const trustedTranscriptProviders = new Set(["faster-whisper", "openai-audio-transcriptions", "platform_caption_track", "youtube_caption_track"]);
    let transcript = storedTranscript?.status === "COMPLETED" && storedTranscript.text?.trim()
      && storedTranscript.provider && trustedTranscriptProviders.has(storedTranscript.provider) ? storedTranscript : null;
    if (!transcript) {
      failureStatus = "TRANSCRIPTION_FAILED";
      await admin.from("keeper_ai_jobs").update({ status: "TRANSCRIBING", updated_at: new Date().toISOString() }).eq("id", job.id);
      await admin.from("keeper_media").update({ processing_status: "TRANSCRIBING", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
      const storedRepresentation = item.metadata?.contentRepresentation as { source?: string; status?: string; transcript?: string; language?: string } | undefined;
      let result: TranscriptionResult;
      if (storedRepresentation?.source === "platform_transcript" && storedRepresentation.status === "completed" && storedRepresentation.transcript?.trim()) {
        result = { status: "transcribed", text: storedRepresentation.transcript, segments: [], language: storedRepresentation.language, provider: "platform_caption_track", modelVersion: "source-provided" };
      } else {
        try {
          acquiredMedia = await MediaAcquisitionService.acquireMedia({
            url: item.url,
            platform: item.platform,
            contentId: item.metadata?.shortcode || item.id,
            mediaUrl: typeof item.metadata?.mediaUrl === "string" ? item.metadata.mediaUrl : undefined,
            workspaceId: job.workspace_id,
          });
          if (acquiredMedia.status === "available") {
            await admin.from("keeper_ai_jobs").update({ status: "MEDIA_FOUND", updated_at: new Date().toISOString() }).eq("id", job.id);
            await admin.from("keeper_media").update({ processing_status: "MEDIA_FOUND", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
          }
          const openAiSelected = process.env.TRANSCRIPTION_PROVIDER === "openai"
            || ((process.env.TRANSCRIPTION_PROVIDER || "auto") === "auto" && Boolean(process.env.OPENAI_TRANSCRIPTION_API_KEY || process.env.OPENAI_API_KEY));
          if (acquiredMedia.video && openAiSelected) {
            await admin.from("keeper_ai_jobs").update({ status: "EXTRACTING_AUDIO", updated_at: new Date().toISOString() }).eq("id", job.id);
            await admin.from("keeper_media").update({ processing_status: "EXTRACTING_AUDIO", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
          }
          result = await TranscriptionService.transcribe({
            mediaResult: acquiredMedia,
            contentId: item.metadata?.shortcode || item.id,
            workspaceId: job.workspace_id,
          });
        } catch (error) {
          result = { status: "failed", text: "", segments: [], provider: "transcription_service", modelVersion: "unknown", failureReason: error instanceof Error ? error.message : "Transcript extraction failed." };
        }
      }
      transcript = {
        text: result.text || "",
        status: result.status === "transcribed" ? "COMPLETED" : result.status === "no_speech" ? "NO_SPEECH" : result.status === "unavailable" ? "UNAVAILABLE" : "FAILED",
        language: result.language,
        segments: result.segments || [],
        provider: result.provider,
        model_version: result.modelVersion,
        failure_reason: result.failureReason,
      };
      const { error: transcriptError } = await admin.from("keeper_media_transcripts").upsert({
        media_id: job.media_id,
        workspace_id: job.workspace_id,
        text: result.text || "",
        segments: result.segments || [],
        duration_seconds: result.durationSeconds ?? null,
        confidence: result.confidence ?? null,
        extraction_method: result.provider,
        language: result.language || null,
        status: transcript.status,
        provider: result.provider,
        model_version: result.modelVersion,
        failure_reason: result.failureReason || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: "media_id" });
      if (transcriptError) throw transcriptError;
      if (transcript.status === "COMPLETED") {
        await admin.from("keeper_ai_jobs").update({ status: "TRANSCRIPT_READY", updated_at: new Date().toISOString() }).eq("id", job.id);
        await admin.from("keeper_media").update({ processing_status: "TRANSCRIPT_READY", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
      }
    }

    await admin.from("keeper_ai_jobs").update({ status: "ANALYZING", updated_at: new Date().toISOString() }).eq("id", job.id);
    await admin.from("keeper_media").update({ processing_status: "ANALYZING", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
    const sourceData = {
      platform: item.platform,
      canonicalUrl: item.url,
      contentId: item.metadata?.shortcode || item.id,
      creator: item.creator,
      title: item.provenance?.title?.source === "url_parse" ? "" : item.title,
      caption: item.metadata?.caption || item.description,
      description: item.description,
      transcript: transcript.text,
      bodyText: typeof item.metadata?.bodyText === "string" ? item.metadata.bodyText : item.description,
      thumbnailUrl: item.thumbnail,
      mediaUrl: typeof item.metadata?.mediaUrl === "string" ? item.metadata.mediaUrl : undefined,
      rawPlatformMetadata: item.metadata?.rawPlatformMetadata,
      contentType: item.contentType,
      retrievedAt: new Date().toISOString(),
      isRestricted: item.isLimited || false,
      provenance: item.provenance || {},
    };
    let visualText = "";
    let visualProvenance: Record<string, unknown> | undefined;
    const mediaForVisual = acquiredMedia || await MediaAcquisitionService.acquireMedia({
      url: item.url,
      platform: item.platform,
      contentId: `visual:${item.id}`,
      mediaUrl: typeof item.metadata?.mediaUrl === "string" ? item.metadata.mediaUrl : undefined,
      mimeType: item.contentType === "image" ? "image/*" : undefined,
      workspaceId: job.workspace_id,
    });
    const visualResult = await VisualTextService.extractVisualText({
      mediaResult: mediaForVisual,
      contentId: `${job.workspace_id}:${job.media_id}`,
    });
    if (visualResult.visualText) {
      visualText = visualResult.visualText;
      visualProvenance = {
        status: visualResult.status,
        text: visualResult.visualText,
        extractionMethod: "ocr_service",
        confidence: visualResult.confidence,
        sampleCount: visualResult.sampleCount,
        retrievedAt: new Date().toISOString(),
      };
    } else if (visualResult.status === "failed" || visualResult.status === "unavailable") {
      visualProvenance = { status: visualResult.status, reason: visualResult.failureReason, extractionMethod: "ocr_service" };
    }
    const { data: collectionRows, error: collectionError } = await admin.from("keeper_collections")
      .select("id,name,description,profile").eq("workspace_id", job.workspace_id);
    if (collectionError) throw collectionError;
    const { data: collectionProfileRows, error: profileError } = await admin.from("keeper_collection_profiles")
      .select("collection_id,terms").eq("workspace_id", job.workspace_id);
    if (profileError) throw profileError;
    const termsByCollection = new Map((collectionProfileRows || []).map((profile) => [profile.collection_id, profile.terms || []]));
    const collections = (collectionRows || []).map((entry) => ({
      id: entry.id, name: entry.name,
      description: [entry.description || "", ...(termsByCollection.get(entry.id) || [])].filter(Boolean).join(" "), color: "",
      icon: "Folder", createdAt: "", updatedAt: "",
      ...(entry.profile && typeof entry.profile === "object" ? entry.profile : {}),
    })) as Collection[];

    const transcriptionEvidence: TranscriptionResult = {
      status: transcript.status === "COMPLETED" ? "transcribed" : transcript.status === "NO_SPEECH" ? "no_speech" : transcript.status === "FAILED" ? "failed" : "unavailable",
      text: transcript.text || "", segments: transcript.segments || [], language: transcript.language,
      provider: transcript.provider || "none", modelVersion: transcript.model_version || "unknown",
      durationSeconds: transcript.duration_seconds,
      confidence: transcript.confidence,
      failureReason: transcript.failure_reason,
    };
    const storedContentRepresentation = item.metadata?.contentRepresentation as { source?: string; status?: string; transcript?: string } | undefined;
    const sourceHashtags = Array.isArray(item.metadata?.hashtags)
      ? item.metadata.hashtags.filter((tag: unknown): tag is string => typeof tag === "string" && Boolean(tag.trim())).map((tag: string) => tag.startsWith("#") ? tag : `#${tag}`)
      : [];
    const contentRepresentation = ContentIntelligenceService.normalizeRepresentation({
      transcript: transcriptionEvidence,
      ocrText: visualText,
      sourceTranscript: storedContentRepresentation?.source === "platform_transcript" && storedContentRepresentation.status === "completed" ? storedContentRepresentation.transcript : undefined,
      bodyText: [sourceData.bodyText, ...sourceHashtags].filter(Boolean).join("\n"),
      caption: [sourceData.caption, ...sourceHashtags].filter(Boolean).join("\n"),
      description: sourceData.description,
      title: undefined,
      transcriptFailureReason: transcript.failure_reason,
    });
    const isVideo = ["video", "reel", "short"].includes(item.contentType) || item.platform === "youtube-shorts";
    const hasVerifiedTranscript = transcriptionEvidence.status === "transcribed" || Boolean(storedContentRepresentation?.source === "platform_transcript" && storedContentRepresentation.status === "completed" && storedContentRepresentation.transcript?.trim());
    const hasVerifiedCaption = ["caption", "post_body", "description", "ocr_text"].includes(contentRepresentation.source)
      && contentRepresentation.text.trim().length >= 30;
    if (isVideo && !hasVerifiedTranscript && !hasVerifiedCaption) {
      failureStatus = "TRANSCRIPTION_FAILED";
      throw new Error(transcript.failure_reason || "A verified transcript could not be extracted for this video. No AI analysis was generated.");
    }
    if (contentRepresentation.text.trim().length < 30 || contentRepresentation.source === "title" || contentRepresentation.source === "none") {
      failureStatus = isVideo ? "TRANSCRIPTION_FAILED" : "EXTRACTION_FAILED";
      throw new Error(contentRepresentation.failureReason || "No verified source text, transcript, or OCR content was available. No AI analysis was generated.");
    }

    await admin.from("keeper_ai_jobs").update({ status: "ANALYZING", updated_at: new Date().toISOString() }).eq("id", job.id);
    await admin.from("keeper_media").update({ processing_status: "ANALYZING", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
    failureStatus = "ANALYSIS_FAILED";
    let groundedAnalysis: GroundedContentAnalysis;
    try {
      groundedAnalysis = await ContentAnalysisService.analyze(contentRepresentation);
    } catch (error) {
      // Source-backed tags remain useful for collection routing when the optional
      // model service is unavailable. Keep this extractive fallback explicit:
      // it does not invent summaries, asset classifications, or topics.
      const extractedTags = ContentIntelligenceService.generateTags(contentRepresentation.text);
      if (!extractedTags.length) throw error;
      const firstSentence = contentRepresentation.text.split(/[.!?\n]/).map((part) => part.trim()).find(Boolean) || "";
      groundedAnalysis = {
        summary: { quick: "", standard: "", detailed: "" },
        summaryEvidence: [], keyPoints: [], topics: extractedTags.slice(0, 5).map((tag) => tag.name),
        tags: extractedTags, contentType: item.contentType, contentIntent: "Reference",
        assetClassification: { isAsset: null, assetType: null, assetScore: null, reason: null, evidence: [], method: "source_tag_extraction" },
        collectionReason: "Matched existing collections using terms extracted from verified source text.",
        confidence: Math.min(0.7, Math.max(0.4, ...extractedTags.map((tag) => tag.confidence))),
        model: "source_tag_extraction",
      };
      if (firstSentence.length >= 30) {
        groundedAnalysis.summary = { quick: firstSentence, standard: firstSentence, detailed: firstSentence };
        groundedAnalysis.summaryEvidence = [firstSentence];
      }
    }
    const suppressedAiTags = Array.isArray(item.metadata?.suppressedAiTags)
      ? item.metadata.suppressedAiTags.filter((tag: unknown): tag is string => typeof tag === "string").map((tag: string) => tag.toLowerCase())
      : [];
    const generatedTags = groundedAnalysis.tags
      .filter((tag) => !suppressedAiTags.includes(tag.normalizedName.toLowerCase()) && !suppressedAiTags.includes(tag.name.toLowerCase()));
    const userTags = Array.isArray(item.metadata?.userTags)
      ? item.metadata.userTags.filter((tag: unknown): tag is string => typeof tag === "string")
      : [];
    const organizationTags = [...generatedTags, ...userTags.map((name) => ({
      name,
      normalizedName: name.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""),
      category: "Topic" as const,
      confidence: 1,
      source: "user" as const,
      evidence: `User-approved tag: ${name}`,
    }))];
    const assetClassification = groundedAnalysis.assetClassification;
    const generatedItemTags = [...new Set([...generatedTags.map((tag) => tag.name), ...userTags])].slice(0, 12);
    const enrichmentProvenance: Record<string, { value: unknown; source: string; basedOn?: string[]; retrievedAt?: string }> = {
      summary: { value: groundedAnalysis.summary.standard, source: "content_ai:" + groundedAnalysis.model,
        basedOn: groundedAnalysis.summaryEvidence, retrievedAt: new Date().toISOString() },
      contentRepresentation: { value: contentRepresentation, source: "universal_content_normalizer",
        basedOn: [contentRepresentation.source], retrievedAt: contentRepresentation.generatedAt },
      aiGeneratedTags: { value: groundedAnalysis.tags, source: "grounded_content_ai:" + groundedAnalysis.model,
        basedOn: [contentRepresentation.source], retrievedAt: contentRepresentation.generatedAt },
    };
    const enrichment = {
      summary: groundedAnalysis.summary,
      tags: generatedItemTags,
      topics: groundedAnalysis.topics,
      keyPoints: groundedAnalysis.keyPoints.map((point) => point.text),
      confidence: groundedAnalysis.confidence,
      status: "FULL_CONTENT" as const,
      provenance: enrichmentProvenance,
    };
    const enrichedItem: SavedItem = {
      ...item,
      collections: preservedCollections,
      metadata: {
        ...item.metadata,
        transcript: transcript.text || undefined,
        transcriptSegments: transcript.segments || [],
        contentRepresentation,
        aiGeneratedTags: generatedTags,
        assetClassification,
        aiProcessingStatus: "ANALYZING",
        ...(visualProvenance ? { visualText, visualOcr: visualProvenance } : {}),
      },
      aiSummary: enrichment.summary,
      tags: enrichment.tags,
      topics: enrichment.topics,
      keyPoints: enrichment.keyPoints,
      contentStatus: enrichment.status,
      provenance: {
        ...item.provenance,
        ...(visualProvenance ? { visualText: { value: visualProvenance, source: "ocr_service", basedOn: ["mediaUrl"], retrievedAt: new Date().toISOString() } } : {}),
        ...(transcript.text ? { transcript: {
          value: transcript.text, source: transcript.provider || "speech_to_text", retrievedAt: new Date().toISOString(),
        } } : {}),
        ...enrichment.provenance,
      },
    };

    await admin.from("keeper_ai_jobs").update({ status: "GENERATING_TAGS", updated_at: new Date().toISOString() }).eq("id", job.id);
    await admin.from("keeper_media").update({ processing_status: "GENERATING_TAGS", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
    failureStatus = "ORGANIZATION_FAILED";
    await admin.from("keeper_ai_jobs").update({ status: "MATCHING_COLLECTION", updated_at: new Date().toISOString() }).eq("id", job.id);
    await admin.from("keeper_media").update({ processing_status: "MATCHING_COLLECTION", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
    const organization = {
      primaryTopic: groundedAnalysis.topics[0] || generatedTags[0]?.name || "",
      secondaryTopics: groundedAnalysis.topics.slice(1),
      decision: "UNCERTAIN" as const,
      targetCollectionId: undefined as string | undefined,
      targetCollectionName: undefined as string | undefined,
      confidence: 0,
      reasoning: groundedAnalysis.collectionReason,
    };
    const collectionMatches = CollectionMatchingService.match(contentRepresentation.text, organizationTags, collections);
    const confidentCollectionMatch = CollectionMatchingService.selectBestMatch(collectionMatches);
    const collectionMatchIsAmbiguous = collectionMatches.length > 1
      && collectionMatches[0].confidence - collectionMatches[1].confidence < 0.12;
    const { data: learnedCorrections } = await admin.from("keeper_organization_corrections")
      .select("to_collection_id,media_tags,media_topic").eq("workspace_id", job.workspace_id).not("to_collection_id", "is", null);
    const currentTerms = new Set(enrichedItem.tags.map((tag) => tag.toLowerCase().trim()).filter(Boolean));
    let learnedMatch: { id: string; score: number } | undefined;
    for (const correction of learnedCorrections || []) {
      const learnedTerms = new Set((correction.media_tags || []).map((tag: string) => tag.toLowerCase().trim()).filter(Boolean));
      if (correction.media_topic) learnedTerms.add(correction.media_topic.toLowerCase().trim());
      const union = new Set([...currentTerms, ...learnedTerms]);
      if (union.size < 2) continue;
      const intersection = [...currentTerms].filter((term) => learnedTerms.has(term)).length;
      const score = intersection / union.size;
      const collectionId = correction.to_collection_id as string;
      if (score >= 0.65 && collections.some((collection) => collection.id === collectionId) && (!learnedMatch || score > learnedMatch.score)) {
        learnedMatch = { id: collectionId, score };
      }
    }
    const manuallySelectedCollection = manualCollectionIds.length
      ? collections.find((collection) => collection.id === manualCollectionIds[0])
      : undefined;
    const matchedCollection = manuallySelectedCollection || (learnedMatch ? collections.find((collection) => collection.id === learnedMatch?.id) : undefined);
    const topCollectionMatch = collectionMatches[0];
    let selectedCollection = matchedCollection || (confidentCollectionMatch
      ? collections.find((collection) => collection.id === confidentCollectionMatch.collectionId)
      : undefined);
    let selectedMatchScore = manuallySelectedCollection ? 1 : matchedCollection && learnedMatch ? learnedMatch.score : topCollectionMatch?.confidence || 0;
    if (autoOrganizationDisabled && !manuallySelectedCollection) selectedCollection = undefined;
    const collectionTopic = CollectionMatchingService.selectCollectionTopic(
      generatedTags,
      groundedAnalysis.confidence,
      assetClassification
    );
    const inferredCollectionCategory = CollectionMatchingService.inferCollectionCategory(organizationTags.map((tag) => tag.name));
    const collectionNameToCreate = inferredCollectionCategory || collectionTopic?.name;
    let suggestedNewCollection: { name: string; confidence: number; reason: string; collectionId?: string; created?: boolean } | undefined;
    let autoCreatedCollection: Collection | undefined;
    let semanticallyRelatedCollection: Collection | undefined;
    if (!autoOrganizationDisabled && !selectedCollection && !collectionMatchIsAmbiguous && collectionNameToCreate) {
      const duplicateCollection = collections.find((collection) => {
        const candidate = CollectionMatchingService.match(
          `${collectionNameToCreate} ${contentRepresentation.text}`,
          [{
            name: collectionNameToCreate,
            normalizedName: collectionNameToCreate.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, ""),
            category: "Topic", confidence: 1, source: "user", evidence: "User-approved or source-grounded category tag.",
          }],
          [collection],
          1
        )[0];
        return candidate && candidate.confidence >= 0.55;
      });
      if (duplicateCollection) {
        semanticallyRelatedCollection = duplicateCollection;
        selectedMatchScore = Math.max(selectedMatchScore, inferredCollectionCategory ? 0.88 : 0.55);
      } else {
        const collectionName = collectionNameToCreate.trim();
        const description = `Workspace collection for content categorized as ${collectionName}.`;
        const { data: createdRow, error: createError } = await admin.rpc("keeper_get_or_create_ai_collection", {
          p_workspace_id: job.workspace_id,
          p_name: collectionName,
          p_description: description,
          p_terms: [...new Set([collectionName, ...generatedTags.slice(0, 5).map((tag) => tag.name)])],
        });
        if (createError || !createdRow) throw createError || new Error("AI collection could not be created.");
        const collectionRecord = createdRow as { id: string; name: string; description: string; created: boolean };
        autoCreatedCollection = { id: collectionRecord.id, name: collectionRecord.name, description: collectionRecord.description, color: "", icon: "Folder", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        collections.push(autoCreatedCollection);
        suggestedNewCollection = {
          name: collectionRecord.name,
          confidence: inferredCollectionCategory ? Math.max(0.78, groundedAnalysis.confidence) : Math.min(collectionTopic?.confidence || 0, groundedAnalysis.confidence),
          collectionId: collectionRecord.id,
          created: collectionRecord.created,
          reason: inferredCollectionCategory
            ? `${collectionRecord.created ? "Created" : "Reused"} the ${inferredCollectionCategory} collection from a matching category tag.`
            : `${collectionRecord.created ? "Created" : "Reused an existing same-name collection"} for a source-evidenced ${assetClassification.assetType || "reusable"} topic; analysis confidence ${Math.round(groundedAnalysis.confidence * 100)}%, asset score ${Math.round((assetClassification.assetScore || 0) * 100)}%.`,
        };
      }
    }
    const finalSelectedCollection = selectedCollection || autoCreatedCollection || semanticallyRelatedCollection;
    const groundedPrimaryTopic = generatedTags[0]?.name || userTags[0] || "";
    const groundedSecondaryTopics = [...generatedTags.slice(1).map((tag) => tag.name), ...userTags].slice(0, 4);
    const finalOrganization = manuallySelectedCollection
      ? { ...organization, primaryTopic: groundedPrimaryTopic, secondaryTopics: groundedSecondaryTopics, decision: "APPLIED" as const,
        targetCollectionId: manuallySelectedCollection.id, targetCollectionName: manuallySelectedCollection.name,
        confidence: 1, reasoning: "Kept the collection selected by the user." }
      : matchedCollection && learnedMatch
      ? { ...organization, primaryTopic: groundedPrimaryTopic, secondaryTopics: groundedSecondaryTopics, decision: "APPLIED" as const, targetCollectionId: matchedCollection.id,
        targetCollectionName: matchedCollection.name, confidence: Math.max(organization.confidence, learnedMatch.score),
        reasoning: `Applied a prior workspace correction with ${Math.round(learnedMatch.score * 100)}% tag/topic similarity.` }
      : finalSelectedCollection
      ? { ...organization, primaryTopic: groundedPrimaryTopic, secondaryTopics: groundedSecondaryTopics,
        decision: autoCreatedCollection || selectedMatchScore >= 0.62 ? "APPLIED" as const : "SUGGESTED" as const,
        targetCollectionId: finalSelectedCollection.id, targetCollectionName: finalSelectedCollection.name,
        confidence: autoCreatedCollection ? suggestedNewCollection?.confidence || 0 : semanticallyRelatedCollection ? Math.max(selectedMatchScore, 0.55) : selectedMatchScore,
        reasoning: autoCreatedCollection ? suggestedNewCollection?.reason : semanticallyRelatedCollection ? `Reused the semantically similar workspace collection ${semanticallyRelatedCollection.name}.` : topCollectionMatch?.reasoning || organization.reasoning }
      : { ...organization, primaryTopic: groundedPrimaryTopic, secondaryTopics: groundedSecondaryTopics, decision: "UNCERTAIN" as const, targetCollectionId: undefined, targetCollectionName: undefined,
        confidence: 0, reasoning: autoOrganizationDisabled ? "The user explicitly left this item uncategorized." : "No existing collection met the grounded content-match threshold." };

    await admin.from("keeper_ai_jobs").update({ status: "ORGANIZING", updated_at: new Date().toISOString() }).eq("id", job.id);
    await admin.from("keeper_media").update({ processing_status: "ORGANIZING", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
    const analysis = {
      summary: enrichedItem.aiSummary,
      primaryTopic: finalOrganization.primaryTopic,
      tags: enrichedItem.tags,
      collectionId: finalOrganization.confidence >= 0.62 ? finalOrganization.targetCollectionId : null,
      collectionIds: finalOrganization.targetCollectionId && finalOrganization.decision === "APPLIED"
        ? [finalOrganization.targetCollectionId]
        : [],
      collectionMatches,
      suggestedNewCollection,
      assetClassification,
      confidence: finalOrganization.confidence,
      analysis: finalOrganization,
    };
    const { error: analysisError } = await admin.from("keeper_media_analyses").upsert({
      media_id: job.media_id,
      workspace_id: job.workspace_id,
      summary: analysis.summary,
      primary_topic: analysis.primaryTopic,
      tags: analysis.tags,
      collection_id: analysis.collectionId,
      confidence: analysis.confidence,
      analysis: { ...analysis.analysis, collectionMatches, suggestedNewCollection },
      updated_at: new Date().toISOString(),
    }, { onConflict: "media_id" });
    if (analysisError) throw analysisError;
    const updatedPayload: SavedItem = {
      ...enrichedItem,
      tags: analysis.tags,
      metadata: { ...enrichedItem.metadata, aiOrganization: {
        ...finalOrganization, collectionMatches, suggestedNewCollection,
        manualCollectionIds,
        autoOrganizationDisabled,
        aiAssignedCollectionIds: [...new Set([
          ...analysis.collectionIds,
          ...(analysis.collectionId && !manualCollectionIds.includes(analysis.collectionId) ? [analysis.collectionId] : []),
        ])],
      } },
      provenance: { ...enrichedItem.provenance, collectionDecision: {
        value: { ...finalOrganization, collectionMatches, suggestedNewCollection }, source: "workspace_collection_matcher", basedOn: ["contentRepresentation", "aiGeneratedTags"],
        retrievedAt: new Date().toISOString(),
      } },
      ...(analysis.collectionId ? { collectionId: analysis.collectionId } : {}),
      collections: analysis.collectionIds.length || analysis.collectionId
        ? [...new Set([...(enrichedItem.collections || []), ...analysis.collectionIds, ...(analysis.collectionId ? [analysis.collectionId] : [])])]
        : (enrichedItem.collections || []),
    };
    const generatedContent = {
      title: updatedPayload.provenance?.title?.source === "url_parse" ? null : updatedPayload.title || null,
      summary: updatedPayload.aiSummary.standard || null,
      detailedDescription: updatedPayload.aiSummary.detailed || null,
      keyPoints: updatedPayload.keyPoints || [],
      topics: updatedPayload.topics || [],
      keywords: generatedTags.map((tag) => tag.name),
      tags: analysis.tags,
      contentType: updatedPayload.contentType || null,
      assetClassification,
      collectionReason: finalOrganization.reasoning || null,
    };
    updatedPayload.metadata = { ...updatedPayload.metadata, generatedContent };
    await admin.from("keeper_ai_jobs").update({ status: "INDEXING", updated_at: new Date().toISOString() }).eq("id", job.id);
    await admin.from("keeper_media").update({ processing_status: "INDEXING", updated_at: new Date().toISOString() }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
    failureStatus = "INDEXING_FAILED";
    const { error: saveError } = await admin.from("keeper_media").update({
      payload: updatedPayload, processing_status: "COMPLETED", updated_at: new Date().toISOString(),
    }).eq("id", job.media_id).eq("workspace_id", job.workspace_id);
    if (saveError) throw saveError;
    await admin.from("keeper_ai_jobs").update({ status: "COMPLETED", locked_until: null, last_error: null, updated_at: new Date().toISOString() }).eq("id", job.id);
    const { error: memoryError } = await admin.rpc("keeper_record_ai_assignment", {
      p_workspace_id: job.workspace_id,
      p_media_id: job.media_id,
      p_collection_id: analysis.collectionId,
      p_topic: analysis.primaryTopic || null,
      p_tags: analysis.tags,
    });
    if (memoryError) throw memoryError;
    return NextResponse.json({ processed: true, status: "COMPLETED", mediaId: job.media_id });
  } catch (error) {
    console.error("AI media job failed", { jobId: job.id, workspaceId: job.workspace_id, error });
    return failJob(error);
  }
}

export async function GET(request: NextRequest) {
  return POST(request);
}
