"use client";

import React from "react";
import Link from "next/link";
import { ArrowUp, ArrowUpRight } from "lucide-react";
import { StickerLabel } from "./StickerLabel";
import { CTAButton } from "./CTAButton";
import { ScallopBadge } from "./ScallopBadge";
import { ScallopDivider } from "./ScallopDivider";
import { useRecall } from "@/context/RecallContext";
import { ROUTES } from "@/config/routes";

// Resilient inline brand SVGs to prevent Lucide brand icon deprecation errors
const YoutubeIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
  </svg>
);

const XTwitterIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const GithubIcon: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
  </svg>
);

export function FinalCtaFooter() {
  const { openAddContent } = useRecall();

  const scrollToTop = () => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <div className="relative bg-krackerz-cream bg-dot-grid overflow-hidden">
      {/* Upper CTA Section with Rising Deep Oxblood Cloud */}
      <section className="relative pt-24 pb-36 px-4 sm:px-6 lg:px-8">
        {/* Floating Decorative Badges with Parallax Feeling (Cream with ink border) */}
        <div className="absolute top-16 left-8 sm:left-24 animate-float-1 pointer-events-none hidden sm:block">
          <ScallopBadge iconName="Rocket" bg="#F7F5EE" size="md" rotation={-14} />
        </div>
        <div className="absolute top-20 right-8 sm:right-28 animate-float-2 pointer-events-none hidden sm:block">
          <ScallopBadge iconName="Trophy" bg="#C4271B" iconColor="#FFFFFF" size="md" rotation={16} />
        </div>
        <div className="absolute bottom-40 left-12 sm:left-36 animate-float-2 pointer-events-none hidden md:block">
          <ScallopBadge iconName="Brain" bg="#F7F5EE" size="sm" rotation={-8} />
        </div>

        {/* Giant Deep Oxblood Cloud Shape Rising from Below */}
        <div className="relative max-w-5xl mx-auto rounded-[32px] sm:rounded-[60px] bg-[#4E0F15] text-white p-6 sm:p-20 text-center border-3 sm:border-4 border-[#111111] shadow-[0_24px_60px_rgba(0,0,0,0.35)] overflow-hidden">
          {/* Subtle Inner Accent Blob */}
          <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[#C4271B]/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 max-w-3xl mx-auto">
            {/* Stamp Tag */}
            <div className="inline-block bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xs uppercase px-4 py-1.5 rounded-full border-2 border-white shadow-[0_3px_0_#ffffff] mb-6 sm:mb-8 max-w-full truncate">
              PERMANENT MEMORY // INSTANT SETUP
            </div>

            {/* Headline with script & sticker */}
            <h2 className="text-3xl sm:text-6xl md:text-7xl font-krackerz-display text-white tracking-tight uppercase leading-[0.98] mb-6 sm:mb-8 select-none">
              BE THE{" "}
              <span className="font-krackerz-script font-bold text-4xl sm:text-7xl text-[#C4271B] lowercase mx-1 inline-block -rotate-6">
                first
              </span>{" "}
              TO
              <br />
              <StickerLabel rotation={-3} size="xl" className="mt-2">
                RECALL
              </StickerLabel>
            </h2>

            <p className="text-sm sm:text-xl font-krackerz-body font-medium text-white/85 max-w-xl mx-auto leading-relaxed mb-8 sm:mb-10">
              Stop losing breakthrough ideas to the endless scroll. Start saving and retrieving in seconds with genuine metadata.
            </p>

            {/* CTAs: Single Primary Lime CTA for Final Viewport */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <CTAButton
                onClick={() => openAddContent()}
                variant="primary-lime"
                size="lg"
              >
                OPEN RECALL VAULT
              </CTAButton>

              <Link
                href="/sign-in"
                className="font-krackerz-display text-xs uppercase px-6 py-4 rounded-full bg-white text-[#111111] border-2 border-[#111111] shadow-[0_4px_0_#111111] hover:shadow-[0_6px_0_#111111] hover:-translate-y-0.5 transition-all"
              >
                SIGN IN TO VAULT
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Deep Oxblood Bottom Footer with Seamless Scalloped Cloud Top */}
      <footer className="relative bg-[#4E0F15] text-white pt-16 pb-12 px-4 sm:px-6 lg:px-8 border-t-2 border-[#111111]">
        {/* Scalloped top transition on footer */}
        <div className="absolute -top-9 left-0 right-0">
          <ScallopDivider fillColor="#4E0F15" position="top" height={36} />
        </div>

        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-16">
            {/* Logo & Manifesto Column */}
            <div className="col-span-2 space-y-4">
              <div className="flex items-center gap-2 select-none">
                <div className="w-10 h-10 rounded-xl bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xl flex items-center justify-center border-2 border-white shadow-md">
                  R
                </div>
                <span className="font-krackerz-display text-2xl tracking-tight text-white uppercase">
                  RECALL<span className="text-[#C4271B]">✱</span>
                </span>
              </div>

              <p className="text-sm font-krackerz-body font-medium text-white/70 max-w-sm leading-relaxed">
                The playful, deterministic knowledge vault. Bypassing walled gardens to save genuine transcripts and creator provenance.
              </p>

              {/* Status Pill */}
              <div className="inline-flex items-center gap-2 bg-[#111111] text-[#F7F5EE] font-krackerz-display text-[10px] uppercase px-3 py-1 rounded-full border border-white/20">
                <span className="w-2 h-2 rounded-full bg-[#C4271B] animate-ping" />
                <span>11 CONNECTORS NOMINAL // LATENCY 420ms</span>
              </div>
            </div>

            {/* Navigation Column 1: Workspace */}
            <div>
              <div className="font-krackerz-display text-xs uppercase tracking-wider text-[#F7F5EE] mb-4">
                WORKSPACE
              </div>
              <ul className="space-y-2 font-krackerz-body text-xs font-bold text-white/80">
                <li>
                  <Link
                    href={ROUTES.dashboard}
                    className="hover:text-white transition-colors inline-flex items-center gap-1 font-bold text-[#C6FF2E]"
                  >
                    <span>Product Dashboard</span>
                    <ArrowUpRight className="w-3 h-3" />
                  </Link>
                </li>
                <li>
                  <Link href="/app/library" className="hover:text-white transition-colors">
                    All Library Items
                  </Link>
                </li>
                <li>
                  <Link href="/app/collections" className="hover:text-white transition-colors">
                    Topic Collections
                  </Link>
                </li>
                <li>
                  <Link href="/styleguide" className="hover:text-white transition-colors">
                    Design Styleguide
                  </Link>
                </li>
              </ul>
            </div>

            {/* Navigation Column 2: Connectors */}
            <div>
              <div className="font-krackerz-display text-xs uppercase tracking-wider text-[#F7F5EE] mb-4">
                CONNECTORS
              </div>
              <ul className="space-y-2 font-krackerz-body text-xs font-bold text-white/80">
                <li>YouTube & Shorts</li>
                <li>Reddit & Discussions</li>
                <li>Instagram Reels</li>
                <li>GitHub & Repos</li>
                <li>ArXiv & Papers</li>
              </ul>
            </div>

            {/* Navigation Column 3: Legal & Back to Top */}
            <div className="flex flex-col justify-between">
              <div>
                <div className="font-krackerz-display text-xs uppercase tracking-wider text-[#F7F5EE] mb-4">
                  PRIVACY
                </div>
                <ul className="space-y-2 font-krackerz-body text-xs font-bold text-white/80">
                  <li>Local-First Storage</li>
                  <li>Zero Telemetry Profiling</li>
                  <li>Export Data (.json)</li>
                  <li>Terms of Service</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={scrollToTop}
                aria-label="Scroll to top of page"
                className="mt-6 self-start inline-flex items-center gap-2 font-krackerz-display text-xs uppercase px-4 py-2 rounded-full bg-[#F7F5EE] text-[#111111] border-2 border-white shadow-[0_3px_0_#111111] hover:scale-105 active:scale-95 transition-transform"
              >
                <span>TOP</span>
                <ArrowUp className="w-3.5 h-3.5 stroke-[3]" />
              </button>
            </div>
          </div>

          {/* Bottom Bar: Social icons in ink / cream */}
          <div className="pt-8 border-t border-white/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-krackerz-body text-white/60">
            <div>
              &copy; {new Date().getFullYear()} RECALL KNOWLEDGE ENGINE. REVERSE-ENGINEERED WITH PASSION.
            </div>
            <div className="flex items-center gap-3">
              <a
                href="https://youtube.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Recall YouTube Channel"
                className="w-8 h-8 rounded-lg bg-[#111111] text-[#F7F5EE] flex items-center justify-center border border-white/20 hover:scale-110 transition-transform"
              >
                <YoutubeIcon className="w-4 h-4" />
              </a>
              <a
                href="https://twitter.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Recall Twitter / X"
                className="w-8 h-8 rounded-lg bg-[#111111] text-[#F7F5EE] flex items-center justify-center border border-white/20 hover:scale-110 transition-transform"
              >
                <XTwitterIcon className="w-4 h-4" />
              </a>
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Recall GitHub Repository"
                className="w-8 h-8 rounded-lg bg-[#111111] text-[#F7F5EE] flex items-center justify-center border border-white/20 hover:scale-110 transition-transform"
              >
                <GithubIcon className="w-4 h-4" />
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
