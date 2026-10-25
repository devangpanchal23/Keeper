import { AuthService } from "@/services/auth-service";

export interface AssistantMessageMetadata {
  referencedItemIds?: string[];
  referencedSources?: Array<{ id: string; title: string }>;
  keyInsights?: string[];
  suggestedFollowUps?: string[];
  confidence?: number;
  collectionId?: string;
  providerNotice?: string;
}

export interface AssistantHistoryMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  status: "complete" | "failed";
  metadata: AssistantMessageMetadata;
  createdAt: string;
}

export interface AssistantConversation {
  id: string;
  title: string;
  selectedCollectionId: string;
  createdAt: string;
  updatedAt: string;
  messages?: AssistantHistoryMessage[];
}

const LOCAL_PREFIX = "keeper_ai_conversations_v1_";

function localKey(userId: string): string {
  return `${LOCAL_PREFIX}${encodeURIComponent(userId)}`;
}

function readLocal(userId: string): AssistantConversation[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(localKey(userId)) || "[]");
    return Array.isArray(value) ? value as AssistantConversation[] : [];
  } catch (error) {
    console.warn("Could not read local AI conversation history.", error);
    return [];
  }
}

function writeLocal(userId: string, conversations: AssistantConversation[]): void {
  localStorage.setItem(localKey(userId), JSON.stringify(conversations));
}

function isCloudSession(): boolean {
  const session = AuthService.getSession();
  return Boolean(session?.token && !session.token.startsWith("tok_"));
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, cache: "no-store", headers: { "Content-Type": "application/json", ...init?.headers } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string };
    throw new Error(body.error || "Conversation history could not be saved.");
  }
  return response.json() as Promise<T>;
}

function makeId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `chat-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class ConversationHistoryService {
  static async list(userId: string): Promise<AssistantConversation[]> {
    if (isCloudSession()) {
      const result = await request<{ conversations: AssistantConversation[] }>("/api/ai/conversations");
      return result.conversations;
    }
    return readLocal(userId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  static async create(userId: string, collectionId: string): Promise<AssistantConversation> {
    if (isCloudSession()) {
      const result = await request<{ conversation: AssistantConversation }>("/api/ai/conversations", {
        method: "POST", body: JSON.stringify({ title: "New conversation", selectedCollectionId: collectionId }),
      });
      return result.conversation;
    }
    const now = new Date().toISOString();
    const conversation: AssistantConversation = { id: makeId(), title: "New conversation", selectedCollectionId: collectionId, createdAt: now, updatedAt: now, messages: [] };
    writeLocal(userId, [conversation, ...readLocal(userId)]);
    return conversation;
  }

  static async messages(userId: string, conversationId: string): Promise<AssistantHistoryMessage[]> {
    if (isCloudSession()) {
      const result = await request<{ messages: AssistantHistoryMessage[] }>(`/api/ai/conversations/${encodeURIComponent(conversationId)}/messages`);
      return result.messages;
    }
    return readLocal(userId).find((conversation) => conversation.id === conversationId)?.messages || [];
  }

  static async append(userId: string, conversationId: string, message: Omit<AssistantHistoryMessage, "id" | "createdAt">): Promise<AssistantHistoryMessage> {
    if (isCloudSession()) {
      const result = await request<{ message: AssistantHistoryMessage }>(`/api/ai/conversations/${encodeURIComponent(conversationId)}/messages`, {
        method: "POST", body: JSON.stringify(message),
      });
      return result.message;
    }
    const conversations = readLocal(userId);
    const conversation = conversations.find((entry) => entry.id === conversationId);
    if (!conversation) throw new Error("This conversation no longer exists.");
    const saved: AssistantHistoryMessage = { ...message, id: makeId(), createdAt: new Date().toISOString() };
    conversation.messages = [...(conversation.messages || []), saved];
    conversation.updatedAt = saved.createdAt;
    if (message.role === "user" && conversation.title === "New conversation") conversation.title = message.content.slice(0, 72);
    writeLocal(userId, conversations);
    return saved;
  }

  static async update(userId: string, conversationId: string, updates: { title?: string; selectedCollectionId?: string }): Promise<void> {
    if (isCloudSession()) {
      await request(`/api/ai/conversations/${encodeURIComponent(conversationId)}`, { method: "PATCH", body: JSON.stringify(updates) });
      return;
    }
    const conversations = readLocal(userId);
    const conversation = conversations.find((entry) => entry.id === conversationId);
    if (!conversation) return;
    if (updates.title !== undefined) conversation.title = updates.title.slice(0, 120);
    if (updates.selectedCollectionId !== undefined) conversation.selectedCollectionId = updates.selectedCollectionId;
    conversation.updatedAt = new Date().toISOString();
    writeLocal(userId, conversations);
  }

  static async remove(userId: string, conversationId: string): Promise<void> {
    if (isCloudSession()) {
      await request(`/api/ai/conversations/${encodeURIComponent(conversationId)}`, { method: "DELETE" });
      return;
    }
    writeLocal(userId, readLocal(userId).filter((conversation) => conversation.id !== conversationId));
  }
}
