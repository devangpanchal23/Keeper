import { NextRequest, NextResponse } from "next/server";
import { IngestionService } from "@/services/ingestion-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { AIProcessingState } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  try {
    const body = await req.json();
    const { url, customCollectionId } = body;

    let supabase;
    let user;
    try {
      supabase = await createSupabaseServerClient();
      const auth = await supabase.auth.getUser();
      user = auth.data.user;
    } catch {
      return NextResponse.json({ success: false, error: "Server-side Supabase authentication is not configured." }, { status: 503 });
    }
    if (!user) return NextResponse.json({ success: false, error: "Sign in before importing content." }, { status: 401 });

    if (Array.isArray(body.collections)) {
      const ownedCollections = body.collections.slice(0, 500).flatMap((collection: unknown) => {
        if (!collection || typeof collection !== "object") return [];
        const value = collection as Record<string, unknown>;
        if (typeof value.id !== "string" || typeof value.name !== "string") return [];
        return [{ workspace_id: user.id, id: value.id.slice(0, 120), name: value.name.slice(0, 120),
          description: typeof value.description === "string" ? value.description.slice(0, 1000) : null,
          profile: { color: value.color, icon: value.icon } }];
      });
      if (ownedCollections.length) {
        const { error } = await supabase.from("keeper_collections").upsert(ownedCollections, { onConflict: "workspace_id,id" });
        if (error) {
          console.error("[api/ingest] Workspace collection sync failed", { code: error.code, message: error.message });
          const missingTable = error.code === "42P01" || error.code === "PGRST205";
          const missingPrivilege = error.code === "42501";
          const message = missingTable
            ? "Keeper's Supabase schema is incomplete. In the matching project, run 202610060001_billing.sql, then 202610070001_ai_media_architect.sql, then 202610070002_keeper_collection_sync_grants.sql, and retry."
            : missingPrivilege
              ? "Supabase denied collection sync. Apply the latest Keeper collection grants migration, then retry."
              : "Workspace collections could not be synchronized. Check the server logs for the Supabase error code, then retry.";
          return NextResponse.json({ success: false, error: message }, { status: 503 });
        }
      }
    }

    if (!url || typeof url !== "string" || !url.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "Missing required parameter 'url'.",
        },
        { status: 400 }
      );
    }

    const trimmedUrl = url.trim();

    // Basic scheme check
    if (!trimmedUrl.startsWith("http://") && !trimmedUrl.startsWith("https://")) {
      return NextResponse.json(
        {
          success: false,
          error: "URL must begin with http:// or https://",
        },
        { status: 400 }
      );
    }

    const result = await IngestionService.processUrl(trimmedUrl, {
      userId: user.id,
      customCollectionId,
      aiEnrichmentMode: "fast_metadata",
      initialMetadata: body.initialMetadata && typeof body.initialMetadata === "object"
        ? body.initialMetadata as { title?: string; creatorName?: string; caption?: string; hashtags?: string[]; fbid?: string; thumbnailUrl?: string; savedTimestamp?: number | string; collectionName?: string }
        : undefined,
      skipPersistence: true, // Let the frontend store according to user workspace session
    });
    if (JSON.stringify(result.savedItem).length > 1_000_000) {
      return NextResponse.json({ success: false, error: "This item's metadata is too large to store." }, { status: 413 });
    }

    const idempotencyKey = typeof body.idempotencyKey === "string" && body.idempotencyKey.length <= 200
      ? body.idempotencyKey
      : crypto.randomUUID();
    const { data: importResult, error: importError } = await supabase.rpc("keeper_import_media", {
      p_canonical_url: result.savedItem.url,
      p_payload: result.savedItem,
      p_idempotency_key: idempotencyKey,
    });
    if (importError) {
      const quotaReached = importError.message.includes("CREDIT_LIMIT_REACHED");
      return NextResponse.json({ success: false, error: quotaReached ? "Your current plan has no imports remaining." : "The import could not be committed." }, { status: quotaReached ? 402 : 503 });
    }
    const committedImport = importResult as { media_id?: string; status?: string; duplicate?: boolean } | null;
    if (committedImport?.media_id) {
      result.savedItem.metadata = {
        ...result.savedItem.metadata,
        serverMediaId: committedImport.media_id,
        aiProcessingStatus: (committedImport.status === "QUEUED" ? "QUEUED" : "PENDING") as AIProcessingState,
      };
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
        job: importResult,
        durationMs: Date.now() - startTime,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal ingestion failure.";
    return NextResponse.json(
      {
        success: false,
        error: message,
        durationMs: Date.now() - startTime,
      },
      { status: 422 }
    );
  }
}
