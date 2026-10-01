"use client";

import React from "react";
import { AlertTriangle, Clock, Layers, SearchX, ShieldAlert } from "lucide-react";

export function ProblemSection() {
  return (
    <section id="narrative" className="py-24 sm:py-32 px-6 sm:px-8 max-w-7xl mx-auto border-t border-white/[0.08]">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
        {/* Sticky Editorial Narrative Side */}
        <div className="lg:col-span-5 lg:sticky lg:top-32 space-y-6">
          <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.25em] text-rose-400 border border-rose-500/20 bg-rose-500/10 px-2.5 py-0.5 rounded-full">
            <AlertTriangle className="w-3 h-3" />
            <span>CHAPTER 01 // THE DIGITAL AMNESIA</span>
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-[-0.04em] text-white leading-[1.02]">
            YOU SAVE EVERYWHERE. <br />
            <span className="font-serif italic font-normal text-zinc-500">AND FIND NOTHING.</span>
          </h2>

          <p className="text-base text-zinc-400 leading-relaxed font-normal">
            A saved reel on Instagram. A bookmarked thread on X. An unindexed YouTube playlist with 800 unwatched videos.
            A Reddit post you swore you’d reread. Your knowledge is scattered across walled gardens, buried under algorithms, and forgotten inside tabs.
          </p>

          <div className="pt-4 border-t border-white/[0.08] grid grid-cols-2 gap-4 font-mono text-xs">
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase">Average Weekly Saves</span>
              <span className="text-xl font-bold text-white">42 Links</span>
            </div>
            <div>
              <span className="text-zinc-500 block text-[10px] uppercase">Successfully Retrievable</span>
              <span className="text-xl font-bold text-rose-400">&lt; 8%</span>
            </div>
          </div>
        </div>

        {/* The 47-Tab Cemetery Visual */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-3xl border border-white/[0.08] bg-[#0c0e14] p-6 sm:p-8 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between text-xs font-mono text-zinc-500 pb-4 border-b border-white/[0.06]">
              <span>BROWSER REALITY // CEMETERY DIAGNOSIS</span>
              <span className="text-rose-400 flex items-center gap-1 font-semibold">
                <SearchX className="w-3.5 h-3.5" /> 47 TABS LOST
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Instagram Card Failure */}
              <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#11131c] space-y-3 relative overflow-hidden group hover:border-white/20 transition-colors">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="text-zinc-400">instagram.com/reel/...</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase font-bold">
                    Lost
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Saved a 40-second tutorial on CSS grid auto-fit. No search bar. Zero keyword indexing.
                  Good luck scrolling back through 9 months of saved recipes.
                </p>
                <div className="font-mono text-[10px] text-zinc-600 pt-2 border-t border-white/[0.04]">
                  STATUS: AMNESIA
                </div>
              </div>

              {/* Reddit Post Failure */}
              <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#11131c] space-y-3 relative overflow-hidden group hover:border-white/20 transition-colors">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="text-zinc-400">reddit.com/r/webdev</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase font-bold">
                    Buried
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Remembered a senior engineer’s production post-mortem on database connection pool crashes.
                  What was the username? Which subreddit? Disappeared into feed oblivion.
                </p>
                <div className="font-mono text-[10px] text-zinc-600 pt-2 border-t border-white/[0.04]">
                  STATUS: AMNESIA
                </div>
              </div>

              {/* YouTube Video Failure */}
              <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#11131c] space-y-3 relative overflow-hidden group hover:border-white/20 transition-colors">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="text-zinc-400">youtube.com/watch</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase font-bold">
                    Unwatched
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Watched 12 minutes of an 80-minute podcast detailing exact morning sunlight &amp; melatonin protocols.
                  Forgot the minute mark. Never transcribed. Never recalled.
                </p>
                <div className="font-mono text-[10px] text-zinc-600 pt-2 border-t border-white/[0.04]">
                  STATUS: AMNESIA
                </div>
              </div>

              {/* Screenshot Image Failure */}
              <div className="p-5 rounded-2xl border border-white/[0.06] bg-[#11131c] space-y-3 relative overflow-hidden group hover:border-white/20 transition-colors">
                <div className="flex items-center justify-between font-mono text-[10px]">
                  <span className="text-zinc-400">screenshot_2025.png</span>
                  <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 uppercase font-bold">
                    Decayed
                  </span>
                </div>
                <p className="text-xs text-zinc-300 leading-relaxed">
                  Took a quick phone screenshot of an architectural diagram.
                  It now sits trapped forever between photos of groceries and dog pictures.
                </p>
                <div className="font-mono text-[10px] text-zinc-600 pt-2 border-t border-white/[0.04]">
                  STATUS: AMNESIA
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
