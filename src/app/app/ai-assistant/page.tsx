"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRecall } from "@/context/RecallContext";
import { AIService, AssistantAnswer } from "@/services/ai-service";
import { AssistantConversation, AssistantHistoryMessage, ConversationHistoryService } from "@/services/ai-history/conversation-history-service";
import { PlatformBadge } from "@/components/common/PlatformBadge";
import {
  Brain,
  Sparkles,
  Send,
  Loader2,
  BookOpen,
  ArrowRight,
  CheckCircle2,
  Folder,
  MessageSquare,
  Plus,
  Trash2,
  AlertCircle,
} from "lucide-react";

const SUGGESTED_QUERIES = [
  "Find the video I saved about React performance",
  "What did I save about AI agents?",
  "Show me Instagram reels about UI design",
  "Find the React video I saved recently",
  "High-protein quick dinner recipes",
  "What have I saved about payment gateways?",
];

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  content: string;
  data?: AssistantAnswer;
  status?: "failed";
  unavailableSources?: string[];
  providerNotice?: string;
}

function restoreHistoryMessage(message: AssistantHistoryMessage, items: ReturnType<typeof useRecall>["items"]): ChatMessage {
  if (message.role === "user") return { id: message.id, sender: "user", content: message.content };
  const referencedItems = (message.metadata.referencedItemIds || [])
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is (typeof items)[number] => !!item);
  const data: AssistantAnswer = {
    id: message.id,
    query: "",
    answer: message.content,
    keyInsights: message.metadata.keyInsights || [],
    referencedItems,
    confidence: message.metadata.confidence || 0,
    timestamp: message.createdAt,
    suggestedFollowUps: message.metadata.suggestedFollowUps || [],
  };
  const unavailableSources = (message.metadata.referencedSources || [])
    .filter((source) => !items.some((item) => item.id === source.id))
    .map((source) => source.title);
  return { id: message.id, sender: "assistant", content: message.content, data, status: message.status === "failed" ? "failed" : undefined, unavailableSources, providerNotice: message.metadata.providerNotice };
}

