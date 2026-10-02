import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function cleanTags(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > 24 || value.some((tag) => typeof tag !== "string")) return null;
  return [...new Set(value.map((tag: string) => tag.trim().replace(/^#+/, "").slice(0, 48)).filter(Boolean))];
}

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "Workspace media storage is not configured." }, { status: 503 }); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to update tags." }, { status: 401 });

  const body = await request.json() as { tags?: unknown; userTags?: unknown; suppressedAiTags?: unknown };
  const tags = cleanTags(body.tags);
  const userTags = cleanTags(body.userTags);
  const suppressedAiTags = cleanTags(body.suppressedAiTags);
  if (!tags || !userTags || !suppressedAiTags) return NextResponse.json({ error: "Tags must be a list of up to 24 short labels." }, { status: 400 });
  const { id } = await context.params;
  const { error } = await supabase.rpc("keeper_update_media_tags", {
    p_media_id: id, p_tags: tags, p_user_tags: userTags, p_suppressed_ai_tags: suppressedAiTags,
  });
  if (error) return NextResponse.json({ error: error.code === "P0002" ? "This item is not in the signed-in workspace." : "Tags could not be saved to the workspace." }, { status: error.code === "P0002" ? 404 : 503 });
  return NextResponse.json({ success: true });
}
