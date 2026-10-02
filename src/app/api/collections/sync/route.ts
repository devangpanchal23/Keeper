import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "Workspace collection storage is not configured." }, { status: 503 }); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to load workspace collections." }, { status: 401 });
  const { data, error } = await supabase.from("keeper_collections")
    .select("id,name,description,profile,updated_at").eq("workspace_id", user.id).order("name");
  if (error) return NextResponse.json({ error: "Workspace collections could not be loaded." }, { status: 503 });
  return NextResponse.json({ collections: data || [] }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  let supabase;
  try { supabase = await createSupabaseServerClient(); }
  catch { return NextResponse.json({ error: "Workspace collection storage is not configured." }, { status: 503 }); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to sync collections." }, { status: 401 });

  const body = await request.json() as { id?: unknown; name?: unknown; description?: unknown; color?: unknown; icon?: unknown };
  if (typeof body.id !== "string" || typeof body.name !== "string" || !body.id.trim() || !body.name.trim()) {
    return NextResponse.json({ error: "A collection ID and name are required." }, { status: 400 });
  }
  const { error } = await supabase.from("keeper_collections").upsert({
    workspace_id: user.id, id: body.id.slice(0, 120), name: body.name.trim().slice(0, 120),
    description: typeof body.description === "string" ? body.description.slice(0, 1000) : null,
    profile: { color: body.color, icon: body.icon },
  }, { onConflict: "workspace_id,id" });
  if (error) return NextResponse.json({ error: "Collection could not be synced to the workspace." }, { status: 503 });
  return NextResponse.json({ success: true });
}
