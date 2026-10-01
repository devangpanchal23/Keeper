"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRecall } from "@/context/RecallContext";
import {
  ArrowRight,
  ArrowUpRight,
  Compass,
  CornerDownRight,
  Sparkles,
  ShieldCheck,
  Bookmark,
  ExternalLink,
} from "lucide-react";
import { PlatformBadge } from "@/components/common/PlatformBadge";

export interface HeroFragment {
  id: string;
  platform: "youtube" | "instagram" | "reddit" | "twitter" | "website";
  title: string;
  creator: string;
  handle?: string;
  thumbnail: string;
  meta: string;
  category: string;
  summary: string;
  keyPoints: string[];
  tags: string[];
  scatteredPos: { x: number; y: number; rotate: number };
}

export const HERO_FRAGMENTS: HeroFragment[] = [
  {
    id: "frag-yt",
    platform: "youtube",
    title: "10 React Performance Pitfalls Every Senior Dev Should Avoid in 2025",
    creator: "Theo Browne",
    handle: "@t3dotgg",
    thumbnail: "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&auto=format&fit=crop&q=80",
    meta: "18:42 • 4K Video",
    category: "React Learning",
    summary: "A deep dive into unnecessary re-renders, compiler optimizations with React 19, and bundle profiling.",
    keyPoints: [
      "Profiles render cycles before applying memoization",
      "Leverages React 19 compiler primitives",
      "Isolates costly leaf calculations cleanly",
    ],
    tags: ["React", "Performance", "Frontend"],
    scatteredPos: { x: -26, y: -16, rotate: -3 },
  },
  {
    id: "frag-ig",
    platform: "instagram",
    title: "Editorial Design Systems: Mastering Negative Space & Brutalist Layouts",
    creator: "Studio Minimal",
    handle: "@studiominimal",
    thumbnail: "https://images.unsplash.com/photo-1507238691740-187a5b1d37b8?w=800&auto=format&fit=crop&q=80",
    meta: "0:44 • Reel",
    category: "UI Inspiration",
    summary: "Key principles of asymmetric composition, oversized serif headlines, and deliberate negative space.",
    keyPoints: [
      "Negative space serves as an active visual element",
      "Pair microscopic labels with 96px headlines",
      "Restrict color palettes to monochrome + 1 tone",
    ],
    tags: ["Design", "Typography", "Editorial"],
    scatteredPos: { x: 28, y: -20, rotate: 3.5 },
  },
  {
    id: "frag-reddit",
    platform: "reddit",
    title: "What actually broke in our infrastructure when scaling to 1M daily active users",
    creator: "r/devops",
    handle: "u/cloud_architect",
    thumbnail: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=80",
    meta: "2.4k upvotes • 384 comments",
    category: "Engineering",
    summary: "Post-mortem analysis on connection pooling exhaustion, Redis cache thundering herds, and telemetry lag.",
    keyPoints: [
      "Implemented circuit breakers for downstream microservices",
      "Switched Redis locks to jittered leases",
      "Saved 60% compute with streaming telemetry",
    ],
    tags: ["DevOps", "Infrastructure", "Scale"],
    scatteredPos: { x: -30, y: 22, rotate: 2 },
  },
  {
    id: "frag-article",
    platform: "website",
    title: "Founder Mode & The Death of Consensus Architecture",
    creator: "Paul Graham",
    handle: "paulgraham.com",
    thumbnail: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80",
    meta: "7 min read • Essay",
    category: "Business Ideas",
    summary: "An analysis of why excessive management layers dilute product vision, and how founders maintain direct craft.",
    keyPoints: [
      "Skip-level reviews preserve radical clarity",
      "Treat architectural taste as an uncompromised standard",
      "Eliminate vanity metrics in favor of user telemetry",
    ],
    tags: ["Startups", "Strategy", "Leadership"],
    scatteredPos: { x: 25, y: 16, rotate: -2.5 },
  },
  {
    id: "frag-x",
    platform: "twitter",
    title: "Why deterministic sandboxes are the only way to make AI agents reliable",
    creator: "Andrej Karpathy",
    handle: "@karpathy",
    thumbnail: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80",
    meta: "8.9k likes • Technical RFC",
    category: "AI & Automation",
    summary: "Autonomous workflows fail when given unbounded tools. Deterministic state boundaries ensure zero divergence.",
    keyPoints: [
      "Bound agent tool executions to finite schema budgets",
      "Never allow LLMs to infer file contents without grounding",
      "Run evaluations on verified golden traces",
    ],
    tags: ["AI", "Agents", "Architecture"],
    scatteredPos: { x: 0, y: 26, rotate: 1 },
  },
];

