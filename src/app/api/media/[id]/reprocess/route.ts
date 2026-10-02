import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ContentService } from "@/services/content-service";
import { IngestionService } from "@/services/ingestion-service";
import { SavedItem } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace media is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to view this item." }, { status: 401 });
  const { id } = await context.params;
  const { data: row, error } = await supabase.from("keeper_media")
    .select("payload,processing_status").eq("id", id).eq("workspace_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Workspace media could not be loaded." }, { status: 503 });
  if (!row) return NextResponse.json({ error: "Item not found in this workspace." }, { status: 404 });
  const { data: job } = await supabase.from("keeper_ai_jobs").select("last_error")
    .eq("media_id", id).eq("workspace_id", user.id).maybeSingle();
  const payload = row.payload as SavedItem;
  return NextResponse.json({ data: payload, processingStatus: row.processing_status, processingError: job?.last_error || null }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace AI processing is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to reprocess this item." }, { status: 401 });

  const { id } = await context.params;
  const { data: row, error: loadError } = await supabase.from("keeper_media")
    .select("id,payload").eq("id", id).eq("workspace_id", user.id).maybeSingle();
  if (loadError) return NextResponse.json({ error: "Workspace media could not be loaded for reprocessing." }, { status: 503 });
  if (!row?.payload || typeof row.payload !== "object") return NextResponse.json({ error: "This item is not in the signed-in workspace." }, { status: 404 });

  const original = row.payload as SavedItem;
  try {
    const result = await IngestionService.processUrl(original.url, {
      userId: user.id,
      aiEnrichmentMode: "fast_metadata",
      skipPersistence: true,
      bypassCache: true,
      initialMetadata: {
        title: original.title,
        creatorName: original.creator?.name,
        caption: original.metadata?.caption || original.description,
        bodyText: typeof original.metadata?.bodyText === "string" ? original.metadata.bodyText : undefined,
        hashtags: original.metadata?.hashtags,
        fbid: original.metadata?.fbid,
        thumbnailUrl: original.metadata?.thumbnailSource === "fallback" ? undefined : original.thumbnail,
        savedTimestamp: original.savedDate,
      },
    });
    const refreshed = ContentService.safeMerge(original, result.savedItem);
    const userTags = Array.isArray(original.metadata?.userTags)
      ? original.metadata.userTags.filter((tag: unknown): tag is string => typeof tag === "string")
      : [];
    const suppressedAiTags = Array.isArray(original.metadata?.suppressedAiTags)
      ? original.metadata.suppressedAiTags.filter((tag: unknown): tag is string => typeof tag === "string")
      : [];
    const aiGeneratedTags = result.savedItem.metadata?.aiGeneratedTags || [];
    const allowedAiTags = aiGeneratedTags
      .filter((tag) => !suppressedAiTags.some((suppressed) => suppressed.toLowerCase() === tag.normalizedName || suppressed.toLowerCase() === tag.name.toLowerCase()))
      .map((tag) => tag.name);
    refreshed.tags = [...new Set([...allowedAiTags, ...userTags])];
    refreshed.aiSummary = result.savedItem.aiSummary;
    refreshed.keyPoints = result.savedItem.keyPoints;
    refreshed.topics = result.savedItem.topics;
    refreshed.metadata = {
      ...refreshed.metadata,
      serverMediaId: id,
      aiProcessingStatus: "QUEUED",
      userTags: original.metadata?.userTags || [],
      suppressedAiTags: original.metadata?.suppressedAiTags || [],
    };
    const { data: queued, error: queueError } = await supabase.rpc("keeper_reprocess_media", {
      p_media_id: id,
      p_payload: refreshed,
    });
    if (queueError) {
      const status = queueError.code === "P0002" ? 404 : queueError.code === "22023" ? 400 : 503;
      return NextResponse.json({ error: status === 404 ? "This item is not in the signed-in workspace." : "The AI processing job could not be queued." }, { status });
    }
    return NextResponse.json({ success: true, job: queued, data: refreshed }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[api/media/reprocess] Source refresh failed", { mediaId: id, workspaceId: user.id, error });
    return NextResponse.json({ error: "Source refresh failed. The saved item was preserved; retry when the source is available." }, { status: 503 });
  }
}
