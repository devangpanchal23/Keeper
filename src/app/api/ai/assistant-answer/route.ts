import { NextRequest, NextResponse } from "next/server";
import type { ContentType, Platform, SavedItem } from "@/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AssistantAnswerService } from "@/services/assistant-answer-service";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const PLATFORMS = new Set<Platform>(["youtube", "youtube-shorts", "instagram", "reddit", "linkedin", "x", "twitter", "tiktok", "pinterest", "facebook", "threads", "blog", "website", "github"]);
const CONTENT_TYPES = new Set<ContentType>(["video", "short", "reel", "article", "post", "image", "website", "product", "pdf", "other"]);

function text(value: unknown, limit: number): string {
  return typeof value === "string" ? value.slice(0, limit) : "";
}

function stringList(value: unknown, limit: number): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string").slice(0, limit).map((entry) => entry.slice(0, 300)) : [];
}

function sanitizeItem(value: unknown): SavedItem | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || typeof raw.title !== "string" || raw.id.length > 160 || !raw.title.trim()) return null;
  const metadataRaw = raw.metadata && typeof raw.metadata === "object" ? raw.metadata as Record<string, unknown> : {};
  const summaryRaw = raw.aiSummary && typeof raw.aiSummary === "object" ? raw.aiSummary as Record<string, unknown> : {};
  const creatorRaw = raw.creator && typeof raw.creator === "object" ? raw.creator as Record<string, unknown> : {};
  const representationRaw = metadataRaw.contentRepresentation && typeof metadataRaw.contentRepresentation === "object"
    ? metadataRaw.contentRepresentation as Record<string, unknown>
    : {};
  const provenanceRaw = raw.provenance && typeof raw.provenance === "object" ? raw.provenance as Record<string, unknown> : {};
  const transcript = metadataRaw.transcript;
  const transcriptText = typeof transcript === "string"
    ? transcript.slice(0, 10_000)
    : transcript && typeof transcript === "object" && typeof (transcript as Record<string, unknown>).text === "string"
      ? ((transcript as Record<string, unknown>).text as string).slice(0, 10_000)
      : "";
  const platform = typeof raw.platform === "string" && PLATFORMS.has(raw.platform as Platform) ? raw.platform as Platform : "website";
  const contentType = typeof raw.contentType === "string" && CONTENT_TYPES.has(raw.contentType as ContentType) ? raw.contentType as ContentType : "other";
  const transcriptProvenance = provenanceRaw.transcript && typeof provenanceRaw.transcript === "object" ? provenanceRaw.transcript as Record<string, unknown> : {};
  const captionProvenance = provenanceRaw.caption && typeof provenanceRaw.caption === "object" ? provenanceRaw.caption as Record<string, unknown> : {};
  return {
    id: raw.id,
    title: text(raw.title, 300),
    url: "",
    thumbnail: "",
    platform,
    contentType,
    creator: { name: text(creatorRaw.name, 160) || "Saved creator" },
    description: text(raw.description, 3000),
    savedDate: "",
    tags: stringList(raw.tags, 20),
    favorite: false,
    archived: false,
    trashed: false,
    aiSummary: {
      quick: text(summaryRaw.quick, 1500),
      standard: text(summaryRaw.standard, 3000),
      detailed: text(summaryRaw.detailed, 3000),
    },
    keyPoints: stringList(raw.keyPoints, 12),
    topics: stringList(raw.topics, 20),
    personalNotes: text(raw.personalNotes, 1500),
    metadata: {
      transcript: transcriptText,
      caption: text(metadataRaw.caption, 6000),
      contentRepresentation: {
        type: "source_text",
        text: text(representationRaw.text, 10_000),
        source: "description",
        extractionMethod: "assistant_context",
        confidence: 1,
        status: "completed",
        generatedAt: new Date().toISOString(),
      },
    },
    provenance: {
      transcript: { value: text(transcriptProvenance.value, 10_000), source: "assistant_context" },
      caption: { value: text(captionProvenance.value, 6000), source: "assistant_context" },
    },
  };
}

export async function POST(request: NextRequest) {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Assistant model access is unavailable." }, { status: 503 });
  }
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return NextResponse.json({ error: "Sign in to use grounded AI answers." }, { status: 401 });

  if (process.env.ASSISTANT_EXTERNAL_SYNTHESIS_ENABLED !== "true") {
    return NextResponse.json({ error: "External AI synthesis is disabled by workspace policy." }, { status: 403 });
  }

  const rawBody = await request.text();
  if (rawBody.length > 8_000) return NextResponse.json({ error: "Assistant request is too large." }, { status: 413 });
  let body: unknown;
  try { body = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid assistant request." }, { status: 400 }); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid assistant request." }, { status: 400 });
  const input = body as Record<string, unknown>;
  if (input.allowExternalSynthesis !== true) return NextResponse.json({ error: "Explicit external AI consent is required." }, { status: 403 });
  if (typeof input.query !== "string" || !input.query.trim() || input.query.length > 500 || typeof input.collectionId !== "string" || !Array.isArray(input.items) || input.items.length > 8) {
    return NextResponse.json({ error: "The assistant needs a short question and up to eight saved source IDs." }, { status: 400 });
  }
  if (input.collectionId !== "all") {
    const { data: collection, error: collectionError } = await supabase.from("keeper_collections")
      .select("id").eq("workspace_id", user.id).eq("id", input.collectionId).maybeSingle();
    if (collectionError) return NextResponse.json({ error: "Workspace collection could not be verified." }, { status: 503 });
    if (!collection) return NextResponse.json({ error: "The selected collection is not available in this workspace." }, { status: 403 });
  }
  const candidateInputs: unknown[] = input.items;
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const requestedMediaIds = [...new Set(candidateInputs.flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const metadata = (entry as Record<string, unknown>).metadata;
    if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
    const mediaId = (metadata as Record<string, unknown>).serverMediaId;
    return typeof mediaId === "string" && uuidPattern.test(mediaId) ? [mediaId] : [];
  }))];
  if (!requestedMediaIds.length) return NextResponse.json({ error: "No workspace-owned saved sources were provided." }, { status: 400 });
  const { data: ownedRows, error: ownedRowsError } = await supabase.from("keeper_media")
    .select("id,payload").eq("workspace_id", user.id).in("id", requestedMediaIds);
  if (ownedRowsError) return NextResponse.json({ error: "Workspace sources could not be verified." }, { status: 503 });
  const items = (ownedRows || []).flatMap((row) => {
    if (!row.payload || typeof row.payload !== "object" || Array.isArray(row.payload)) return [];
    const payload = row.payload as Record<string, unknown>;
    if (input.collectionId !== "all") {
      const memberships = Array.isArray(payload.collections) ? payload.collections : [];
      if (payload.collectionId !== input.collectionId && !memberships.includes(input.collectionId)) return [];
    }
    const savedItem = sanitizeItem(row.payload);
    if (!savedItem) return [];
    return [{ ...savedItem, metadata: { ...savedItem.metadata, serverMediaId: row.id } }];
  });
  if (!items.length) return NextResponse.json({ error: "No workspace-owned saved sources were found." }, { status: 404 });
  try {
    const result = await AssistantAnswerService.generate(input.query.trim(), items);
    if (!result) return NextResponse.json({ error: "Grounded answer generation is not configured." }, { status: 503 });
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Grounded answer generation failed. Local evidence search remains available." }, { status: 502 });
  }
}
