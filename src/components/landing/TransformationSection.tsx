"use client";

import React, { useState } from "react";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import { PlatformBadge } from "@/components/common/PlatformBadge";

export function TransformationSection() {
  const [activeTab, setActiveTab] = useState<"after" | "before">("after");

  return (
    <section id="transformation" className="py-24 sm:py-32 px-6 sm:px-8 bg-[#f3f2ee] text-[#121316] transition-colors relative overflow-hidden">
      {/* Editorial Watermark */}
      <div className="max-w-7xl mx-auto space-y-16">
        {/* Section Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-black/[0.08] pb-10">
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-emerald-800 border border-emerald-800/30 bg-emerald-500/10 px-2.5 py-0.5 rounded-full font-bold">
              <ShieldCheck className="w-3 h-3 text-emerald-700" />
              <span>CHAPTER 02 // ZERO-HALLUCINATION TRANSFORMATION</span>
            </div>

            <h2 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-[-0.04em] text-[#121316] leading-[0.96]">
              DON&apos;T JUST SAVE IT. <br />
              <span className="font-serif italic font-normal text-zinc-600">UNDERSTAND IT.</span>
            </h2>
          </div>

          <p className="text-sm sm:text-base text-zinc-600 max-w-md font-normal leading-relaxed">
            Raw links are dead weight without comprehension. Recall extracts verified source data,
            transcribes audio, captures captions, and preserves immutable data provenance. Zero hallucinated facts.
          </p>
        </div>

        {/* 3-Step Canonical Pipeline Strip */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-mono text-xs">
          <div className="p-6 rounded-2xl border border-black/[0.08] bg-white/70 backdrop-blur-sm space-y-2">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-widest">
              STAGE 01
            </span>
            <h4 className="text-base font-bold text-[#121316]">Canonical ID Extraction</h4>
            <p className="text-xs text-zinc-600 leading-relaxed font-sans">
              Strips tracking parameters (`utm_*`, `fbclid`, `si`). Identifies exact video IDs, tweet status numbers, and post permalinks.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-black/[0.08] bg-white/70 backdrop-blur-sm space-y-2">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-widest">
              STAGE 02
            </span>
            <h4 className="text-base font-bold text-[#121316]">Real Metadata Fetch</h4>
            <p className="text-xs text-zinc-600 leading-relaxed font-sans">
              Queries official oEmbed endpoints. Pulls authentic titles, channel creators, verified thumbnails, and post bodies.
            </p>
          </div>

          <div className="p-6 rounded-2xl border border-black/[0.08] bg-white/70 backdrop-blur-sm space-y-2">
            <span className="text-[10px] uppercase font-bold text-zinc-400 block tracking-widest">
              STAGE 03
            </span>
            <h4 className="text-base font-bold text-[#121316]">Grounded Synthesis</h4>
            <p className="text-xs text-zinc-600 leading-relaxed font-sans">
              Generates takeaways ONLY when real source content exists. Empty takeaways on metadata-only links. Zero guessing.
            </p>
          </div>
        </div>

        {/* Before vs After Visual Comparison Showcase */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center pt-8">
          {/* Before: Raw Dead URL */}
          <div className="lg:col-span-5 rounded-3xl border border-black/[0.1] bg-[#e7e5de] p-7 space-y-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs font-mono pb-3 border-b border-black/[0.08]">
                <span className="font-bold text-zinc-500 uppercase tracking-widest">BEFORE RECALL</span>
                <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-700 font-bold border border-rose-500/20 text-[10px]">
                  DEAD URL
                </span>
              </div>

              <div className="mt-4 p-3.5 rounded-xl bg-white/80 border border-black/[0.06] font-mono text-xs text-zinc-700 break-all select-all">
                https://www.youtube.com/watch?v=3lZF8W_AaUo&amp;utm_source=twitter&amp;feature=share
              </div>

              <div className="mt-6 space-y-3 font-mono text-xs text-zinc-600">
                <div className="flex items-center gap-2 text-rose-700">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Missing title &amp; creator identity</span>
                </div>
                <div className="flex items-center gap-2 text-rose-700">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Zero semantic searchability</span>
                </div>
                <div className="flex items-center gap-2 text-rose-700">
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>No key ideas extracted</span>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-black/[0.08] font-mono text-[10px] text-zinc-500">
              RESULT: LOST IN DIGITAL NOISE
            </div>
          </div>

          {/* Center Visual Arrow */}
          <div className="lg:col-span-2 flex justify-center">
            <div className="w-12 h-12 rounded-full bg-[#121316] text-white flex items-center justify-center shadow-lg font-mono">
              <ArrowRight className="w-5 h-5" />
            </div>
          </div>

          {/* After: Enriched Sovereign Vault Asset */}
          <div className="lg:col-span-5 rounded-3xl border border-black/15 bg-white p-7 space-y-4 shadow-2xl relative">
            <div className="flex items-center justify-between text-xs font-mono pb-3 border-b border-black/[0.08]">
              <div className="flex items-center gap-2">
                <PlatformBadge platform="youtube" />
                <span className="font-bold text-emerald-700 uppercase tracking-widest">
                  RECALL VAULT
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-800 font-bold border border-emerald-500/20 text-[10px]">
                FULL_CONTENT
              </span>
            </div>

            <h3 className="text-base font-extrabold text-[#121316] leading-snug">
              10 React Performance Pitfalls Every Senior Dev Should Avoid in 2025
            </h3>

            <p className="text-xs text-zinc-600 font-mono">
              Channel: <span className="font-bold text-[#121316]">Theo Browne (@t3dotgg)</span>
            </p>

            {/* Grounded Summary Box */}
            <div className="p-4 rounded-2xl bg-[#f8f7f4] border border-black/[0.06] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono uppercase font-bold text-zinc-500">
                <span className="flex items-center gap-1.5 text-emerald-800">
                  <Sparkles className="w-3.5 h-3.5" /> GROUNDED AI SYNTHESIS
                </span>
                <span className="text-zinc-500">100% VERIFIED</span>
              </div>
              <p className="text-xs text-zinc-800 leading-relaxed font-sans">
                A deep dive into unnecessary render cycles, compiler optimizations in React 19, and bundle size profiling.
              </p>
              <div className="space-y-1 pt-1 font-mono text-[11px] text-zinc-700">
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Measure render cost before adding useMemo</span>
                </div>
                <div className="flex items-start gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                  <span>React 19 compiler minimizes manual memoization</span>
                </div>
              </div>
            </div>

            {/* Provenance Badge */}
            <div className="pt-3 border-t border-black/[0.08] flex items-center justify-between font-mono text-[10px] text-zinc-600">
              <span>TITLE: YOUTUBE OEMBED</span>
              <span>GROUNDED ON: DESCRIPTION + AUDIO</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
