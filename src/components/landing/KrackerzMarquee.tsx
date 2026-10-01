"use client";

import React from "react";

const MARQUEE_PULSES = [
  { text: "YOUTUBE TRANSCRIPTS", highlight: "4K HD" },
  { text: "REDDIT DISCUSSIONS", highlight: "OP CITATIONS" },
  { text: "INSTAGRAM REELS", highlight: "VERIFIED AUTHORS" },
  { text: "GITHUB REPOS & COMMITS", highlight: "CLEAN CODE" },
  { text: "ARXIV & PAPERS", highlight: "LATEX EXTRACT" },
  { text: "X / TWITTER THREADS", highlight: "MEDIA VAULT" },
  { text: "SUBSTACK & MEDIUM", highlight: "READER CLEAN" },
  { text: "ZERO HALLUCINATIONS", highlight: "GROUNDED" },
  { text: "MEDIAN LATENCY", highlight: "420ms" },
  { text: "SOVEREIGN DATA", highlight: "LOCAL-FIRST" },
];

export function KrackerzMarquee() {
  return (
    <div
      className="relative w-full bg-[#111111] text-[#F7F5EE] py-3.5 border-y-2 border-[#111111] overflow-hidden select-none"
      aria-label="Supported platforms and real-time capabilities"
    >
      {/* Moving Track */}
      <div className="flex animate-marquee whitespace-nowrap">
        {[...MARQUEE_PULSES, ...MARQUEE_PULSES].map((item, idx) => (
          <div key={idx} className="inline-flex items-center gap-3 mx-4 shrink-0">
            <span className="font-krackerz-display text-xs sm:text-sm tracking-wider uppercase text-white">
              {item.text}
            </span>
            <span className="font-krackerz-display text-[10px] uppercase px-2 py-0.5 rounded bg-[#4E0F15] text-[#C6FF2E] border border-white/20">
              {item.highlight}
            </span>
            <span className="text-[#C4271B] font-krackerz-display text-xs ml-1">✱</span>
          </div>
        ))}
      </div>
    </div>
  );
}
