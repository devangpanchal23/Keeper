import { NextRequest, NextResponse } from "next/server";
import { ContentService } from "@/services/content-service";
import { AuthService } from "@/services/auth-service";

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
    const { itemIds, selectAll, userId: requestedUserId } = body;

    // Authenticate user session
    const session = AuthService.getSession();
    const authenticatedUserId = session?.userId || requestedUserId || "user-demo-1";

    if (!selectAll && (!Array.isArray(itemIds) || itemIds.length === 0)) {
      return NextResponse.json(
        { success: false, error: "Must specify itemIds array or selectAll: true." },
        { status: 400 }
      );
    }

    const result = ContentService.deleteCollectionItems({
      userId: authenticatedUserId,
      collectionId,
      itemIds: Array.isArray(itemIds) ? itemIds : undefined,
      selectAll: Boolean(selectAll),
    });

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
  } catch (err: any) {
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
