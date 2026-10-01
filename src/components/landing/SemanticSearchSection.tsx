"use client";

import React, { useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, Sparkles, ShieldCheck } from "lucide-react";
import { PlatformBadge } from "@/components/common/PlatformBadge";
import { HERO_FRAGMENTS } from "./HeroSection";

export const SEARCH_SIMULATIONS = [
  {
    query: "Find that video I saved about React performance",
    targetItem: HERO_FRAGMENTS[0],
    relevance: 99,
    rationale: "Matched query semantic intent with Theo Browne's React 19 compiler & render optimization video.",
    groundedAnswer:
      "You saved Theo Browne's '10 React Performance Pitfalls Every Senior Dev Should Avoid in 2025' on March 29. The key takeaway focuses on profiling render cycles before applying useMemo, and relying on React 19 compiler optimizations rather than manual dependency hacks.",
    provenance: "Grounded on Description + Transcript",
  },
  {
    query: "What did Karpathy say about making AI agents reliable?",
    targetItem: HERO_FRAGMENTS[4],
    relevance: 98,
    rationale: "Matched technical RFC thread discussing deterministic execution budgets and autonomous sandboxes.",
    groundedAnswer:
      "In the saved technical post from Andrej Karpathy, he explains that AI agents become unreliable when allowed unbounded tool access. The solution is enforcing deterministic execution boundaries, validating external schemas, and never letting models guess content without explicit groundings.",
    provenance: "Grounded on Verified Tweet Text",
  },
  {
    query: "What broke in the 1M user infrastructure post?",
    targetItem: HERO_FRAGMENTS[2],
    relevance: 97,
    rationale: "Matched Reddit devops post-mortem discussing Redis cache thundering herds and connection pooling.",
    groundedAnswer:
      "According to the saved post from r/devops, their outage was triggered by connection pooling exhaustion under surge traffic. They resolved it by introducing circuit breakers, migrating Redis locks to jittered leases, and streaming telemetry asynchronously.",
    provenance: "Grounded on Reddit Thread Body",
  },
];

export function SemanticSearchSection() {
  const [activeSearchIndex, setActiveSearchIndex] = useState(0);
  const currentSearch = SEARCH_SIMULATIONS[activeSearchIndex];

  return (
    <section id="search" className="py-24 sm:py-32 px-6 sm:px-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400 block font-bold">
          [ CORE INTELLIGENCE // SEMANTIC RETRIEVAL ]
        </span>
        <h2 className="text-4xl sm:text-5xl md:text-6xl font-black tracking-[-0.03em] text-white leading-tight">
          REMEMBER THE IDEA. <br />
          <span className="font-serif italic font-normal text-zinc-400">NOT THE FILENAME.</span>
        </h2>
        <p className="text-sm sm:text-base text-zinc-400 leading-relaxed font-normal">
          You will never remember the exact URL or timestamp. Recall understands human queries,
          searching directly across summaries, transcripts, captions, and personal notes.
        </p>
      </div>

      {/* Interactive Search Simulator Console */}
      <div className="rounded-3xl border border-white/[0.1] bg-[#0c0e14] p-6 sm:p-8 shadow-2xl space-y-8">
        {/* Query Selection Chips */}
        <div className="space-y-2.5">
          <span className="text-[11px] font-mono uppercase tracking-wider text-zinc-400 block font-semibold">
            Click to simulate human natural-language queries:
          </span>
          <div className="flex flex-wrap gap-2">
            {SEARCH_SIMULATIONS.map((sim, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => setActiveSearchIndex(idx)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-mono transition-all text-left ${
                  activeSearchIndex === idx
                    ? "bg-white text-black font-semibold shadow-md"
                    : "bg-white/[0.04] text-zinc-400 hover:text-white border border-white/[0.06]"
                }`}
              >
                &ldquo;{sim.query}&rdquo;
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Search Bar Display */}
        <div className="relative flex items-center rounded-2xl border border-white/20 bg-black/60 p-3 sm:p-4 text-sm font-mono shadow-inner">
          <Search className="w-5 h-5 text-zinc-400 shrink-0 mr-3" />
          <span className="text-white flex-1 font-sans text-sm sm:text-base">{currentSearch.query}</span>
          <span className="text-[10px] font-mono text-zinc-400 px-2 py-0.5 rounded border border-white/10 hidden sm:inline uppercase">
            SEMANTIC V2.6
          </span>
        </div>

        {/* Live Retrieval Output */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
          {/* Matching Saved Card */}
          <div className="lg:col-span-5 rounded-2xl border border-white/[0.08] bg-[#12141e] p-5 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <PlatformBadge platform={currentSearch.targetItem.platform} />
                <span className="font-mono text-xs font-bold text-emerald-400">
                  {currentSearch.relevance}% Match
                </span>
              </div>

              <div className="relative w-full h-36 rounded-xl overflow-hidden mb-3 bg-black">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={currentSearch.targetItem.thumbnail}
                  alt={currentSearch.targetItem.title}
                  className="w-full h-full object-cover"
                />
              </div>

              <h4 className="text-sm font-bold text-white mb-1 leading-snug">
                {currentSearch.targetItem.title}
              </h4>
              <p className="text-xs text-zinc-400 mb-2 font-mono">
                {currentSearch.targetItem.creator} • {currentSearch.targetItem.meta}
              </p>
            </div>

            <div className="pt-2.5 border-t border-white/[0.06] text-[11px] font-mono text-zinc-500">
              {currentSearch.rationale}
            </div>
          </div>

          {/* Synthesized Grounded Answer */}
          <div className="lg:col-span-7 rounded-2xl border border-white/[0.08] bg-[#0e1017] p-5 sm:p-6 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs font-mono text-zinc-400 pb-3 border-b border-white/[0.06]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="font-bold uppercase tracking-wider text-white">
                    SYNTHESIZED GROUNDED KNOWLEDGE
                  </span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold uppercase">
                  Zero Guessing
                </span>
              </div>

              <div className="mt-4 text-sm text-zinc-200 leading-relaxed font-normal">
                {currentSearch.groundedAnswer}
              </div>
            </div>

            <div className="pt-3 border-t border-white/[0.06] flex items-center justify-between text-xs font-mono text-zinc-500">
              <span className="text-[11px] text-zinc-400">{currentSearch.provenance}</span>
              <Link
                href="/app/search"
                className="text-white hover:underline flex items-center gap-1.5 font-bold"
              >
                <span>Launch Search</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
