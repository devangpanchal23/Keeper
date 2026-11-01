import { NextRequest, NextResponse } from "next/server";
import { createBackendAdminClient, createBackendServerClient } from "@/lib/database/backend-client";
import { ContentService } from "@/services/content-service";
import { SavedItem } from "@/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let supabase;
  try {
    supabase = await createBackendServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace media storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to read workspace media." }, { status: 401 });

  const { id } = await context.params;
  const admin = createBackendAdminClient();

  const { data: rows, error } = await admin
    .from("keeper_media")
    .select("id,payload,processing_status")
    .eq("workspace_id", user.id);

  if (error) return NextResponse.json({ error: "Could not query media." }, { status: 503 });

  const matchingRow = (rows || []).find((row) => {
    if (row.id === id) return true;
    const payload = row.payload as SavedItem | undefined;
    return payload?.id === id || payload?.url === id;
  });

  if (!matchingRow || !matchingRow.payload || typeof matchingRow.payload !== "object") {
    return NextResponse.json({ error: "Item not found in workspace." }, { status: 404 });
  }

  const item = matchingRow.payload as SavedItem;
  return NextResponse.json({
    item: {
      ...item,
      metadata: {
        ...item.metadata,
        serverMediaId: matchingRow.id,
        aiProcessingStatus: matchingRow.processing_status,
      },
    },
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let supabase;
  try {
    supabase = await createBackendServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace media storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update workspace media." }, { status: 401 });

  const { id } = await context.params;

  try {
    const body = await req.json() as { updates?: Partial<SavedItem> } | Partial<SavedItem>;
    const updates = "updates" in body && body.updates ? body.updates : body;

    const admin = createBackendAdminClient();
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
    const mergedPayload = ContentService.safeMerge(existingPayload, updates as Partial<SavedItem>);

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

    if (Object.prototype.hasOwnProperty.call(updates, "collectionId")) {
      await admin
        .from("keeper_media_analyses")
        .update({
          collection_id: (updates as Partial<SavedItem>).collectionId ?? null,
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

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  let supabase;
  try {
    supabase = await createBackendServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace media storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete workspace media." }, { status: 401 });

  const { id } = await context.params;
  const admin = createBackendAdminClient();

  const { data: rows } = await admin
    .from("keeper_media")
    .select("id,payload")
    .eq("workspace_id", user.id);

  const matchingRow = (rows || []).find((row) => {
    if (row.id === id) return true;
    const payload = row.payload as SavedItem | undefined;
    return payload?.id === id || payload?.url === id;
  });

  if (!matchingRow) {
    return NextResponse.json({ error: "Item not found in workspace." }, { status: 404 });
  }

  const { error: deleteError } = await admin
    .from("keeper_media")
    .delete()
    .eq("id", matchingRow.id)
    .eq("workspace_id", user.id);

  if (deleteError) {
    return NextResponse.json({ error: "Failed to delete item from workspace." }, { status: 503 });
  }

  return NextResponse.json({ success: true, deletedId: matchingRow.id });
}
