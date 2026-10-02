"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRecall } from "@/context/RecallContext";
import { AIService, AssistantAnswer } from "@/services/ai-service";
import { PlatformBadge } from "@/components/common/PlatformBadge";
import {
  Brain,
  Sparkles,
  Send,
  Loader2,
  BookOpen,
  ArrowRight,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  Folder,
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
}

export default function AIAssistantPage() {
  const { items, collections } = useRecall();
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);

  // Initial welcome message + default React performance response
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "msg-welcome",
      sender: "assistant",
      content:
        "Hello! I am your **Keeper Knowledge Assistant**. Ask me anything about what you've saved across YouTube, Instagram, Reddit, X, LinkedIn, and the web. I synthesize answers directly from your library with source citations.",
    },
  ]);

  const handleAsk = async (textToAsk: string) => {
    const q = textToAsk.trim();
    if (!q || loading) return;

    const userMsgId = `user-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: userMsgId, sender: "user", content: q },
    ]);
    setQuery("");
    setLoading(true);

    try {
      const response = await AIService.queryAssistant(q, items, collections);

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender: "assistant",
          content: response.answer,
          data: response,
        },
      ]);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    setMessages([
      {
        id: "msg-welcome-new",
        sender: "assistant",
        content:
          "Conversation cleared. What topic or saved bookmarks would you like to explore today?",
      },
    ]);
  };

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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-zinc-200 dark:border-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Chat
        </button>
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
            <span>Keeper is searching your saves and synthesizing an answer...</span>
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
