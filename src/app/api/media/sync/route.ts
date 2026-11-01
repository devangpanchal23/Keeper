import { NextRequest, NextResponse } from "next/server";
import { createBackendAdminClient, createBackendServerClient } from "@/lib/database/backend-client";
import { ContentService } from "@/services/content-service";
import { SavedItem } from "@/types";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let supabase;
  try {
    supabase = await createBackendServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace media storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to synchronize workspace media." }, { status: 401 });

  try {
    const body = await req.json().catch(() => ({})) as { localItems?: SavedItem[] };
    const localItems = Array.isArray(body.localItems) ? body.localItems : [];
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

    const serverByUrl = new Map<string, { id: string; payload: SavedItem; status: string }>();
    for (const row of existingRows || []) {
      if (row.payload && typeof row.payload === "object") {
        serverByUrl.set(row.canonical_url.toLowerCase().trim(), {
          id: row.id,
          payload: row.payload as SavedItem,
          status: row.processing_status,
        });
      }
    }

    // Process incoming local items: if not on server, insert; if present, merge updates
    for (const localItem of localItems) {
      if (!localItem || !localItem.url || typeof localItem.url !== "string") continue;
      const cleanUrl = localItem.url.toLowerCase().trim();
      const existing = serverByUrl.get(cleanUrl);

      if (existing) {
        // Safe-merge local updates into existing server item
        const mergedPayload = ContentService.safeMerge(existing.payload, localItem);
        // Only update if changes exist
        if (JSON.stringify(mergedPayload) !== JSON.stringify(existing.payload)) {
          await admin
            .from("keeper_media")
            .update({
              payload: mergedPayload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .eq("workspace_id", user.id);
          existing.payload = mergedPayload;
        }
      } else {
        // Local-only legacy item: insert into server database
        const processingStatus = localItem.metadata?.aiProcessingStatus || "PENDING";
        const { data: insertedRows } = await admin
          .from("keeper_media")
          .insert({
            workspace_id: user.id,
            canonical_url: localItem.url.trim(),
            payload: localItem,
            processing_status: processingStatus,
          })
          .select("id");

        const newId = ((insertedRows as unknown as Array<{ id: string }>) || [])[0]?.id || localItem.metadata?.serverMediaId || "";
        serverByUrl.set(cleanUrl, {
          id: newId,
          payload: localItem,
          status: processingStatus,
        });
      }
    }

    // Fetch the final, authoritative server library
    const { data: finalRows } = await admin
      .from("keeper_media")
      .select("id,payload,processing_status,created_at,updated_at")
      .eq("workspace_id", user.id)
      .order("created_at", { ascending: false });

    const items: SavedItem[] = (finalRows || []).flatMap((row) => {
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

    return NextResponse.json({
      success: true,
      items,
      count: items.length,
      syncedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Sync failure.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
