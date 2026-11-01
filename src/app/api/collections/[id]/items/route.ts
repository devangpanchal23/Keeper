import { NextRequest, NextResponse } from "next/server";
import { ContentService } from "@/services/content-service";
import { getAuthenticatedSupabaseUser } from "@/lib/supabase/auth";
import { createBackendAdminClient } from "@/lib/database/backend-client";
import { SavedItem } from "@/types";

export const dynamic = "force-dynamic";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: collectionId } = await params;
    if (!collectionId) {
      return NextResponse.json(
        { success: false, error: "Missing required collection ID parameter." },
        { status: 400 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { itemIds, selectAll } = body;

    const user = await getAuthenticatedSupabaseUser();
    if (!user) {
      return NextResponse.json({ success: false, error: "Sign in to manage collection items." }, { status: 401 });
    }

    if (!selectAll && (!Array.isArray(itemIds) || itemIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: "Must specify itemIds array or selectAll: true." },
        { status: 400 }
      );
    }

    // Update in-memory / storage layer
    const result = ContentService.deleteCollectionItems({
      userId: user.id,
      collectionId,
      itemIds: Array.isArray(itemIds) ? itemIds : undefined,
      selectAll: Boolean(selectAll),
    });

    // Synchronize the collection deletion changes with durable database keeper_media
    try {
      const admin = createBackendAdminClient();
      const { data: rows } = await admin
        .from("keeper_media")
        .select("id,payload")
        .eq("workspace_id", user.id);

      const targetIdSet = Array.isArray(itemIds) ? new Set(itemIds) : null;

      for (const row of rows || []) {
        const payload = row.payload as SavedItem | undefined;
        if (!payload || payload.trashed) continue;

        const isMember = payload.collectionId === collectionId || payload.collections?.includes(collectionId);
        if (!isMember) continue;

        const idMatches = selectAll || (targetIdSet && (targetIdSet.has(row.id) || targetIdSet.has(payload.id)));
        if (!idMatches) continue;

        const allUserCols = payload.collections || (payload.collectionId ? [payload.collectionId] : []);
        const otherCols = allUserCols.filter((cid) => cid !== collectionId);

        let updatedPayload: SavedItem;
        if (otherCols.length === 0) {
          // Sole collection: move to trash
          updatedPayload = {
            ...payload,
            trashed: true,
          };
        } else {
          // Multi-collection: unlink from this collection
          updatedPayload = {
            ...payload,
            collections: otherCols,
            collectionId: payload.collectionId === collectionId ? otherCols[0] : payload.collectionId,
          };
        }

        await admin
          .from("keeper_media")
          .update({
            payload: updatedPayload,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id)
          .eq("workspace_id", user.id);
      }
    } catch (dbError) {
      console.warn("Could not synchronize collection item delete to database:", dbError);
    }

    return NextResponse.json(
      {
        success: true,
        data: result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete collection items.";
    const status = message.includes("Unauthorized") || message.includes("not found") ? 403 : 500;
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status }
    );
  }
}
