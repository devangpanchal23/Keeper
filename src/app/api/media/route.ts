import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SavedItem } from "@/types";

export const dynamic = "force-dynamic";

export async function GET() {
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json({ error: "Workspace media storage is not configured." }, { status: 503 });
  }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to read workspace media." }, { status: 401 });

  const { data: rows, error } = await supabase.from("keeper_media")
    .select("id,payload,processing_status,created_at")
    .eq("workspace_id", user.id).order("created_at", { ascending: false }).limit(1000);
  if (error) return NextResponse.json({ error: "Workspace media could not be loaded." }, { status: 503 });
  const items = (rows || []).flatMap((row) => {
    if (!row.payload || typeof row.payload !== "object") return [];
    const item = row.payload as SavedItem;
    return [{ ...item, metadata: { ...item.metadata, serverMediaId: row.id, aiProcessingStatus: row.processing_status } }];
  });
  return NextResponse.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
