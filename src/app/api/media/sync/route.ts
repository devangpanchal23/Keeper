import { NextRequest, NextResponse } from "next/server";
import { createBackendAdminClient, createBackendServerClient } from "@/lib/database/backend-client";
import { ContentService } from "@/services/content-service";
import { getCanonicalIdentityKey, getAuthoritativeCanonicalUrl } from "@/lib/media-identity";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertBackendConfiguration } from "@/lib/database/provider";
import { SavedItem } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { localItems?: SavedItem[] } = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const localItems = Array.isArray(body.localItems) ? body.localItems : [];

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ code: "BACKEND_NOT_CONFIGURED", error: "Workspace media storage is not configured." }, { status: 503 });
  }
  try {
    assertBackendConfiguration();
  } catch {
    return NextResponse.json({ code: "BACKEND_NOT_CONFIGURED", error: "Workspace media storage is not configured." }, { status: 503 });
  }

  try {
    const supabase = await createBackendServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ code: "AUTH_SERVICE_UNAVAILABLE", error: "Could not verify your workspace session." }, { status: 503 });
    if (!user) {
      return NextResponse.json({ code: "AUTH_REQUIRED", error: "Sign in to sync workspace media." }, { status: 401 });
    }

    const admin = createBackendAdminClient();

    // Fetch existing server items for this user
    const { data: existingRows, error: fetchError } = await admin
      .from("keeper_media")
      .select("id,payload,processing_status,canonical_url,created_at,updated_at")
      .eq("workspace_id", user.id)
      .order("created_at", { ascending: false });

    if (fetchError) {
      return NextResponse.json({ error: "Could not retrieve existing workspace media." }, { status: 503 });
    }

    const serverByKey = new Map<string, { id: string; payload: SavedItem; status: string; canonical_url: string }>();

    for (const row of existingRows || []) {
      if (row.payload && typeof row.payload === "object") {
        const key = getCanonicalIdentityKey(row.canonical_url || (row.payload as SavedItem).url);
        if (!key) continue;

        const existing = serverByKey.get(key);
        if (existing) {
          // Merge duplicate row and queue redundant row for deletion
          existing.payload = ContentService.safeMerge(existing.payload, row.payload as SavedItem);
        } else {
          serverByKey.set(key, {
            id: row.id,
            payload: row.payload as SavedItem,
            status: row.processing_status,
            canonical_url: row.canonical_url,
          });
        }
      }
    }

    // Process incoming local items: if not on server, insert; if present, merge updates
    for (const localItem of localItems) {
      if (!localItem || !localItem.url || typeof localItem.url !== "string") continue;
      const key = getCanonicalIdentityKey(localItem.url);
      if (!key) continue;

      const existing = serverByKey.get(key);
      const authoritativeUrl = getAuthoritativeCanonicalUrl(localItem.url);

      if (existing) {
        // Safe-merge local updates into existing server item, preserving chosen collection
        const incomingColId = localItem.collectionId;
        const mergedCollections = Array.from(
          new Set([
            ...(existing.payload.collections || []),
            ...(localItem.collections || []),
            ...(incomingColId ? [incomingColId] : []),
            ...(existing.payload.collectionId ? [existing.payload.collectionId] : []),
          ])
        );
        const mergedPayload: SavedItem = {
          ...ContentService.safeMerge(existing.payload, localItem),
          collectionId: incomingColId || existing.payload.collectionId,
          collections: mergedCollections,
        };

        if (JSON.stringify(mergedPayload) !== JSON.stringify(existing.payload)) {
          const { error: updateError } = await admin
            .from("keeper_media")
            .update({
              canonical_url: authoritativeUrl,
              payload: mergedPayload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .eq("workspace_id", user.id);
          if (updateError) throw new Error("Workspace media update failed.");
          existing.payload = mergedPayload;
        }
      } else {
        // Local-only legacy item: insert into server database with normalized canonical URL
        const processingStatus = localItem.metadata?.aiProcessingStatus || "PENDING";
        const { data: insertedRows, error: insertError } = await admin
          .from("keeper_media")
          .insert({
            workspace_id: user.id,
            canonical_url: authoritativeUrl,
            payload: localItem,
            processing_status: processingStatus,
          })
          .select("id");

        if (!insertError) {
          const newId = ((insertedRows as unknown as Array<{ id: string }>) || [])[0]?.id || localItem.metadata?.serverMediaId || "";
          serverByKey.set(key, {
            id: newId,
            payload: localItem,
            status: processingStatus,
            canonical_url: authoritativeUrl,
          });
        } else if (insertError.code === "23505") {
          const { data: conflictRows, error: conflictReadError } = await admin
            .from("keeper_media")
            .select("id,payload,processing_status,canonical_url")
            .eq("workspace_id", user.id)
            .eq("canonical_url", authoritativeUrl)
            .limit(1);
          const conflictRow = conflictRows?.[0];
          if (conflictReadError || !conflictRow?.payload) throw new Error("Workspace media conflict could not be reconciled.");
          const mergedPayload = ContentService.safeMerge(conflictRow.payload as SavedItem, localItem);
          const { error: conflictUpdateError } = await admin
            .from("keeper_media")
            .update({ payload: mergedPayload, updated_at: new Date().toISOString() })
            .eq("id", conflictRow.id)
            .eq("workspace_id", user.id);
          if (conflictUpdateError) throw new Error("Workspace media conflict could not be saved.");
          serverByKey.set(key, {
            id: conflictRow.id,
            payload: mergedPayload,
            status: conflictRow.processing_status,
            canonical_url: conflictRow.canonical_url,
          });
        } else {
          throw new Error("Workspace media insert failed.");
        }
      }
    }

    // Final authoritative server library
    const { data: finalRows, error: finalReadError } = await admin
      .from("keeper_media")
      .select("id,payload,processing_status,canonical_url,created_at,updated_at")
      .eq("workspace_id", user.id)
      .order("created_at", { ascending: false });

    if (finalReadError) {
      return NextResponse.json({ code: "MEDIA_READ_FAILED", error: "Workspace media is temporarily unavailable." }, { status: 503 });
    }

    const seenFinalKeys = new Set<string>();
    const items: SavedItem[] = [];

    for (const row of finalRows || []) {
      if (!row.payload || typeof row.payload !== "object") continue;
      const rawItem = row.payload as SavedItem;
      const key = getCanonicalIdentityKey(row.canonical_url || rawItem.url);
      if (key && seenFinalKeys.has(key)) continue;
      if (key) seenFinalKeys.add(key);

      items.push({
        ...rawItem,
        metadata: {
          ...rawItem.metadata,
          serverMediaId: row.id,
          aiProcessingStatus: row.processing_status,
        },
      });
    }

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      syncedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ code: "MEDIA_SYNC_FAILED", error: "Workspace media could not be synchronized." }, { status: 503 });
  }
}
