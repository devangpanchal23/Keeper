import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace persistence is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update workspace organization." }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json() as { collectionId?: unknown };
  if (body.collectionId !== null && typeof body.collectionId !== "string") {
    return NextResponse.json({ error: "A collection ID or null is required." }, { status: 400 });
  }
  const nextCollectionId = body.collectionId as string | null;
  const { error } = await supabase.rpc("keeper_update_media_collection", {
    p_media_id: id,
    p_collection_id: nextCollectionId,
  });
  if (error) return NextResponse.json({ error: "The media collection could not be updated for this workspace." }, { status: error.code === "P0002" ? 404 : 503 });
  return NextResponse.json({ success: true });
}