function createMessageId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AIAssistantPage() {
  const { items, collections, user, authLoading } = useRecall();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [collectionId, setCollectionId] = useState("all");
  const [allowExternalSynthesis, setAllowExternalSynthesis] = useState(false);
  const [conversations, setConversations] = useState<AssistantConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [historyError, setHistoryError] = useState("");
  const [historyLoading, setHistoryLoading] = useState(false);

  // Initial welcome message + default React performance response
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      content:
        "Hello! I am your Keeper Knowledge Assistant. Ask me anything about what you've saved across YouTube, Instagram, Reddit, X, LinkedIn, and the web. I answer from your library and show the saved sources I used.",
    },
  ]);

  const currentUserId = user?.id;

  useEffect(() => {
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled || authLoading) return null;
      setHistoryLoading(true);
      setHistoryError("");
      return currentUserId ? ConversationHistoryService.list(currentUserId) : [];
    }).then(async (history) => {
      if (history === null || cancelled) return;
      setConversations(history);
      const latest = history[0];
      if (!latest) {
        setActiveConversationId(null);
        setCollectionId("all");
        setMessages([{ id: "msg-welcome", sender: "assistant", content: "Hello! I am your Keeper Knowledge Assistant. Ask me about what you've saved, and I will show the saved sources I used." }]);
        return;
      }
      if (latest && currentUserId) {
        setActiveConversationId(latest.id);
        setCollectionId(latest.selectedCollectionId || "all");
        const savedMessages = await ConversationHistoryService.messages(currentUserId, latest.id);
        if (!cancelled) setMessages(savedMessages.length ? savedMessages.map((message) => restoreHistoryMessage(message, items)) : [{ id: "msg-welcome", sender: "assistant", content: "Hello! I am your Keeper Knowledge Assistant. Ask me about what you've saved, and I will show the saved sources I used." }]);
      }
    }).catch((error: unknown) => {
      if (!cancelled) setHistoryError(error instanceof Error ? error.message : "Conversation history could not be loaded.");
    }).finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [authLoading, currentUserId, items]);

  const handleNewChat = () => {
    if (loading) return;
    setActiveConversationId(null);
    setAllowExternalSynthesis(false);
    setMessages([{ id: createMessageId("welcome"), sender: "assistant", content: "New conversation started. What would you like to find in your saved library?" }]);
    setHistoryError("");
  };

  const handleSelectConversation = async (conversation: AssistantConversation) => {
    if (!user || loading || conversation.id === activeConversationId) return;
    setHistoryLoading(true);
    setActiveConversationId(conversation.id);
    setAllowExternalSynthesis(false);
    setCollectionId(conversation.selectedCollectionId || "all");
    try {
      const savedMessages = await ConversationHistoryService.messages(user.id, conversation.id);
      setMessages(savedMessages.length ? savedMessages.map((message) => restoreHistoryMessage(message, items)) : [{ id: `welcome-${conversation.id}`, sender: "assistant", content: "Ask a question about your saved library." }]);
      setHistoryError("");
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Conversation could not be opened.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleDeleteConversation = async (conversationId: string) => {
    if (!user) return;
    try {
      await ConversationHistoryService.remove(user.id, conversationId);
      const remaining = conversations.filter((entry) => entry.id !== conversationId);
      setConversations(remaining);
      if (activeConversationId === conversationId) {
        setActiveConversationId(null);
        setAllowExternalSynthesis(false);
        setMessages([{ id: "msg-welcome-new", sender: "assistant", content: "Start a new conversation about your saved library." }]);
      }
      setHistoryError("");
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : "Conversation could not be deleted.");
    }
  };

  const handleAsk = async (textToAsk: string) => {
    const q = textToAsk.trim();
    if (!q || loading || !user) return;

    setQuery("");
    setLoading(true);
    setHistoryError("");
    let conversationId = activeConversationId;
    const conversationContext = messages.filter((message) => message.id !== "msg-welcome" && !message.id.startsWith("welcome-")).slice(-8)
      .map((message) => `${message.sender}: ${message.content}`);
    let userMessageId = createMessageId("user");
    try {
      if (!conversationId) {
        try {
          const created = await ConversationHistoryService.create(user.id, collectionId);
          conversationId = created.id;
          setActiveConversationId(created.id);
          setConversations((previous) => [created, ...previous]);
        } catch (error) {
          setHistoryError(error instanceof Error ? `Answer can continue, but this chat is not being saved: ${error.message}` : "Answer can continue, but this chat could not be saved.");
        }
      }
      if (conversationId) {
        try {
          const savedUserMessage = await ConversationHistoryService.append(user.id, conversationId, {
            role: "user", content: q, status: "complete", metadata: { collectionId },
          });
          userMessageId = savedUserMessage.id;
        } catch (error) {
          setHistoryError(error instanceof Error ? `Answer can continue, but this message is not being saved: ${error.message}` : "Answer can continue, but this message could not be saved.");
        }
      }
      setMessages((previous) => [...previous, { id: userMessageId, sender: "user", content: q }]);
      const response = await AIService.queryAssistant(q, items, collections, collectionId, conversationContext, allowExternalSynthesis);
      const metadata = {
        referencedItemIds: response.referencedItems.map((item) => item.id),
        referencedSources: response.referencedItems.map((item) => ({ id: item.id, title: item.title })),
        keyInsights: response.keyInsights,
        suggestedFollowUps: response.suggestedFollowUps,
        confidence: response.confidence,
        providerNotice: response.providerNotice,
        collectionId,
      };
      let assistantMessageId = createMessageId("ai");
      let createdAt = response.timestamp;
      if (conversationId) {
        try {
          const assistantMessage = await ConversationHistoryService.append(user.id, conversationId, {
            role: "assistant", content: response.answer, status: "complete", metadata,
          });
          assistantMessageId = assistantMessage.id;
          createdAt = assistantMessage.createdAt;
        } catch (error) {
          setHistoryError(error instanceof Error ? `Answer is ready, but it could not be added to history: ${error.message}` : "Answer is ready, but it could not be added to history.");
        }
      }
      setMessages((previous) => [...previous, { id: assistantMessageId, sender: "assistant", content: response.answer, data: { ...response, id: assistantMessageId }, providerNotice: response.providerNotice }]);
      if (conversationId) setConversations((previous) => previous.map((entry) => entry.id === conversationId ? { ...entry, title: entry.title === "New conversation" ? q.slice(0, 72) : entry.title, updatedAt: createdAt } : entry).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch (error) {
      console.error("Keeper assistant request failed.", error);
      const message = error instanceof Error ? error.message : "Keeper could not complete this answer.";
      setHistoryError(message);
      if (conversationId) {
        try {
          const failed = await ConversationHistoryService.append(user.id, conversationId, { role: "assistant", content: message, status: "failed", metadata: { collectionId } });
          setMessages((previous) => [...previous, { id: failed.id, sender: "assistant", content: message, status: "failed" }]);
        } catch (saveError) {
          console.warn("Could not save failed assistant turn.", saveError);
          setMessages((previous) => [...previous, { id: createMessageId("failed"), sender: "assistant", content: message, status: "failed" }]);
        }
      } else {
        setMessages((previous) => [...previous, { id: createMessageId("failed"), sender: "assistant", content: message, status: "failed" }]);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => { handleNewChat(); };

  return (
    <div className="p-3 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-4 sm:space-y-6 flex flex-col h-[calc(100dvh-8rem)] md:h-[calc(100dvh-4rem)] mb-16 md:mb-0">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 pb-4 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-cyan-400 flex items-center justify-center text-white shadow-lg shadow-indigo-600/25 shrink-0">
            <Brain className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-2xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
                AI Library Assistant
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/10 text-indigo-500 shrink-0">
                SEMANTIC
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 truncate">
              Natural language queries grounded on your saved bookmarks
            </p>
          </div>
        </div>

        <button
          onClick={handleClearHistory}
          disabled={loading || authLoading}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" />
          New chat
        </button>
      </div>

      <div className="shrink-0 flex items-center gap-2 overflow-x-auto pb-1" aria-label="Conversation history">
        <span className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold text-zinc-400 shrink-0"><MessageSquare className="w-3.5 h-3.5" /> History</span>
        {historyLoading && <span className="text-xs text-zinc-400 shrink-0">Loading...</span>}
        {!historyLoading && conversations.map((conversation) => (
          <div key={conversation.id} className={`inline-flex items-center rounded-xl border shrink-0 ${conversation.id === activeConversationId ? "border-indigo-400 bg-indigo-50 dark:bg-indigo-950/40" : "border-zinc-200 dark:border-zinc-800"}`}>
            <button onClick={() => void handleSelectConversation(conversation)} title={conversation.title} className="max-w-44 truncate px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300">
              {conversation.title}
            </button>
            <button onClick={() => void handleDeleteConversation(conversation.id)} title="Delete conversation" aria-label={`Delete ${conversation.title}`} className="px-2 text-zinc-400 hover:text-rose-500"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {historyError && <span role="alert" className="inline-flex items-center gap-1 text-xs text-rose-500 shrink-0"><AlertCircle className="h-3.5 w-3.5" />{historyError}</span>}
        {!user && !authLoading && <span className="text-xs text-zinc-400 shrink-0">Sign in to save conversation history.</span>}
      </div>

      {/* Suggested Prompt Chips */}
      <div className="shrink-0 space-y-1.5">
        <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider">
          Suggested Queries:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_QUERIES.map((sq) => (
            <button
              key={sq}
              disabled={loading}
              onClick={() => handleAsk(sq)}
              className="px-3 py-1.5 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/60 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 hover:border-indigo-500/40 text-zinc-700 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all text-left"
            >
              &quot;{sq}&quot;
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 pt-2 text-xs text-zinc-500">
          <Folder className="h-3.5 w-3.5" />
          Search within
          <select
            value={collectionId}
            onChange={(event) => {
              const nextCollectionId = event.target.value;
              setCollectionId(nextCollectionId);
              if (user && activeConversationId) {
                void ConversationHistoryService.update(user.id, activeConversationId, { selectedCollectionId: nextCollectionId }).catch((error: unknown) => setHistoryError(error instanceof Error ? error.message : "Collection scope could not be saved."));
                setConversations((previous) => previous.map((entry) => entry.id === activeConversationId ? { ...entry, selectedCollectionId: nextCollectionId } : entry));
              }
            }}
            disabled={loading}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-xs text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            aria-label="Search within collection"
          >
            <option value="all">All collections</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>{collection.name}</option>
            ))}
          </select>
        </label>
        <label className="flex items-start gap-2 pt-1 text-xs text-zinc-500">
          <input
            type="checkbox"
            checked={allowExternalSynthesis}
            onChange={(event) => setAllowExternalSynthesis(event.target.checked)}
            disabled={loading}
            className="mt-0.5 accent-indigo-600"
          />
          <span>Allow external AI for this chat. This sends your question and up to 8 matching saved items to the configured provider. Workspace policy must also enable it.</span>
        </label>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${
              msg.sender === "user" ? "items-end" : "items-start"
            }`}
          >
            {msg.sender === "user" ? (
              <div className="max-w-xl p-4 rounded-2xl bg-indigo-600 text-white text-sm shadow-md rounded-br-xs leading-relaxed font-medium">
                {msg.content}
              </div>
            ) : (
              <div className="max-w-3xl w-full p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/80 shadow-xs space-y-4">
                <div className="flex items-center gap-2 text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                  <Sparkles className="w-4 h-4" />
                  Keeper Knowledge Synthesis
                </div>

                <div className="text-sm text-zinc-800 dark:text-zinc-200 leading-relaxed font-normal whitespace-pre-line">
                  {msg.content}
                  {msg.status === "failed" && <span className="mt-2 block text-xs text-rose-500">This turn did not complete.</span>}
                  {msg.providerNotice && <span className="mt-2 block text-xs text-amber-600 dark:text-amber-400">{msg.providerNotice}</span>}
                  {msg.unavailableSources && msg.unavailableSources.length > 0 && <span className="mt-2 block text-xs text-zinc-500">Saved source no longer available: {msg.unavailableSources.join(", ")}</span>}
                </div>

                {/* Key Insights List if present */}
                {msg.data?.keyInsights && msg.data.keyInsights.length > 0 && (
                  <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/80 dark:border-zinc-700/60 space-y-2">
                    <div className="text-xs font-bold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                      Key Takeaways from Your Library:
                    </div>
                    <ul className="space-y-1.5 text-xs text-zinc-700 dark:text-zinc-300">
                      {msg.data.keyInsights.map((insight, idx) => (
                        <li key={idx} className="flex items-start gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Referenced Source Cards */}
                {msg.data?.referencedItems && msg.data.referencedItems.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <div className="text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen className="w-3.5 h-3.5" />
                      Sources from your library ({msg.data.referencedItems.length})
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {msg.data.referencedItems.map((refItem) => (
                        <Link
                          key={refItem.id}
                          href={`/app/item/${refItem.id}`}
                          className="flex items-center gap-3 p-2.5 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 hover:border-indigo-500/40 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all group"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={refItem.thumbnail}
                            alt={refItem.title}
                            className="w-12 h-10 rounded-lg object-cover bg-zinc-100 dark:bg-zinc-800 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              <PlatformBadge platform={refItem.platform} showIconOnly />
                              <span className="text-[11px] text-zinc-500 truncate">
                                {refItem.creator.name}
                              </span>
                            </div>
                            <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">
                              {refItem.title}
                            </div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Follow up suggestions */}
                {msg.data?.suggestedFollowUps && msg.data.suggestedFollowUps.length > 0 && (
                  <div className="pt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-zinc-400 mr-1">Ask next:</span>
                    {msg.data.suggestedFollowUps.map((fu) => (
                      <button
                        key={fu}
                        onClick={() => handleAsk(fu)}
                        className="px-2.5 py-1 rounded-lg text-xs font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950 transition-colors"
                      >
                        {fu} →
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-3 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 text-zinc-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
            <span>Keeper is checking your saved sources and preparing a grounded answer...</span>
          </div>
        )}
      </div>

      {/* Input Box Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleAsk(query);
        }}
        className="flex items-center gap-2 p-2 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-lg shrink-0"
      >
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Ask a question about your saved library..."
          className="flex-1 px-4 py-2 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!query.trim() || loading}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-semibold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20"
        >
          <span>Send</span>
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
