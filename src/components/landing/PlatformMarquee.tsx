"use client";

import React from "react";
import { PlatformBadge } from "@/components/common/PlatformBadge";
import { Platform } from "@/types";

export interface MarqueeItem {
  platform: Platform;
  title: string;
  creator: string;
  badge: string;
}

export const MARQUEE_ITEMS: MarqueeItem[] = [
  { platform: "youtube", title: "10 React Performance Pitfalls Every Senior Dev Avoids", creator: "Theo Browne", badge: "18:42" },
  { platform: "instagram", title: "Brutalist Negative Space & Editorial Layouts", creator: "@studiominimal", badge: "Reel" },
  { platform: "reddit", title: "What broke in our infrastructure when scaling to 1M DAU", creator: "r/devops", badge: "2.4k upvotes" },
  { platform: "twitter", title: "Why deterministic sandboxes are the only way to make AI agents reliable", creator: "Andrej Karpathy", badge: "Technical RFC" },
  { platform: "tiktok", title: "15-Minute High-Protein Salmon Prep Meal Plan", creator: "@healthchef", badge: "0:52" },
  { platform: "linkedin", title: "Founder Mode: The Death of Consensus Management", creator: "Elena Verna", badge: "Article" },
  { platform: "github", title: "tailwindlabs/tailwindcss v4 CSS engine source", creator: "Adam Wathan", badge: "Repository" },
  { platform: "pinterest", title: "Archival Swiss Poster Typographic Inspiration", creator: "Curator_88", badge: "Pin" },
  { platform: "threads", title: "Why CSS custom properties beat runtime theme recalculations", creator: "Josh W. Comeau", badge: "Post" },
  { platform: "blog", title: "Understanding LLM Embedding Distance & Rerankers", creator: "Eugene Yan", badge: "Deep Dive" },
];

export function PlatformMarquee() {
  return (
    <section className="py-20 border-t border-b border-white/[0.08] bg-[#050608] overflow-hidden">
      <div className="max-w-7xl mx-auto px-6 sm:px-8 mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <span className="font-mono text-[10px] uppercase tracking-[0.25em] text-zinc-400 block mb-2 font-bold">
            [ ECOSYSTEM INTEGRATION // 11 PLATFORMS ]
          </span>
          <h2 className="text-2xl sm:text-4xl font-extrabold text-white tracking-tight uppercase">
            From everywhere you already explore.
          </h2>
        </div>
        <p className="text-xs font-mono text-zinc-400 max-w-sm leading-relaxed">
          YouTube, Instagram, Reddit, X, LinkedIn, TikTok, GitHub, and any web article seamlessly verified and saved into one sovereign knowledge vault.
        </p>
      </div>

      {/* Infinite Gliding Content Stream */}
      <div className="relative w-full overflow-hidden">
        <div className="animate-marquee flex gap-4 py-2">
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, idx) => (
            <div
              key={idx}
              className="w-72 shrink-0 p-4 rounded-2xl border border-white/[0.08] bg-[#0c0e14] hover:border-white/30 transition-all cursor-pointer flex flex-col justify-between group shadow-lg"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <PlatformBadge platform={item.platform} />
                  <span className="font-mono text-[10px] text-zinc-500 uppercase px-1.5 py-0.5 rounded bg-white/[0.04]">
                    {item.badge}
                  </span>
                </div>
                <h4 className="text-xs font-semibold text-white line-clamp-2 leading-snug mb-1 group-hover:text-zinc-200 transition-colors">
                  {item.title}
                </h4>
              </div>
              <p className="text-[11px] font-mono text-zinc-400 pt-2.5 border-t border-white/[0.04] truncate">
                by <span className="text-zinc-300">{item.creator}</span>
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
