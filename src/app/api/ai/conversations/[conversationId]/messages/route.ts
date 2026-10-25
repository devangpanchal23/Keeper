import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ conversationId: string }> };

async function ownedConversation(conversationId: string) {
  const client = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await client.auth.getUser();
  if (authError || !user) return { client, user: null, conversation: null };
  const { data: conversation, error } = await client.from("keeper_ai_conversations")
    .select("id,title").eq("id", conversationId).eq("workspace_id", user.id).maybeSingle();
  if (error) throw error;
  return { client, user, conversation };
}

export async function GET(_request: NextRequest, context: Context) {
  try {
    const { conversationId } = await context.params;
    const { client, user, conversation } = await ownedConversation(conversationId);
    if (!user) return NextResponse.json({ error: "Sign in to view conversation messages." }, { status: 401 });
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const { data, error } = await client.from("keeper_ai_messages")
      .select("id,role,content,status,metadata,created_at")
      .eq("conversation_id", conversationId).eq("workspace_id", user.id)
      .order("created_at", { ascending: true }).limit(300);
    if (error) throw error;
    const messages = (data || []).map((row) => ({
      id: row.id, role: row.role, content: row.content, status: row.status,
      metadata: row.metadata || {}, createdAt: row.created_at,
    }));
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not load AI conversation messages.", error);
    return NextResponse.json({ error: "Conversation messages could not be loaded." }, { status: 503 });
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { conversationId } = await context.params;
    const { client, user, conversation } = await ownedConversation(conversationId);
    if (!user) return NextResponse.json({ error: "Sign in to save conversation messages." }, { status: 401 });
    if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    const rawBody = await request.text();
    if (rawBody.length > 20_000) return NextResponse.json({ error: "Message is too large." }, { status: 413 });
    let body: unknown;
    try { body = JSON.parse(rawBody); } catch { return NextResponse.json({ error: "Invalid message." }, { status: 400 }); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Invalid message." }, { status: 400 });
    const input = body as Record<string, unknown>;
    if ((input.role !== "user" && input.role !== "assistant") || typeof input.content !== "string" || !input.content.trim() || input.content.length > 12_000) {
      return NextResponse.json({ error: "A valid user or assistant message is required." }, { status: 400 });
    }
    const status = input.status === "failed" ? "failed" : "complete";
    const metadata = input.metadata && typeof input.metadata === "object" && !Array.isArray(input.metadata) ? input.metadata : {};
    const { data, error } = await client.from("keeper_ai_messages").insert({
      workspace_id: user.id, conversation_id: conversationId, role: input.role,
      content: input.content.trim(), status, metadata,
    }).select("id,role,content,status,metadata,created_at").single();
    if (error) throw error;
    const update: Record<string, string> = { updated_at: data.created_at };
    if (input.role === "user" && conversation.title === "New conversation") update.title = input.content.trim().slice(0, 72);
    const { error: updateError } = await client.from("keeper_ai_conversations").update(update)
      .eq("id", conversationId).eq("workspace_id", user.id);
    if (updateError) throw updateError;
    return NextResponse.json({ message: {
      id: data.id, role: data.role, content: data.content, status: data.status,
      metadata: data.metadata || {}, createdAt: data.created_at,
    } }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Could not save AI conversation message.", error);
    return NextResponse.json({ error: "Message could not be saved." }, { status: 503 });
  }
}
