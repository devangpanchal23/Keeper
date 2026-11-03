import { NextRequest, NextResponse } from "next/server";
import { createBackendAdminClient, createBackendServerClient } from "@/lib/database/backend-client";
import { ContentService } from "@/services/content-service";
import { getCanonicalIdentityKey, getAuthoritativeCanonicalUrl } from "@/lib/media-identity";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assertBackendConfiguration } from "@/lib/database/provider";
import { AIProcessingState, SavedItem } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ code: "BACKEND_NOT_CONFIGURED", error: "Workspace media storage is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  try {
    assertBackendConfiguration();
  } catch {
    return NextResponse.json({ code: "BACKEND_NOT_CONFIGURED", error: "Workspace media storage is not configured." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const supabase = await createBackendServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) return NextResponse.json({ code: "AUTH_SERVICE_UNAVAILABLE", error: "Could not verify your workspace session." }, { status: 503, headers: { "Cache-Control": "no-store" } });
    if (!user) return NextResponse.json({ code: "AUTH_REQUIRED", error: "Sign in to read workspace media." }, { status: 401, headers: { "Cache-Control": "no-store" } });

    const { data: rows, error } = await supabase.from("keeper_media")
      .select("id,payload,processing_status,canonical_url,created_at,updated_at")
      .eq("workspace_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1000);

    if (error) return NextResponse.json({ code: "MEDIA_READ_FAILED", error: "Workspace media is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });

    // Group and deduplicate by canonical identity key
    const seenIdentities = new Map<string, { id: string; item: SavedItem }>();

    for (const row of rows || []) {
      if (!row.payload || typeof row.payload !== "object") continue;
      const rawItem = row.payload as SavedItem;
      const item: SavedItem = {
        ...rawItem,
        metadata: {
          ...rawItem.metadata,
          serverMediaId: row.id,
          aiProcessingStatus: row.processing_status,
        },
      };
      const key = getCanonicalIdentityKey(row.canonical_url || item.url);
      if (!key) continue;

      const existing = seenIdentities.get(key);
      if (existing) {
        // Existing duplicate: safe-merge payload and mark duplicate row for safe cleanup
        existing.item = ContentService.safeMerge(existing.item, item);
      } else {
        seenIdentities.set(key, { id: row.id, item });
      }
    }

    const items = Array.from(seenIdentities.values()).map((entry) => entry.item);
    return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ code: "MEDIA_READ_FAILED", error: "Workspace media is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export async function POST(req: NextRequest) {
  let body: { item?: SavedItem; items?: SavedItem[] } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  const candidates = body.item ? [body.item] : Array.isArray(body.items) ? body.items : [];
  if (candidates.length === 0) {
    return NextResponse.json({ error: "No media items provided to save." }, { status: 400 });
  }
  if (candidates.some((item) => !item || typeof item.url !== "string" || !item.url.trim())) {
    return NextResponse.json({ error: "Every media item must include a valid URL." }, { status: 400 });
  }

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
      return NextResponse.json({ code: "AUTH_REQUIRED", error: "Sign in to save workspace media." }, { status: 401 });
    }

    const admin = createBackendAdminClient();
    const results: SavedItem[] = [];

    // Query existing candidate items for this workspace
    const { data: existingRows, error: existingReadError } = await admin
      .from("keeper_media")
      .select("id,payload,processing_status,canonical_url")
      .eq("workspace_id", user.id);
    if (existingReadError) return NextResponse.json({ code: "MEDIA_READ_FAILED", error: "Workspace media is temporarily unavailable." }, { status: 503 });

    const existingByKey = new Map<string, { id: string; payload: SavedItem; processing_status: string; canonical_url: string }>();
    for (const row of existingRows || []) {
      if (row.payload && typeof row.payload === "object") {
        const key = getCanonicalIdentityKey(row.canonical_url || (row.payload as SavedItem).url);
        if (key && !existingByKey.has(key)) {
          existingByKey.set(key, {
            id: row.id,
            payload: row.payload as SavedItem,
            processing_status: row.processing_status,
            canonical_url: row.canonical_url,
          });
        }
      }
    }

    for (const item of candidates) {
      if (!item || !item.url || typeof item.url !== "string") continue;
      const key = getCanonicalIdentityKey(item.url);
      const authoritativeUrl = getAuthoritativeCanonicalUrl(item.url);
      const existing = existingByKey.get(key);

      if (existing) {
        // Safe-merge with existing payload to protect authoritative facts and preserve collection folder
        const incomingColId = item.collectionId;
        const mergedCollections = Array.from(
          new Set([
            ...(existing.payload.collections || []),
            ...(item.collections || []),
            ...(incomingColId ? [incomingColId] : []),
            ...(existing.payload.collectionId ? [existing.payload.collectionId] : []),
          ])
        );
        const mergedPayload: SavedItem = {
          ...ContentService.safeMerge(existing.payload, item),
          collectionId: incomingColId || existing.payload.collectionId,
          collections: mergedCollections,
        };

        const { error: updateError } = await admin
          .from("keeper_media")
          .update({
            canonical_url: authoritativeUrl,
            payload: mergedPayload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id)
          .eq("workspace_id", user.id);

        if (updateError) return NextResponse.json({ code: "MEDIA_WRITE_FAILED", error: "Workspace media could not be saved." }, { status: 503 });
        const updatedItem = {
          ...mergedPayload,
          metadata: {
            ...mergedPayload.metadata,
            serverMediaId: existing.id,
            aiProcessingStatus: (existing.processing_status as AIProcessingState) || "PENDING",
          },
        };
        results.push(updatedItem);
        existing.payload = mergedPayload;
      } else {
        // New item insertion with clean canonical URL
        const processingStatus = item.metadata?.aiProcessingStatus || "PENDING";
        const { data: insertedRows, error: insertError } = await admin
          .from("keeper_media")
          .insert({
            workspace_id: user.id,
            canonical_url: authoritativeUrl,
            payload: item,
            processing_status: processingStatus,
          })
          .select("id");

        if (!insertError) {
          const insertedId = ((insertedRows as unknown as Array<{ id: string }>) || [])[0]?.id || item.metadata?.serverMediaId;
          const createdItem = {
            ...item,
            metadata: {
              ...item.metadata,
              serverMediaId: insertedId,
              aiProcessingStatus: processingStatus,
            },
          };
          results.push(createdItem);
          existingByKey.set(key, {
            id: insertedId || "",
            payload: item,
            processing_status: processingStatus,
            canonical_url: authoritativeUrl,
          });
        } else if (insertError.code === "23505") {
          // Concurrency race: Another device/request inserted the same item in parallel.
          // Retrieve the newly inserted item, safe-merge to guarantee idempotency.
          const { data: conflictRows, error: conflictReadError } = await admin
            .from("keeper_media")
            .select("id,payload,processing_status")
            .eq("workspace_id", user.id)
            .eq("canonical_url", authoritativeUrl)
            .limit(1);
          if (conflictReadError) return NextResponse.json({ code: "MEDIA_READ_FAILED", error: "Workspace media is temporarily unavailable." }, { status: 503 });

          const conflictRow = conflictRows?.[0];
          if (conflictRow?.payload) {
            const merged = ContentService.safeMerge(conflictRow.payload as SavedItem, item);
            const { error: mergeError } = await admin
              .from("keeper_media")
              .update({ payload: merged, updated_at: new Date().toISOString() })
              .eq("id", conflictRow.id)
              .eq("workspace_id", user.id);
            if (mergeError) return NextResponse.json({ code: "MEDIA_WRITE_FAILED", error: "Workspace media could not be saved." }, { status: 503 });

            results.push({
              ...merged,
              metadata: {
                ...merged.metadata,
                serverMediaId: conflictRow.id,
                aiProcessingStatus: conflictRow.processing_status,
              },
            });
          } else return NextResponse.json({ code: "MEDIA_WRITE_FAILED", error: "Workspace media could not be saved." }, { status: 503 });
        } else {
          return NextResponse.json({ code: "MEDIA_WRITE_FAILED", error: "Workspace media could not be saved." }, { status: 503 });
        }
      }
    }

    return NextResponse.json(
      { success: true, count: results.length, items: results },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json({ code: "MEDIA_WRITE_FAILED", error: "Workspace media could not be saved." }, { status: 503 });
  }
}

export async function PATCH(req: NextRequest) {
  let supabase;
  try {
    supabase = await createBackendServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace media storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update workspace media." }, { status: 401 });

  try {
    const body = await req.json() as { id?: string; updates?: Partial<SavedItem> };
    const { id, updates } = body;
    if (!id || typeof id !== "string" || !updates || typeof updates !== "object") {
      return NextResponse.json({ error: "Item ID and update fields are required." }, { status: 400 });
    }

    const admin = createBackendAdminClient();

    // Query candidate matching either server ID (UUID) or client ID / URL / identity key
    const { data: rows, error: readError } = await admin
      .from("keeper_media")
      .select("id,payload,processing_status,canonical_url")
      .eq("workspace_id", user.id);
    if (readError) return NextResponse.json({ code: "MEDIA_READ_FAILED", error: "Workspace media is temporarily unavailable." }, { status: 503 });

    const targetKey = getCanonicalIdentityKey(id);
    const matchingRow = (rows || []).find((row) => {
      if (row.id === id) return true;
      const payload = row.payload as SavedItem | undefined;
      if (payload?.id === id || payload?.url === id) return true;
      if (targetKey && (getCanonicalIdentityKey(row.canonical_url) === targetKey || getCanonicalIdentityKey(payload?.url || "") === targetKey)) {
        return true;
      }
      return false;
    });

    if (!matchingRow || !matchingRow.payload || typeof matchingRow.payload !== "object") {
      return NextResponse.json({ error: "Item not found in workspace." }, { status: 404 });
    }

    const existingPayload = matchingRow.payload as SavedItem;
    const mergedPayload = ContentService.safeMerge(existingPayload, updates);

    const { error: updateError } = await admin
      .from("keeper_media")
      .update({
        payload: mergedPayload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", matchingRow.id)
      .eq("workspace_id", user.id);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update item in workspace." }, { status: 503 });
    }

    // If collection was updated, sync keeper_media_analyses collection_id as well
    if (Object.prototype.hasOwnProperty.call(updates, "collectionId")) {
      const { error: analysisUpdateError } = await admin
        .from("keeper_media_analyses")
        .update({
          collection_id: updates.collectionId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("media_id", matchingRow.id)
        .eq("workspace_id", user.id);
      if (analysisUpdateError) return NextResponse.json({ code: "MEDIA_UPDATE_PARTIAL", error: "Item was updated, but collection analysis could not be synchronized." }, { status: 503 });
    }

    return NextResponse.json({
      success: true,
      item: {
        ...mergedPayload,
        metadata: {
          ...mergedPayload.metadata,
          serverMediaId: matchingRow.id,
          aiProcessingStatus: matchingRow.processing_status,
        },
      },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ code: "MEDIA_WRITE_FAILED", error: "Workspace media could not be updated." }, { status: 503 });
  }
}

export async function DELETE(req: NextRequest) {
  let supabase;
  try {
    supabase = await createBackendServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace media storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete workspace media." }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const trashedOnly = searchParams.get("trashed") === "true";
    const targetId = searchParams.get("id");

    const admin = createBackendAdminClient();

    if (trashedOnly) {
      // Find all rows in user's workspace that are marked trashed
      const { data: rows, error: readError } = await admin
        .from("keeper_media")
        .select("id,payload")
        .eq("workspace_id", user.id);
      if (readError) return NextResponse.json({ code: "MEDIA_READ_FAILED", error: "Workspace media is temporarily unavailable." }, { status: 503 });

      const trashedRowIds = (rows || [])
        .filter((row) => (row.payload as SavedItem | undefined)?.trashed === true)
        .map((row) => row.id);

      if (trashedRowIds.length > 0) {
        for (const rowId of trashedRowIds) {
          const { error: deleteError } = await admin.from("keeper_media").delete().eq("id", rowId).eq("workspace_id", user.id);
          if (deleteError) return NextResponse.json({ code: "MEDIA_DELETE_FAILED", error: "Workspace media could not be deleted." }, { status: 503 });
        }
      }

      return NextResponse.json({ success: true, deletedCount: trashedRowIds.length });
    }

    let itemIdsToDelete: string[] = targetId ? [targetId] : [];
    if (itemIdsToDelete.length === 0) {
      const body = await req.json().catch(() => ({})) as { id?: string; itemIds?: string[] };
      if (body.id) itemIdsToDelete = [body.id];
      else if (Array.isArray(body.itemIds)) itemIdsToDelete = body.itemIds;
    }

    if (itemIdsToDelete.length === 0) {
      return NextResponse.json({ error: "No item ID provided for deletion." }, { status: 400 });
    }

    // Resolve target IDs against row.id, payload.id, or canonical identity
    const { data: rows, error: readError } = await admin
      .from("keeper_media")
      .select("id,payload,canonical_url")
      .eq("workspace_id", user.id);
    if (readError) return NextResponse.json({ code: "MEDIA_READ_FAILED", error: "Workspace media is temporarily unavailable." }, { status: 503 });

    const targetSet = new Set(itemIdsToDelete);
    const targetKeys = new Set(itemIdsToDelete.map(getCanonicalIdentityKey).filter(Boolean));

    const matchingRowIds = (rows || [])
      .filter((row) => {
        if (targetSet.has(row.id)) return true;
        const payload = row.payload as SavedItem | undefined;
        if (payload?.id && targetSet.has(payload.id)) return true;
        const rowKey = getCanonicalIdentityKey(row.canonical_url || payload?.url || "");
        return Boolean(rowKey && targetKeys.has(rowKey));
      })
      .map((row) => row.id);

    for (const rowId of matchingRowIds) {
      const { error: deleteError } = await admin.from("keeper_media").delete().eq("id", rowId).eq("workspace_id", user.id);
      if (deleteError) return NextResponse.json({ code: "MEDIA_DELETE_FAILED", error: "Workspace media could not be deleted." }, { status: 503 });
    }

    return NextResponse.json({ success: true, deletedCount: matchingRowIds.length });
  } catch {
    return NextResponse.json({ code: "MEDIA_DELETE_FAILED", error: "Workspace media could not be deleted." }, { status: 503 });
  }
}
