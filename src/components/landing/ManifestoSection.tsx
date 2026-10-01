"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Zap,
  Lock,
  Cpu,
  Database,
  Search,
  Sparkles,
  ArrowRight,
  Flame,
  CheckCircle,
} from "lucide-react";

export function ManifestoSection() {
  return (
    <section className="relative py-32 px-4 sm:px-6 lg:px-8 bg-[#050608] border-t border-white/5 overflow-hidden">
      {/* Subtle architectural ambient aura */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-gradient-to-r from-amber-500/5 via-rose-500/5 to-indigo-500/5 blur-[140px] pointer-events-none rounded-full" />

      <div className="relative max-w-7xl mx-auto">
        {/* Monospaced archival header stamp */}
        <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-16">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-mono text-xs uppercase tracking-widest text-zinc-400">
              MANIFESTO / SYSTEM DOCTRINE
            </span>
          </div>

          <div className="font-mono text-xs text-zinc-500">
            ARTICLE REF // #009-RECALL
          </div>
        </div>

        {/* Giant brutalist oversized headline */}
        <div className="mb-20">
          <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white tracking-tight leading-[0.95] mb-8">
            THE INTERNET
            <br />
            IS DESIGNED TO MAKE
            <br />
            <span className="italic font-serif font-light text-zinc-500 hover:text-rose-400 transition-colors duration-500 cursor-default">
              YOU FORGET.
            </span>
            <br />
            WE DESIGNED THIS TO MAKE
            <br />
            <span className="bg-gradient-to-r from-amber-200 via-rose-300 to-indigo-200 bg-clip-text text-transparent">
              YOU UNSTOPPABLE.
            </span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pt-8 border-t border-white/10">
            <div className="md:col-span-4">
              <span className="font-mono text-xs text-amber-400 uppercase tracking-widest">
                The Fundamental Crisis
              </span>
              <p className="mt-2 text-xl font-bold text-white tracking-tight">
                Consumption is at an all-time peak. Retention is at absolute zero.
              </p>
            </div>

            <div className="md:col-span-8 space-y-4 text-base sm:text-lg text-zinc-400 font-light leading-relaxed">
              <p>
                Every day, you encounter breakthroughs: an architectural pattern in a GitHub issue, an astonishing color palette in an Instagram reel, a brutal investment post-mortem on Reddit, a 40-minute masterclass on YouTube.
              </p>
              <p>
                You click &lsquo;Save&rsquo;. And by tomorrow morning, the feed has washed it away. You remember that you saw something incredible, but you can&rsquo;t recall who said it, which platform it was on, or how to find it when you actually need to build.
              </p>
              <p className="text-white font-normal">
                Recall is your private second brain. It fetches real metadata, extracts actual transcripts and articles, indexes semantic meaning, and answers you with pinpoint provenance.
              </p>
            </div>
          </div>
        </div>

        {/* 4 Pillars of Deterministic Ingestion */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-20">
          {/* Pillar 1 */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-amber-400/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-amber-400/10 border border-amber-400/20 flex items-center justify-center text-amber-400 mb-6">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="font-mono text-xs text-amber-400 tracking-wider uppercase mb-2">
              Rule 01
            </div>
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
              Zero Hallucinations
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-light">
              AI must never guess what a URL contains. We fetch genuine creator data, raw descriptions, transcripts, and comments before any AI model touches the byte stream.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-rose-400/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-rose-400/10 border border-rose-400/20 flex items-center justify-center text-rose-400 mb-6">
              <Database className="w-5 h-5" />
            </div>
            <div className="font-mono text-xs text-rose-400 tracking-wider uppercase mb-2">
              Rule 02
            </div>
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
              Universal Normalization
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-light">
              Whether it&rsquo;s an Instagram carousel, an ArXiv paper, or a Reddit discussion, all data maps to a pristine, unified schema with creator attribution and permanent thumbnails.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-indigo-400/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-indigo-400/10 border border-indigo-400/20 flex items-center justify-center text-indigo-400 mb-6">
              <Search className="w-5 h-5" />
            </div>
            <div className="font-mono text-xs text-indigo-400 tracking-wider uppercase mb-2">
              Rule 03
            </div>
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
              Grounded Semantic Retrieval
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-light">
              Search the way human memory works: by vague concepts, partial memories, or high-level questions. Get matched directly to the exact video, quote, or thread.
            </p>
          </div>

          {/* Pillar 4 */}
          <div className="p-6 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-emerald-400/40 transition-all duration-300">
            <div className="w-10 h-10 rounded-xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 mb-6">
              <Lock className="w-5 h-5" />
            </div>
            <div className="font-mono text-xs text-emerald-400 tracking-wider uppercase mb-2">
              Rule 04
            </div>
            <h3 className="text-lg font-bold text-white mb-2 tracking-tight">
              Sovereign & Permanent
            </h3>
            <p className="text-sm text-zinc-400 leading-relaxed font-light">
              Your saved knowledge belongs to you. No algorithmic ad feeds, no attention auctions, no sponsored injections. Just your private, permanent digital archive.
            </p>
          </div>
        </div>

        {/* Verification Strip / Tactile Badges */}
        <div className="p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-amber-400/20 border border-amber-400/40 flex items-center justify-center text-amber-300 shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="text-base font-bold text-white">
                Deterministic Ingestion Architecture 2.6
              </div>
              <div className="text-xs text-zinc-400 font-mono mt-0.5">
                Verified against YouTube, Reddit, Instagram, GitHub, ArXiv, Substack & 5 other standards.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto justify-end">
            <Link
              href="/app"
              className="w-full md:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-full bg-white text-black font-semibold text-sm hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              <span>Test the Ingestion Engine</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
