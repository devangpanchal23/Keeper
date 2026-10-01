"use client";

import React from "react";
import Link from "next/link";
import { ArrowUp, Terminal, Shield, Sparkles, Heart } from "lucide-react";

export function LandingFooter() {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <footer className="relative bg-[#020305] text-zinc-400 border-t border-white/10 pt-20 pb-12 px-4 sm:px-6 lg:px-8 overflow-hidden">
      <div className="max-w-7xl mx-auto">
        {/* Main Grid */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-20">
          {/* Brand & Manifesto Column */}
          <div className="col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-400 via-rose-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm">
                R
              </div>
              <span className="font-mono text-sm font-bold tracking-widest text-white uppercase">
                RECALL // VAULT
              </span>
            </div>

            <p className="text-sm text-zinc-400 leading-relaxed font-light max-w-sm mb-6">
              The universal knowledge retention engine. Saving URLs with genuine metadata, zero-hallucination extraction, and instant natural-language semantic recall.
            </p>

            {/* Live Operational Status Badge */}
            <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/10 text-xs font-mono text-zinc-400">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>SYSTEM NOMINAL // API v2.6 ACTIVE</span>
            </div>
          </div>

          {/* Column: Workspace */}
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-white font-bold mb-4">
              Workspace
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/app" className="hover:text-white transition-colors">
                  My Vault
                </Link>
              </li>
              <li>
                <Link href="/app/library" className="hover:text-white transition-colors">
                  All Items
                </Link>
              </li>
              <li>
                <Link href="/app/collections" className="hover:text-white transition-colors">
                  Collections
                </Link>
              </li>
              <li>
                <Link href="/app/search" className="hover:text-white transition-colors">
                  Semantic Search
                </Link>
              </li>
              <li>
                <Link href="/app/favorites" className="hover:text-white transition-colors">
                  Favorites
                </Link>
              </li>
            </ul>
          </div>

          {/* Column: Connectors */}
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-white font-bold mb-4">
              Connectors
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  YouTube & Shorts
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Reddit & Comments
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Instagram & Reels
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  GitHub & Issues
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  ArXiv & Research
                </span>
              </li>
              <li>
                <span className="hover:text-white transition-colors cursor-default">
                  Substack & Articles
                </span>
              </li>
            </ul>
          </div>

          {/* Column: Security & Auth */}
          <div>
            <div className="font-mono text-xs uppercase tracking-widest text-white font-bold mb-4">
              Access
            </div>
            <ul className="space-y-2.5 text-sm">
              <li>
                <Link href="/sign-in" className="hover:text-white transition-colors">
                  Sign In
                </Link>
              </li>
              <li>
                <Link href="/app/settings" className="hover:text-white transition-colors">
                  Vault Settings
                </Link>
              </li>
              <li>
                <span className="text-zinc-600 cursor-default">Privacy Policy</span>
              </li>
              <li>
                <span className="text-zinc-600 cursor-default">Terms of Service</span>
              </li>
              <li>
                <span className="text-zinc-600 cursor-default">Export Data (.json)</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Massive Architectural Wordmark */}
        <div className="border-t border-b border-white/5 py-12 my-12 text-center select-none overflow-hidden">
          <div className="text-[12vw] font-black tracking-[0.25em] text-white/[0.04] leading-none whitespace-nowrap">
            R E C A L L
          </div>
        </div>

        {/* Bottom Details & Back to Top */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-mono text-zinc-500">
          <div>
            &copy; {new Date().getFullYear()} RECALL KNOWLEDGE SYSTEMS. ZERO-HALLUCINATION GUARANTEED.
          </div>

          <button
            onClick={scrollToTop}
            className="group inline-flex items-center gap-2 hover:text-white transition-colors px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 bg-white/[0.02]"
          >
            <span>BACK TO TOP</span>
            <ArrowUp className="w-3.5 h-3.5 transition-transform group-hover:-translate-y-0.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
