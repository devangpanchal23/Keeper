import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ conversationId: string }> };

async function loadOwnedConversation(conversationId: string) {
  const client = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { client, user: null, conversation: null };
  const { data: conversation, error } = await client.from("keeper_ai_conversations")
    .select("id").eq("id", conversationId).eq("workspace_id", user.id).maybeSingle();
  if (error) throw error;
  return { client, user, conversation };
}

export async function PATCH(request: NextRequest, context: Context) {
  try {
    const { conversationId } = await context.params;
    const { client, user, conversation } = await loadOwnedConversation(conversationId);
    if (!user) return NextResponse.json({ error: "Sign in to update conversation history." }, { status: 401 });
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid conversation update." }, { status: 400 });
    const input = body as Record<string, unknown>;
    const updates: Record<string, string> = {};
    if (typeof input.title === "string") updates.title = input.title.trim().slice(0, 120) || "New conversation";
    if (typeof input.selectedCollectionId === "string") updates.selected_collection_id = input.selectedCollectionId.slice(0, 160);
    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No valid conversation changes were provided." }, { status: 400 });
    updates.updated_at = new Date().toISOString();
    const { error } = await client.from("keeper_ai_conversations").update(updates).eq("id", conversationId).eq("workspace_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not update AI conversation.", error);
    return NextResponse.json({ error: "Conversation could not be updated." }, { status: 503 });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  try {
    const { conversationId } = await context.params;
    const { client, user, conversation } = await loadOwnedConversation(conversationId);
    if (!user) return NextResponse.json({ error: "Sign in to delete conversation history." }, { status: 401 });
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const { error } = await client.from("keeper_ai_conversations").delete().eq("id", conversationId).eq("workspace_id", user.id);
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not delete AI conversation.", error);
    return NextResponse.json({ error: "Conversation could not be deleted." }, { status: 503 });
  }
}
