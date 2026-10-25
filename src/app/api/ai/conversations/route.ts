import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function authenticatedClient() {
  const client = await createSupabaseServerClient();
  const { data: { user }, error } = await client.auth.getUser();
  return { client, user: error ? null : user };
}

export async function GET() {
  try {
    const { client, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ error: "Sign in to view conversation history." }, { status: 401 });
    const { data, error } = await client.from("keeper_ai_conversations")
      .select("id,title,selected_collection_id,created_at,updated_at")
      .eq("workspace_id", user.id).order("updated_at", { ascending: false }).limit(100);
    if (error) throw error;
    const conversations = (data || []).map((row) => ({
      id: row.id, title: row.title, selectedCollectionId: row.selected_collection_id,
      createdAt: row.created_at, updatedAt: row.updated_at,
    }));
    return NextResponse.json({ conversations }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load AI conversations.", error);
    return NextResponse.json({ error: "Conversation history is unavailable. Apply the Keeper AI history database migration, then retry." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { client, user } = await authenticatedClient();
    if (!user) return NextResponse.json({ error: "Sign in to start a saved conversation." }, { status: 401 });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid conversation." }, { status: 400 });
    const input = body as Record<string, unknown>;
    const title = typeof input.title === "string" ? input.title.trim().slice(0, 120) : "New conversation";
    const collectionId = typeof input.selectedCollectionId === "string" ? input.selectedCollectionId.slice(0, 160) : "all";
    const { data, error } = await client.from("keeper_ai_conversations").insert({
      workspace_id: user.id, title: title || "New conversation", selected_collection_id: collectionId,
    }).select("id,title,selected_collection_id,created_at,updated_at").single();
    if (error) throw error;
    return NextResponse.json({ conversation: {
      id: data.id, title: data.title, selectedCollectionId: data.selected_collection_id,
      createdAt: data.created_at, updatedAt: data.updated_at,
    } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not create AI conversation.", error);
    return NextResponse.json({ error: "Conversation could not be created. Apply the Keeper AI history database migration, then retry." }, { status: 503 });
  }
}
