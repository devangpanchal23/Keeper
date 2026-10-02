"use client";

import React from "react";
import { ScallopBadge } from "./ScallopBadge";
import { KRACKERZ_TOKENS } from "./krackerz-tokens";
import { SlidingNumber } from "@/components/animate-ui/primitives/texts/sliding-number";

export function FounderAboutSection() {
  // Enforce MAX 3 brand shades: brick, maroon, oxblood
  const stats = [
    { num: "11+", label: "NATIVE PLATFORM CONNECTORS", color: KRACKERZ_TOKENS.brick },
    { num: "100%", label: "GROUNDED ZERO-HALLUCINATION", color: KRACKERZ_TOKENS.maroon },
    { num: "420ms", label: "MEDIAN EXTRACTION TTFB", color: KRACKERZ_TOKENS.oxblood },
    { num: "42K+", label: "ACTIVE ARTICLES & VIDEOS INDEXED", color: KRACKERZ_TOKENS.brick },
  ];

  const milestones = [
    { engine: "Provider Normalizer 2.6", scope: "YouTube, Reddit, Instagram, X", status: "Verified Active" },
    { engine: "Local-First Semantic Vector Store", scope: "Client-side indexed retrieval", status: "Latency 18ms" },
    { engine: "Field Provenance Guarantee", scope: "Direct quote citations & timestamps", status: "SOC2 Compliance" },
  ];

  const platforms = [
    "YouTube",
    "Instagram",
    "Reddit",
    "GitHub",
    "ArXiv",
    "Substack",
    "Medium",
    "X / Twitter",
    "LinkedIn",
    "TikTok",
  ];

  return (
    <section className="relative py-28 sm:py-36 px-4 sm:px-6 lg:px-8 bg-white bg-dot-grid-white border-b-2 border-[#111111] overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Section Heading */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div className="inline-block bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xs uppercase px-4 py-1.5 rounded-full border-2 border-[#111111] shadow-[0_3px_0_#111111] mb-6">
            ARCHITECTURE & CRAFT // BEHIND THE ENGINE
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-krackerz-display text-[#111111] tracking-tight uppercase leading-[1.02]">
            MEET{" "}
            <span className="font-krackerz-script font-bold text-5xl sm:text-7xl text-[#C4271B] lowercase mx-1 inline-block -rotate-3">
              the engine
            </span>{" "}
            BEHIND RECALL
          </h2>

          <p className="mt-4 text-base sm:text-lg font-krackerz-body font-medium text-[#111111]/70 max-w-xl mx-auto">
            Built from scratch to eliminate digital amnesia. Here are the core metrics powering your private knowledge vault.
          </p>
        </div>

        {/* 2-Column Main Layout: Portrait + Floating Speech Bubble on Left, Stats + Table on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center mb-16">
          {/* Left Column: Wavy Frame Portrait + Floating Badge */}
          <div className="lg:col-span-5 relative flex flex-col items-center">
            {/* Scalloped / Wavy Portrait Frame */}
            <div className="relative w-64 sm:w-80 h-80 sm:h-96 rounded-3xl p-3 bg-[#4E0F15] border-3 border-[#111111] shadow-[0_16px_32px_rgba(0,0,0,0.22)]">
              <div className="w-full h-full rounded-2xl overflow-hidden bg-[#111111] border-2 border-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80"
                  alt="Lead Architect"
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Megaphone ScallopBadge (Cream with ink border) */}
              <div className="absolute -top-6 -left-6 z-20">
                <ScallopBadge
                  iconName="Megaphone"
                  bg="#F7F5EE"
                  size="md"
                  rotation={-12}
                />
              </div>

              {/* Floating Speech-Bubble Pill */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white text-[#111111] font-krackerz-display text-[10px] sm:text-xs px-3.5 sm:px-5 py-2 sm:py-2.5 rounded-full border-2 border-[#111111] shadow-[0_4px_0_#111111] flex items-center gap-1.5 sm:gap-2 max-w-[95%]">
                <span className="w-2 h-2 rounded-full bg-[#C4271B] animate-ping shrink-0" />
                <span className="truncate">&ldquo;Save once. Remember forever.&rdquo;</span>
              </div>
            </div>
          </div>

          {/* Right Column: 4 Stat Cards in Ladder + Milestones */}
          <div className="lg:col-span-7 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {stats.map((s, idx) => (
                <div
                  key={idx}
                  style={{ backgroundColor: s.color }}
                  className="p-4 sm:p-6 rounded-2xl border-2 border-[#111111] text-white shadow-[0_6px_0_#111111] transition-transform hover:-translate-y-1"
                >
                  <div className="text-3xl sm:text-5xl font-krackerz-display text-white mb-1">
                    <SlidingNumber value={s.num} />
                  </div>
                  <div className="font-krackerz-body font-bold text-xs uppercase tracking-wider text-white/90">
                    {s.label}
                  </div>
                </div>
              ))}
            </div>

            {/* Architecture Milestones Table */}
            <div className="bg-[#F7F5EE] rounded-2xl border-2 border-[#111111] p-5 sm:p-6 shadow-[0_6px_0_#111111]">
              <div className="flex items-center justify-between pb-3 border-b-2 border-[#111111]/20 font-krackerz-display text-xs text-[#111111] uppercase tracking-wider mb-3">
                <span>SYSTEM SUBSYSTEM</span>
                <span>TELEMETRY STATUS</span>
              </div>

              <div className="space-y-3">
                {milestones.map((m, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs font-krackerz-body pb-2 border-b border-[#111111]/10 last:border-b-0"
                  >
                    <div>
                      <span className="font-bold text-[#111111]">{m.engine}</span>
                      <span className="text-[#111111]/60 ml-2 font-mono text-[11px]">({m.scope})</span>
                    </div>
                    <span className="font-krackerz-display text-[10px] text-[#C4271B] bg-white border border-[#111111]/20 px-2 py-0.5 rounded self-start sm:self-auto">
                      {m.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Integration Logo Chips Bar (Cream neutrals with ink border) */}
        <div className="pt-8 border-t-2 border-[#111111]/15 text-center">
          <div className="font-krackerz-display text-xs uppercase text-[#111111]/60 tracking-widest mb-4">
            NATIVELY EXTRACTING REAL METADATA FROM:
          </div>
          <div className="flex items-center justify-center flex-wrap gap-2.5">
            {platforms.map((p, idx) => (
              <span
                key={idx}
                className="bg-[#F7F5EE] text-[#111111] font-krackerz-display text-xs uppercase px-3.5 py-1.5 rounded-full border border-[#111111] shadow-sm hover:scale-105 transition-transform cursor-default"
              >
                {p}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
