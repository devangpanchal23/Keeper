import { NextRequest, NextResponse } from "next/server";
import { createBackendAdminClient, createBackendServerClient } from "@/lib/database/backend-client";
import { ContentService } from "@/services/content-service";
import { SavedItem } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try {
    supabase = await createBackendServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace media storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to read workspace media." }, { status: 401 });

  const { data: rows, error } = await supabase.from("keeper_media")
    .select("id,payload,processing_status,created_at,updated_at")
    .eq("workspace_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) return NextResponse.json({ error: "Workspace media could not be loaded." }, { status: 503 });

  const items = (rows || []).flatMap((row) => {
    if (!row.payload || typeof row.payload !== "object") return [];
    const item = row.payload as SavedItem;
    return [{
      ...item,
      metadata: {
        ...item.metadata,
        serverMediaId: row.id,
        aiProcessingStatus: row.processing_status,
      },
    }];
  });

  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  let supabase;
  try {
    supabase = await createBackendServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace media storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to save workspace media." }, { status: 401 });

  try {
    const body = await req.json() as { item?: SavedItem; items?: SavedItem[] };
    const candidates = body.item ? [body.item] : Array.isArray(body.items) ? body.items : [];

    if (candidates.length === 0) {
      return NextResponse.json({ error: "No media items provided to save." }, { status: 400 });
    }

    const admin = createBackendAdminClient();
    const results: SavedItem[] = [];

    for (const item of candidates) {
      if (!item || !item.url || typeof item.url !== "string") continue;
      const canonicalUrl = item.url.trim();

      // Check if item with this canonical URL already exists in user's workspace
      const { data: existingRows } = await admin
        .from("keeper_media")
        .select("id,payload,processing_status")
        .eq("workspace_id", user.id)
        .eq("canonical_url", canonicalUrl)
        .limit(1);

      const existingRow = existingRows?.[0];

      if (existingRow && existingRow.payload && typeof existingRow.payload === "object") {
        // Safe-merge with existing payload to protect authoritative facts
        const mergedPayload = ContentService.safeMerge(existingRow.payload as SavedItem, item);
        const { error: updateError } = await admin
          .from("keeper_media")
          .update({
            payload: mergedPayload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingRow.id)
          .eq("workspace_id", user.id);

        if (!updateError) {
          results.push({
            ...mergedPayload,
            metadata: {
              ...mergedPayload.metadata,
              serverMediaId: existingRow.id,
              aiProcessingStatus: existingRow.processing_status,
            },
          });
        }
      } else {
        // New item insertion
        const processingStatus = item.metadata?.aiProcessingStatus || "PENDING";
        const { data: insertedRows, error: insertError } = await admin
          .from("keeper_media")
          .insert({
            workspace_id: user.id,
            canonical_url: canonicalUrl,
            payload: item,
            processing_status: processingStatus,
          })
          .select("id");

        if (!insertError) {
          const insertedId = ((insertedRows as unknown as Array<{ id: string }>) || [])[0]?.id || item.metadata?.serverMediaId;
          results.push({
            ...item,
            metadata: {
              ...item.metadata,
              serverMediaId: insertedId,
              aiProcessingStatus: processingStatus,
            },
          });
        }
      }
    }

    return NextResponse.json(
      { success: true, count: results.length, items: results },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to save workspace media.";
    return NextResponse.json({ error: message }, { status: 500 });
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

    // Query candidate matching either server ID (UUID) or client ID / URL
    const { data: rows } = await admin
      .from("keeper_media")
      .select("id,payload,processing_status")
      .eq("workspace_id", user.id);

    const matchingRow = (rows || []).find((row) => {
      if (row.id === id) return true;
      const payload = row.payload as SavedItem | undefined;
      return payload?.id === id || payload?.url === id;
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
      await admin
        .from("keeper_media_analyses")
        .update({
          collection_id: updates.collectionId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("media_id", matchingRow.id)
        .eq("workspace_id", user.id);
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to update item.";
    return NextResponse.json({ error: message }, { status: 500 });
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
      const { data: rows } = await admin
        .from("keeper_media")
        .select("id,payload")
        .eq("workspace_id", user.id);

      const trashedRowIds = (rows || [])
        .filter((row) => (row.payload as SavedItem | undefined)?.trashed === true)
        .map((row) => row.id);

      if (trashedRowIds.length > 0) {
        for (const rowId of trashedRowIds) {
          await admin.from("keeper_media").delete().eq("id", rowId).eq("workspace_id", user.id);
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

    // Resolve target IDs against either row.id or payload.id
    const { data: rows } = await admin
      .from("keeper_media")
      .select("id,payload")
      .eq("workspace_id", user.id);

    const targetSet = new Set(itemIdsToDelete);
    const matchingRowIds = (rows || [])
      .filter((row) => targetSet.has(row.id) || targetSet.has((row.payload as SavedItem | undefined)?.id || ""))
      .map((row) => row.id);

    for (const rowId of matchingRowIds) {
      await admin.from("keeper_media").delete().eq("id", rowId).eq("workspace_id", user.id);
    }

    return NextResponse.json({ success: true, deletedCount: matchingRowIds.length });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Failed to delete item.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