export function HeroSection() {
  const { openAddContent } = useRecall();
  const [quickUrl, setQuickUrl] = useState("");
  const [compositionMode, setCompositionMode] = useState<"scattered" | "converged">("scattered");
  const [activeFragmentId, setActiveFragmentId] = useState<string>("frag-yt");

  const handleQuickIngest = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickUrl.trim()) {
      openAddContent(quickUrl.trim());
    } else {
      openAddContent("https://youtu.be/3lZF8W_AaUo");
    }
  };

  return (
    <section className="relative pt-32 sm:pt-40 pb-20 px-6 sm:px-8 max-w-7xl mx-auto flex flex-col items-center">
      {/* Micro Index Annotation */}
      <div className="inline-flex items-center gap-2.5 font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400 mb-6 border border-white/[0.08] bg-white/[0.02] px-3 py-1 rounded-full">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
        <span>REVERSE-ENGINEERED KNOWLEDGE VAULT</span>
      </div>

      {/* Massive Brutalist Headline */}
      <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-[88px] font-black tracking-[-0.04em] text-center leading-[0.96] text-white max-w-5xl mb-8 select-none">
        WE DON&apos;T JUST SAVE CONTENT. <br className="hidden sm:inline" />
        <span className="font-serif italic font-normal text-zinc-400">WE TURN IT INTO MEMORY.</span>
      </h1>

      {/* Deliberate Editorial Subtitle */}
      <p className="text-base sm:text-lg md:text-xl text-zinc-400 max-w-2xl text-center leading-relaxed font-normal mb-10">
        Universal ingestion for Instagram, YouTube, Reddit, X, and the open web.
        Grounded AI extracts genuine facts, tags concepts, and retrieves what you meant. Zero hallucinations.
      </p>

      {/* Primary Call to Action Strip */}
      <div className="flex flex-col sm:flex-row items-center gap-4 mb-14">
        <Link
          href="/app"
          className="w-full sm:w-auto px-8 py-3.5 rounded-full text-xs uppercase tracking-widest font-mono font-bold bg-white text-black hover:bg-zinc-200 transition-all flex items-center justify-center gap-2.5 group shadow-xl shadow-white/10 active:scale-95"
        >
          <span>Start Collecting</span>
          <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
        </Link>

        <a
          href="#narrative"
          className="w-full sm:w-auto px-7 py-3.5 rounded-full text-xs uppercase tracking-widest font-mono font-medium border border-white/[0.14] hover:border-white/30 text-zinc-300 hover:text-white transition-all flex items-center justify-center gap-2"
        >
          <span>Explore Architecture</span>
          <CornerDownRight className="w-3.5 h-3.5 text-zinc-500" />
        </a>
      </div>

      {/* Interactive Ingestion Console (Direct Product Hook) */}
      <div className="w-full max-w-xl mx-auto mb-16">
        <form
          onSubmit={handleQuickIngest}
          className="relative flex items-center rounded-2xl border border-white/[0.12] bg-[#0c0e14]/90 backdrop-blur-md p-1.5 focus-within:border-white/40 transition-colors shadow-2xl"
        >
          <div className="pl-3 pr-2 text-zinc-500">
            <Compass className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={quickUrl}
            onChange={(e) => setQuickUrl(e.target.value)}
            placeholder="Paste any YouTube, Instagram, Reddit, or article link..."
            className="flex-1 bg-transparent text-xs text-white placeholder-zinc-500 focus:outline-none py-2 font-mono"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-xl text-xs font-mono font-semibold bg-white/[0.08] hover:bg-white text-zinc-300 hover:text-black transition-all flex items-center gap-1.5"
          >
            <span>INGEST</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {/* Clickable Test Triggers */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 mt-3 text-[11px] font-mono text-zinc-500">
          <span>Try live URL:</span>
          <button
            type="button"
            onClick={() => openAddContent("https://youtu.be/3lZF8W_AaUo")}
            className="hover:text-zinc-300 transition-colors underline underline-offset-4 decoration-zinc-700"
          >
            YouTube Video
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => openAddContent("https://www.instagram.com/reel/C-xyz123/")}
            className="hover:text-zinc-300 transition-colors underline underline-offset-4 decoration-zinc-700"
          >
            Instagram Reel
          </button>
          <span>•</span>
          <button
            type="button"
            onClick={() => openAddContent("https://www.reddit.com/r/webdev/comments/react-perf")}
            className="hover:text-zinc-300 transition-colors underline underline-offset-4 decoration-zinc-700"
          >
            Reddit Post
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* TACTILE EPHEMERA COMPOSITION: SCATTERED INTERNET vs CONVERGED VAULT */}
      {/* ------------------------------------------------------------------- */}
      <div className="w-full relative mt-4 pt-6 border-t border-white/[0.08]">
        {/* State Toggle & Metadata Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-2 font-mono text-xs text-zinc-400">
            <span className="uppercase tracking-widest text-zinc-300 font-bold">
              [ STAGE 01 ]
            </span>
            <span>•</span>
            <span className="text-zinc-500">
              {compositionMode === "scattered"
                ? "Scattered Digital Chaos (Walled Gardens)"
                : "Converged Sovereign Library (Recall Engine)"}
            </span>
          </div>

          <div className="inline-flex items-center p-1 rounded-full border border-white/[0.1] bg-[#0c0e14] text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setCompositionMode("scattered")}
              className={`px-3 py-1 rounded-full transition-all ${
                compositionMode === "scattered"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Scattered Chaos
            </button>
            <button
              type="button"
              onClick={() => setCompositionMode("converged")}
              className={`px-3 py-1 rounded-full transition-all ${
                compositionMode === "converged"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Organized Vault
            </button>
          </div>
        </div>

        {/* Composition Canvas */}
        {compositionMode === "scattered" ? (
          /* SCATTERED VIEW: Realistic Tactile Floating Clippings */
          <div className="relative w-full h-[480px] sm:h-[520px] rounded-3xl border border-white/[0.08] bg-[#090b10] overflow-hidden p-6 flex items-center justify-center">
            {/* Watermark Label */}
            <div className="text-center z-0 opacity-25 select-none pointer-events-none max-w-sm">
              <span className="font-mono text-[10px] uppercase tracking-[0.3em] block text-zinc-400 mb-1">
                [ UNINDEXED CHAOS ]
              </span>
              <p className="text-xs font-mono text-zinc-500">
                Disconnected tabs. Lost bookmarks. Zero memory.
              </p>
            </div>

            {/* Tactile Content Clippings */}
            {HERO_FRAGMENTS.map((frag, idx) => {
              const isActive = activeFragmentId === frag.id;
              return (
                <div
                  key={frag.id}
                  onClick={() => setActiveFragmentId(frag.id)}
                  className={`absolute cursor-pointer transition-all duration-700 ease-out rounded-2xl border bg-[#11131c]/95 p-3.5 shadow-2xl backdrop-blur-md max-w-[270px] sm:max-w-[300px] ${
                    isActive
                      ? "border-white/50 ring-1 ring-white/30 scale-105 z-30"
                      : "border-white/[0.09] hover:border-white/25 z-10"
                  } ${idx % 2 === 0 ? "animate-float-1" : "animate-float-2"}`}
                  style={{
                    transform: `translate(${frag.scatteredPos.x * 3.8}px, ${
                      frag.scatteredPos.y * 3.6
                    }px) rotate(${frag.scatteredPos.rotate}deg)`,
                  }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <PlatformBadge platform={frag.platform} />
                    <span className="font-mono text-[9px] uppercase px-1.5 py-0.5 rounded bg-white/[0.04] text-zinc-400">
                      {frag.meta}
                    </span>
                  </div>

                  <div className="relative w-full h-24 rounded-lg overflow-hidden mb-2 bg-black/40">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={frag.thumbnail}
                      alt={frag.title}
                      className="w-full h-full object-cover opacity-85 hover:opacity-100 transition-opacity"
                    />
                  </div>

                  <h4 className="text-xs font-semibold text-white line-clamp-2 leading-snug mb-1">
                    {frag.title}
                  </h4>
                  <p className="text-[11px] text-zinc-400 font-mono truncate">
                    {frag.creator} {frag.handle && <span className="text-zinc-600">({frag.handle})</span>}
                  </p>
                </div>
              );
            })}
          </div>
        ) : (
          /* CONVERGED VIEW: Structured Library Vault Shelf */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 rounded-3xl border border-white/[0.08] bg-[#090b10] p-6 animate-in fade-in zoom-in-95 duration-500">
            {HERO_FRAGMENTS.slice(0, 3).map((frag) => (
              <div
                key={frag.id}
                className="rounded-2xl border border-white/[0.08] bg-[#11131c] p-4 flex flex-col justify-between hover:border-white/25 transition-colors group"
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <PlatformBadge platform={frag.platform} />
                    <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full border border-white/[0.08] text-zinc-400">
                      {frag.category}
                    </span>
                  </div>

                  <div className="relative w-full h-32 rounded-xl overflow-hidden mb-3 bg-black">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={frag.thumbnail}
                      alt={frag.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </div>

                  <h4 className="text-sm font-bold text-white mb-1.5 leading-snug">
                    {frag.title}
                  </h4>
                  <p className="text-xs text-zinc-400 mb-3 font-mono">
                    by <span className="text-zinc-200">{frag.creator}</span>
                  </p>

                  {/* AI Grounded Takeaway Box */}
                  <div className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06] mb-3">
                    <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase text-zinc-400 mb-1">
                      <Sparkles className="w-3 h-3 text-emerald-400" />
                      <span>AI Grounded Summary</span>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed font-normal">
                      {frag.summary}
                    </p>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 pt-2 border-t border-white/[0.06]">
                  {frag.tags?.map((t) => (
                    <span key={t} className="text-[10px] font-mono text-zinc-400">
                      #{t}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
