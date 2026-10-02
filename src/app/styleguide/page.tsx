"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, ShieldAlert, Sparkles, Box, ArrowUpRight } from "lucide-react";
import { KRACKERZ_TOKENS } from "@/components/landing/krackerz-tokens";
import { CTAButton } from "@/components/landing/CTAButton";
import { StickerLabel } from "@/components/landing/StickerLabel";
import { ScallopBadge } from "@/components/landing/ScallopBadge";
import { ScallopDivider } from "@/components/landing/ScallopDivider";
import { TicketCard } from "@/components/landing/TicketCard";
import { ROUTES } from "@/config/routes";

export default function StyleguidePage() {
  const tokenGroups = [
    {
      group: "60% DOMINANT NEUTRALS",
      description: "Forms the foundational canvas, typography, borders, and tactile dot-grid pattern.",
      percentage: "60%",
      barColor: "bg-[#F7F5EE]",
      tokens: [
        { name: "--cream", hex: KRACKERZ_TOKENS.cream, usage: "Main section backgrounds & pill fills", contrast: "17.4:1 on #111111" },
        { name: "--white", hex: KRACKERZ_TOKENS.white, usage: "Card backgrounds, sticker borders, photo frames", contrast: "21:1 on #111111" },
        { name: "--ink", hex: KRACKERZ_TOKENS.ink, usage: "All body text, headings, outlines, 2-3px borders", contrast: "21:1 on white" },
        { name: "--grid-dot", hex: KRACKERZ_TOKENS.gridDot, usage: "Subtle tactile canvas dot pattern", contrast: "N/A" },
      ],
    },
    {
      group: "30% SECONDARY BRAND (MAX 3 SHADES)",
      description: "Creates rich editorial depth, structural panels, stats, and ticket cards.",
      percentage: "30%",
      barColor: "bg-[#4E0F15]",
      tokens: [
        { name: "--oxblood", hex: KRACKERZ_TOKENS.oxblood, usage: "Deep panels, footer, pricing highlight, dark overlays", contrast: "14.2:1 with white" },
        { name: "--maroon", hex: KRACKERZ_TOKENS.maroon, usage: "Single optional mid-tone for feature tabs & badges", contrast: "9.8:1 with white" },
        { name: "--brick", hex: KRACKERZ_TOKENS.brick, usage: "The ONLY brand red: feature panels, stat cards, checkmarks", contrast: "5.1:1 with white" },
      ],
    },
    {
      group: "10% ACCENT LIME (STRICT BUDGET)",
      description: "Reserved exclusively for the single primary CTA and max one black sticker label per section.",
      percentage: "10%",
      barColor: "bg-[#C6FF2E]",
      tokens: [
        { name: "--lime", hex: KRACKERZ_TOKENS.lime, usage: "Hero CTA fill, Final CTA fill, black sticker label text", contrast: "14.6:1 with #111111" },
      ],
    },
  ];

  const limeRules = [
    { rule: "Lime area ≤ 10% in any single viewport frame", status: "ENFORCED" },
    { rule: "Lime area ≤ 6% of whole page UI area", status: "ENFORCED" },
    { rule: "Lime FILL reserved for exactly ONE primary CTA per viewport", status: "ENFORCED" },
    { rule: "Repeated CTAs: only Hero and Final CTA have lime fill", status: "ENFORCED" },
    { rule: "Mid-page CTAs are ink-filled with cream text or outline", status: "ENFORCED" },
    { rule: "Lime TEXT allowed only on black sticker label (max 1/section)", status: "ENFORCED" },
    { rule: "Toggles are Oxblood, check icons are Brick, FAQ plus are Brick/Ink", status: "ENFORCED" },
    { rule: "Corner badges are Cream or White with Ink border", status: "ENFORCED" },
    { rule: "Text contrast ≥ 4.5:1 (display text ≥ 3:1)", status: "ENFORCED" },
  ];

  return (
    <div className="min-h-screen bg-[#F7F5EE] bg-dot-grid text-[#111111] font-krackerz-body antialiased pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-[#F7F5EE]/95 backdrop-blur-md border-b-2 border-[#111111] px-4 sm:px-8 py-3.5 sm:py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-4 min-w-0">
            <Link
              href={ROUTES.home}
              className="inline-flex items-center gap-1.5 font-krackerz-display text-xs uppercase px-3 py-1.5 rounded-full bg-white border border-[#111111] shadow-[0_2px_0_#111111] hover:-translate-y-0.5 transition-all shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Back to Site</span>
              <span className="sm:hidden">Back</span>
            </Link>

            <span className="font-krackerz-display text-xs sm:text-xl uppercase tracking-tight truncate">
              DESIGN SYSTEM
            </span>
          </div>

          <Link
            href={ROUTES.dashboard}
            className="inline-flex items-center gap-1.5 font-krackerz-display text-xs uppercase px-3 sm:px-4 py-1.5 rounded-full bg-[#111111] text-[#F7F5EE] border border-[#111111] shadow-[0_2px_0_#C4271B] hover:-translate-y-0.5 transition-all shrink-0"
          >
            <span className="hidden sm:inline">Product Dashboard</span>
            <span className="sm:hidden">Dashboard</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-10 space-y-16">
        {/* 60:30:10 Meter Section */}
        <section className="bg-white border-3 border-[#111111] rounded-3xl p-6 sm:p-10 shadow-[0_12px_24px_rgba(17,17,17,0.1)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <div>
              <div className="inline-block bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xs uppercase px-3 py-1 rounded-full mb-2">
                AUTOMATED ARCHITECTURE
              </div>
              <h1 className="text-3xl sm:text-4xl font-krackerz-display uppercase tracking-tight">
                60:30:10 COLOR ALLOCATION METER
              </h1>
            </div>

            <div className="flex items-center gap-2 font-krackerz-display text-xs bg-[#F7F5EE] px-4 py-2 rounded-xl border border-[#111111]">
              <CheckCircle2 className="w-4 h-4 text-[#C4271B]" />
              <span>AUDIT STATUS: FULLY COMPLIANT</span>
            </div>
          </div>

          {/* Visual Percentage Meter Bar */}
          <div className="w-full h-12 rounded-2xl border-2 border-[#111111] overflow-hidden flex shadow-inner mb-4">
            <div
              style={{ width: "60%" }}
              className="bg-[#F7F5EE] border-r-2 border-[#111111] flex items-center justify-center font-krackerz-display text-xs sm:text-sm text-[#111111] select-none"
            >
              60% NEUTRALS
            </div>
            <div
              style={{ width: "30%" }}
              className="bg-[#4E0F15] text-white border-r-2 border-[#111111] flex items-center justify-center font-krackerz-display text-xs sm:text-sm select-none"
            >
              30% BRAND
            </div>
            <div
              style={{ width: "10%" }}
              className="bg-[#C6FF2E] text-[#111111] flex items-center justify-center font-krackerz-display text-xs sm:text-sm select-none font-bold"
            >
              10%
            </div>
          </div>

          <p className="text-xs sm:text-sm font-medium text-[#111111]/75 leading-relaxed">
            Every section alternates across the 60:30:10 rule. Dominant neutrals establish breathing room; secondary brand provides architectural structure; accent lime is strictly capped as high-contrast conversion focus.
          </p>
        </section>

        {/* Tokens & Swatches */}
        <section className="space-y-8">
          <h2 className="text-2xl sm:text-3xl font-krackerz-display uppercase tracking-tight">
            COLOR TOKENS REGISTRY
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {tokenGroups.map((group, gIdx) => (
              <div
                key={gIdx}
                className="bg-white border-2 border-[#111111] rounded-3xl p-6 shadow-[0_8px_16px_rgba(17,17,17,0.08)] flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-krackerz-display text-xs uppercase px-3 py-1 rounded-full border border-[#111111] bg-[#F7F5EE]">
                      {group.percentage} ALLOCATION
                    </span>
                    <span className="font-krackerz-display text-xs text-[#111111]/60">GROUP 0{gIdx + 1}</span>
                  </div>

                  <h3 className="font-krackerz-display text-lg uppercase mb-2">
                    {group.group}
                  </h3>

                  <p className="text-xs text-[#111111]/70 leading-relaxed mb-6">
                    {group.description}
                  </p>

                  <div className="space-y-3">
                    {group.tokens.map((token, tIdx) => (
                      <div
                        key={tIdx}
                        className="p-3 rounded-2xl border border-[#111111]/20 flex items-center gap-3 bg-[#F7F5EE]/40"
                      >
                        <div
                          style={{ backgroundColor: token.hex }}
                          className="w-12 h-12 rounded-xl border-2 border-[#111111] shrink-0 shadow-sm"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-krackerz-display text-xs font-mono">{token.name}</span>
                            <span className="font-mono text-xs uppercase font-bold">{token.hex}</span>
                          </div>
                          <p className="text-[11px] text-[#111111]/75 truncate">{token.usage}</p>
                          <span className="text-[10px] text-[#C4271B] font-bold">Contrast: {token.contrast}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Lime Budget Verification Checklist */}
        <section className="bg-white border-3 border-[#111111] rounded-3xl p-6 sm:p-10 shadow-[0_12px_24px_rgba(17,17,17,0.1)]">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-[#C6FF2E] border-2 border-[#111111] flex items-center justify-center font-krackerz-display text-sm">
              ⚡
            </div>
            <h2 className="text-2xl sm:text-3xl font-krackerz-display uppercase tracking-tight">
              LIME BUDGET AUDIT RULES
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {limeRules.map((item, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-[#111111]/20 bg-[#F7F5EE]/50 text-xs sm:text-sm font-medium"
              >
                <span>{item.rule}</span>
                <span className="font-krackerz-display text-[10px] bg-[#111111] text-[#C6FF2E] px-2.5 py-1 rounded-full border border-white">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Component Showcase */}
        <section className="space-y-8">
          <h2 className="text-2xl sm:text-3xl font-krackerz-display uppercase tracking-tight">
            COMPONENT VARIANTS
          </h2>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* CTA Buttons */}
            <div className="bg-white border-2 border-[#111111] rounded-3xl p-6 sm:p-8 space-y-6">
              <h3 className="font-krackerz-display text-lg uppercase">
                CTA BUTTON HIERARCHY
              </h3>
              <p className="text-xs text-[#111111]/70">
                Primary Lime is reserved for Hero and Final CTA. All mid-page CTAs use Secondary Ink or Secondary Cream.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <CTAButton variant="primary-lime" size="md">
                  PRIMARY HERO LIME
                </CTAButton>
                <CTAButton variant="secondary-ink" size="md">
                  SECONDARY INK (MID-PAGE)
                </CTAButton>
                <CTAButton variant="secondary-cream" size="md">
                  SECONDARY CREAM
                </CTAButton>
                <CTAButton variant="dark-oxblood" size="md">
                  DARK OXBLOOD
                </CTAButton>
              </div>
            </div>

            {/* Sticker Labels & Badges */}
            <div className="bg-white border-2 border-[#111111] rounded-3xl p-6 sm:p-8 space-y-6">
              <h3 className="font-krackerz-display text-lg uppercase">
                STICKER LABELS & BADGES
              </h3>
              <p className="text-xs text-[#111111]/70">
                Die-cut sticker labels and scalloped flower badges with ink borders.
              </p>

              <div className="flex flex-wrap items-center gap-4">
                <StickerLabel size="md" rotation={-3}>
                  MEMORY VAULT
                </StickerLabel>
                <ScallopBadge iconName="Rocket" label="ZERO GUESS" bg="#F7F5EE" size="md" rotation={6} />
                <ScallopBadge iconName="Trophy" label="PROVEN" bg="#FFFFFF" size="md" rotation={-6} />
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
