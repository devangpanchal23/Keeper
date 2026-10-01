"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export function LandingNav() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 30);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled
          ? "py-3 bg-[#06070a]/85 backdrop-blur-xl border-b border-white/[0.08] shadow-2xl"
          : "py-6 bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between">
        {/* Brand Wordmark & Tactile Stamp */}
        <div className="flex items-center gap-3">
          <Link href="/" className="group flex items-center gap-2.5">
            <span className="font-mono text-sm uppercase tracking-[0.25em] font-extrabold text-white group-hover:text-zinc-300 transition-colors">
              RECALL<span className="text-emerald-400 font-normal">.</span>
            </span>
          </Link>

          <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[9px] uppercase tracking-widest text-zinc-400 border border-white/[0.1] bg-white/[0.02] px-2 py-0.5 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>VAULT 2.6</span>
          </span>
        </div>

        {/* Minimal Editorial Section Index Links */}
        <nav className="hidden md:flex items-center gap-8 text-[11px] uppercase tracking-[0.2em] font-mono text-zinc-400">
          <a href="#narrative" className="hover:text-white transition-colors">
            01 / Narrative
          </a>
          <a href="#transformation" className="hover:text-white transition-colors">
            02 / Transformation
          </a>
          <a href="#search" className="hover:text-white transition-colors">
            03 / Semantic AI
          </a>
          <a href="#collections" className="hover:text-white transition-colors">
            04 / Collections
          </a>
        </nav>

        {/* Direct Workspace Actions */}
        <div className="flex items-center gap-3.5">
          <Link
            href="/sign-in"
            className="text-[11px] uppercase tracking-[0.18em] font-mono text-zinc-400 hover:text-white transition-colors px-2.5 py-1"
          >
            Sign In
          </Link>

          <Link
            href="/app"
            className="group relative inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold bg-white text-black hover:bg-zinc-200 transition-all active:scale-95 shadow-md shadow-white/5"
          >
            <span>Launch Vault</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>

          {/* Mobile Menu Trigger */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden p-2 rounded-lg border border-white/[0.1] text-zinc-400 hover:text-white text-xs font-mono"
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? "CLOSE" : "MENU"}
          </button>
        </div>
      </div>

      {/* Mobile Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden px-6 pt-4 pb-6 bg-[#090b10] border-b border-white/[0.1] animate-in fade-in slide-in-from-top-2 duration-200">
          <nav className="flex flex-col gap-4 text-xs font-mono uppercase tracking-widest text-zinc-400">
            <a
              href="#narrative"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-white transition-colors"
            >
              01 / Narrative
            </a>
            <a
              href="#transformation"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-white transition-colors"
            >
              02 / Transformation
            </a>
            <a
              href="#search"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-white transition-colors"
            >
              03 / Semantic AI
            </a>
            <a
              href="#collections"
              onClick={() => setMobileMenuOpen(false)}
              className="py-1 hover:text-white transition-colors"
            >
              04 / Collections
            </a>
            <div className="pt-2 border-t border-white/[0.08] flex items-center justify-between">
              <Link
                href="/sign-in"
                onClick={() => setMobileMenuOpen(false)}
                className="hover:text-white"
              >
                Sign In
              </Link>
              <Link
                href="/app"
                onClick={() => setMobileMenuOpen(false)}
                className="px-4 py-2 rounded-full bg-white text-black font-semibold"
              >
                Open App
              </Link>
            </div>
          </nav>
        </div>
      )}
    </header>
  );
}
