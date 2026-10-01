"use client";

import React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Terminal, CheckCircle2, Shield, Zap } from "lucide-react";

export function CtaSection() {
  return (
    <section className="relative py-32 px-4 sm:px-6 lg:px-8 bg-[#030406] border-t border-white/10 overflow-hidden">
      {/* Dynamic ambient lights */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[350px] bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-indigo-500/10 blur-[130px] pointer-events-none rounded-full" />

      {/* Grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)`,
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative max-w-5xl mx-auto text-center">
        {/* Archival Stamp */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono tracking-widest uppercase text-white/70 mb-8 backdrop-blur-md">
          <Terminal className="w-3.5 h-3.5 text-amber-400" />
          <span>PRODUCTION VAULT READY // NO SETUP REQUIRED</span>
        </div>

        {/* Hero Final Statement */}
        <h2 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black text-white tracking-tight leading-[0.98] mb-8">
          YOUR INTERNET
          <br />
          <span className="bg-gradient-to-r from-amber-300 via-rose-300 to-indigo-300 bg-clip-text text-transparent">
            HAS A MEMORY NOW.
          </span>
        </h2>

        <p className="max-w-2xl mx-auto text-base sm:text-xl text-zinc-400 font-light leading-relaxed mb-12">
          Stop losing the most valuable ideas, videos, and discussions you encounter. Paste any link, extract true metadata, and query your knowledge effortlessly.
        </p>

        {/* Primary Interactive CTA Cluster */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16">
          <Link
            href="/app"
            className="group relative w-full sm:w-auto inline-flex items-center justify-center gap-3 px-8 py-4.5 rounded-full bg-white text-black font-bold text-base hover:bg-zinc-100 transition-all duration-300 shadow-[0_0_50px_rgba(255,255,255,0.3)] hover:shadow-[0_0_70px_rgba(255,255,255,0.5)] hover:scale-[1.03]"
          >
            <Sparkles className="w-4 h-4 text-amber-600 transition-transform group-hover:rotate-12" />
            <span>Open Recall Workspace</span>
            <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
          </Link>

          <Link
            href="/sign-in"
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/15 text-white font-medium text-base transition-all duration-300 backdrop-blur-sm"
          >
            <span>Sign In to Your Vault</span>
          </Link>
        </div>

        {/* Tactile System Specifications Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-10 border-t border-white/10 max-w-4xl mx-auto text-left">
          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Extraction</span>
            </div>
            <div className="text-sm font-bold text-white">Sub-500ms TTFB</div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">Direct API & scraper</div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1">
              <Shield className="w-3.5 h-3.5 text-emerald-400" />
              <span>Accuracy</span>
            </div>
            <div className="text-sm font-bold text-white">100% Grounded</div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">Strict zero-hallucination</div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Platforms</span>
            </div>
            <div className="text-sm font-bold text-white">11 Native Connectors</div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">YouTube, Reddit & more</div>
          </div>

          <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5">
            <div className="flex items-center gap-1.5 text-xs font-mono text-zinc-500 uppercase tracking-wider mb-1">
              <Terminal className="w-3.5 h-3.5 text-indigo-400" />
              <span>Storage</span>
            </div>
            <div className="text-sm font-bold text-white">Encrypted & Sovereign</div>
            <div className="text-[11px] text-zinc-500 font-mono mt-0.5">Export anytime as JSON</div>
          </div>
        </div>
      </div>
    </section>
  );
}
