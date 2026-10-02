"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { StickerLabel } from "./StickerLabel";
import { ScallopBadge } from "./ScallopBadge";
import { ROUTES } from "@/config/routes";

export function PricingSection() {
  const [isYearly, setIsYearly] = useState(true);

  const tiers = [
    {
      id: "free",
      name: "STARTER VAULT",
      badge: "FREE FOREVER",
      price: "$0",
      period: "FOREVER",
      description: "Essential link ingestion and local semantic search for individual students and casual curators.",
      features: [
        "Up to 250 saved items",
        "YouTube, Instagram & Reddit extraction",
        "Local semantic search",
        "1-click JSON export anytime",
        "Zero advertisements",
      ],
      buttonText: "START FREE",
      featured: false,
    },
    {
      id: "pro",
      name: "PRO CURATOR",
      badge: "FEATURED HIGHLIGHT",
      savePill: "SAVE $45 / YEAR",
      price: isYearly ? "$99" : "$12",
      period: isYearly ? "/ YEAR" : "/ MONTH",
      description: "Unlimited high-frequency universal ingestion with verified transcripts, AI synthesis, and multi-device sync.",
      features: [
        "Unlimited saved items & collections",
        "All 11 supported platform connectors",
        "Full video transcript & audio extraction",
        "Advanced natural-language semantic query",
        "Priority provider rate limit bypass",
        "Local-first encrypted vault sync",
      ],
      buttonText: "CLAIM PRO ACCESS",
      featured: true,
    },
    {
      id: "team",
      name: "STUDIO / TEAM",
      badge: "MULTI-USER",
      price: isYearly ? "$240" : "$29",
      period: isYearly ? "/ YEAR" : "/ MONTH",
      description: "Shared project workspaces, team knowledge repositories, and collaborative tagging for design studios.",
      features: [
        "Everything in Pro Curator",
        "5 Team member seats included",
        "Shared project collections",
        "Custom domain sharing",
        "Dedicated API connector keys",
      ],
      buttonText: "START STUDIO TRIAL",
      featured: false,
    },
  ];

  return (
    <section id="pricing" className="relative py-28 sm:py-36 px-4 sm:px-6 lg:px-8 bg-krackerz-cream bg-dot-grid border-b-2 border-[#111111] overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Section Headline */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-block bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xs uppercase px-4 py-1.5 rounded-full border-2 border-[#111111] shadow-[0_3px_0_#111111] mb-6">
            TRANSPARENT VALUE // NO TRAPS
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-krackerz-display text-[#111111] tracking-tight uppercase leading-[1.02]">
            CHOOSE YOUR WAY TO
            <br />
            <StickerLabel rotation={-3} size="xl">
              LEVEL UP
            </StickerLabel>
          </h2>

          <p className="mt-4 text-base sm:text-lg font-krackerz-body font-medium text-[#111111]/70 max-w-xl mx-auto">
            Honest pricing with zero dark patterns. Keep your digital memory intact forever.
          </p>
        </div>

        {/* Monthly / Yearly Toggle (Oxblood Switch per rule: toggle -> oxblood) */}
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4 mb-12 sm:mb-16 select-none">
          <span className={`font-krackerz-display text-xs sm:text-sm uppercase ${!isYearly ? "text-[#111111]" : "text-[#111111]/50"}`}>
            BILLED MONTHLY
          </span>

          <button
            type="button"
            onClick={() => setIsYearly(!isYearly)}
            className="w-16 h-9 rounded-full bg-[#4E0F15] p-1 border-2 border-[#111111] shadow-[0_3px_0_#111111] relative transition-colors duration-200"
            aria-label="Toggle annual billing"
          >
            <div
              className={`w-6 h-6 rounded-full bg-[#F7F5EE] border-2 border-[#111111] transition-transform duration-200 ${
                isYearly ? "translate-x-7" : "translate-x-0"
              }`}
            />
          </button>

          <div className="flex items-center gap-2">
            <span className={`font-krackerz-display text-xs sm:text-sm uppercase ${isYearly ? "text-[#111111]" : "text-[#111111]/50"}`}>
              ANNUAL BILLING
            </span>
            <span className="bg-[#C4271B] text-white font-krackerz-display text-[9px] uppercase px-2 py-0.5 rounded-full border border-[#111111] shadow-sm -rotate-3">
              SAVE 30%
            </span>
          </div>
        </div>

        {/* 3 Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-center">
          {tiers.map((tier) => {
            if (tier.featured) {
              // Featured Oxblood Card
              return (
                <div
                  key={tier.id}
                  className="relative rounded-3xl sm:rounded-[32px] bg-[#4E0F15] text-white border-3 border-[#111111] p-8 sm:p-9 shadow-[0_20px_40px_rgba(0,0,0,0.35)] lg:scale-105 z-20 flex flex-col justify-between transition-transform duration-300 hover:scale-[1.07]"
                >
                  {/* Save $45 Pill Floating Top Center */}
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#C4271B] text-white font-krackerz-display text-[10px] uppercase tracking-widest px-4 py-1 rounded-full border-2 border-white shadow-md">
                    {tier.savePill}
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <span className="font-krackerz-display text-xs text-white/90 uppercase tracking-wider">
                        {tier.badge}
                      </span>
                      <ScallopBadge iconName="Trophy" bg="#F7F5EE" size="sm" />
                    </div>

                    <h3 className="text-2xl sm:text-3xl font-krackerz-display uppercase mb-2">
                      {tier.name}
                    </h3>

                    <div
                      key={`${tier.id}-${isYearly ? "yr" : "mo"}`}
                      className="animate-price-pop flex items-baseline gap-2 mb-4"
                    >
                      <span className="text-5xl sm:text-6xl font-krackerz-display text-white">
                        {tier.price}
                      </span>
                      <span className="font-krackerz-display text-sm text-white/70">
                        {tier.period}
                      </span>
                    </div>

                    <p className="text-xs sm:text-sm font-krackerz-body font-medium text-white/80 leading-relaxed mb-6">
                      {tier.description}
                    </p>

                    <div className="border-t border-white/20 pt-6 space-y-3 mb-8">
                      {tier.features.map((f, fIdx) => (
                        <div key={fIdx} className="flex items-center gap-2.5 text-xs sm:text-sm font-krackerz-body font-bold text-white/95">
                          {/* Check icon in brick red per rule */}
                          <span className="w-5 h-5 rounded-full bg-[#C4271B] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </span>
                          <span>{f}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Mid-page CTA: ink-filled with cream text per rule */}
                  <Link
                    href="/sign-up"
                    className="w-full text-center py-4 rounded-full bg-[#111111] text-[#F7F5EE] font-krackerz-display text-sm uppercase tracking-wide border-2 border-white shadow-[0_4px_0_#111111] hover:shadow-[0_6px_0_#111111] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all block"
                  >
                    {tier.buttonText}
                  </Link>
                </div>
              );
            }

            // White Cards (Free & Team)
            return (
              <div
                key={tier.id}
                className="relative rounded-3xl bg-white text-[#111111] border-2 border-[#111111] p-8 shadow-[0_12px_24px_rgba(0,0,0,0.12)] flex flex-col justify-between transition-transform duration-300 hover:-translate-y-1.5"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-krackerz-display text-xs text-[#C4271B] uppercase tracking-wider">
                      {tier.badge}
                    </span>
                    {tier.id === "team" && <ScallopBadge iconName="Star" bg="#F7F5EE" size="sm" />}
                  </div>

                  <h3 className="text-2xl font-krackerz-display uppercase mb-2">
                    {tier.name}
                  </h3>

                  <div
                    key={`${tier.id}-${isYearly ? "yr" : "mo"}`}
                    className="animate-price-pop flex items-baseline gap-2 mb-4"
                  >
                    <span className="text-4xl sm:text-5xl font-krackerz-display text-[#111111]">
                      {tier.price}
                    </span>
                    <span className="font-krackerz-display text-xs text-[#111111]/60">
                      {tier.period}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm font-krackerz-body font-medium text-[#111111]/70 leading-relaxed mb-6">
                    {tier.description}
                  </p>

                  <div className="border-t border-[#111111]/15 pt-6 space-y-3 mb-8">
                    {tier.features.map((f, fIdx) => (
                      <div key={fIdx} className="flex items-center gap-2.5 text-xs sm:text-sm font-krackerz-body font-bold text-[#111111]/90">
                        <span className="w-5 h-5 rounded-full bg-[#111111] text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                        </span>
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <Link
                  href={tier.id === "free" ? ROUTES.dashboard : "/sign-up"}
                  className="w-full text-center py-3.5 rounded-full bg-[#F7F5EE] hover:bg-[#111111] hover:text-[#F7F5EE] text-[#111111] font-krackerz-display text-xs uppercase tracking-wide border-2 border-[#111111] shadow-[0_3px_0_#111111] transition-all block"
                >
                  {tier.buttonText}
                </Link>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
