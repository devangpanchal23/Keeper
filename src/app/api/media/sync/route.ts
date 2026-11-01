import { NextRequest, NextResponse } from "next/server";
import { createBackendAdminClient, createBackendServerClient } from "@/lib/database/backend-client";
import { ContentService } from "@/services/content-service";
import { getCanonicalIdentityKey, getAuthoritativeCanonicalUrl } from "@/lib/media-identity";
import { isSupabaseConfigured } from "@/lib/supabase/config";
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
    return NextResponse.json({ items: localItems, synced: true, localOnly: true });
  }

  try {
    const supabase = await createBackendServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ items: localItems, synced: true, localOnly: true });
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
    const duplicateIdsToDelete: string[] = [];

    for (const row of existingRows || []) {
      if (row.payload && typeof row.payload === "object") {
        const key = getCanonicalIdentityKey(row.canonical_url || (row.payload as SavedItem).url);
        if (!key) continue;

        const existing = serverByKey.get(key);
        if (existing) {
          // Merge duplicate row and queue redundant row for deletion
          existing.payload = ContentService.safeMerge(existing.payload, row.payload as SavedItem);
          duplicateIdsToDelete.push(row.id);
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

    // Clean up historical duplicate rows asynchronously
    if (duplicateIdsToDelete.length > 0) {
      for (const dupId of duplicateIdsToDelete) {
        void admin.from("keeper_media").delete().eq("id", dupId).eq("workspace_id", user.id);
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
          await admin
            .from("keeper_media")
            .update({
              canonical_url: authoritativeUrl,
              payload: mergedPayload,
              updated_at: new Date().toISOString(),
            })
            .eq("id", existing.id)
            .eq("workspace_id", user.id);
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
        }
      }
    }

    // Final authoritative server library
    const { data: finalRows } = await admin
      .from("keeper_media")
      .select("id,payload,processing_status,canonical_url,created_at,updated_at")
      .eq("workspace_id", user.id)
      .order("created_at", { ascending: false });

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
  } catch (error: unknown) {
    console.warn("Media sync database notice, falling back to local items:", error);
    return NextResponse.json({ items: localItems, synced: true, localOnly: true });
  }
}
