"use client";

import React, { useState } from "react";
import { FEATURE_TABS } from "./krackerz-tokens";
import { StickerLabel } from "./StickerLabel";
import { ScallopBadge } from "./ScallopBadge";
import { ScallopDivider } from "./ScallopDivider";
import { CTAButton } from "./CTAButton";
import { useRecall } from "@/context/RecallContext";

export function CoreFeaturesStack() {
  const { openAddContent } = useRecall();
  const [activeTabIndex, setActiveTabIndex] = useState(0);

  return (
    <section id="features" className="relative bg-white bg-dot-grid-white pt-20 pb-28 border-b-2 border-[#111111] overflow-hidden">
      {/* Top Scalloped Transition from Cream to White */}
      <div className="absolute top-0 left-0 right-0">
        <ScallopDivider fillColor="#F7F5EE" position="top" height={32} />
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Tag & Headline */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-block bg-[#C4271B] text-white font-krackerz-display text-xs uppercase px-4 py-1.5 rounded-full border-2 border-[#111111] shadow-[0_3px_0_#111111] -rotate-2 mb-6">
            CORE FEATURES // HOW IT WORKS
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-krackerz-display text-[#111111] tracking-tight uppercase leading-[1.02]">
            THREE ENGINE PILLARS TO
            <br />
            <span>MAKE YOUR MEMORY </span>
            <StickerLabel rotation={-3} size="lg">
              UNBREAKABLE
            </StickerLabel>
          </h2>

          <p className="mt-4 text-base sm:text-lg font-krackerz-body font-medium text-[#111111]/70 max-w-xl mx-auto">
            From the moment you paste a link to the moment you retrieve it 6 months later.
          </p>
        </div>

        {/* Trapezoid Folder-Tab Switcher Row */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-0 select-none overflow-x-auto pb-2">
          {FEATURE_TABS.map((tab, idx) => {
            const isActive = idx === activeTabIndex;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTabIndex(idx)}
                style={{
                  backgroundColor: isActive ? tab.tabColor : "#F7F5EE",
                  color: isActive ? "#FFFFFF" : "#111111",
                }}
                className={`group relative px-4 sm:px-8 py-3.5 sm:py-4 rounded-t-2xl border-t-2 border-x-2 border-[#111111] font-krackerz-display text-xs sm:text-sm uppercase tracking-wider transition-all duration-200 cursor-pointer shadow-[0_-2px_0_#111111] ${
                  isActive ? "translate-y-0.5 z-20" : "hover:-translate-y-1 z-10 opacity-70 hover:opacity-100"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`font-krackerz-script text-lg sm:text-xl font-bold lowercase ${
                      isActive ? "text-[#C6FF2E]" : "text-[#C4271B]"
                    }`}
                  >
                    #{tab.tabNumber}
                  </span>
                  <span>{tab.tabLabel}</span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Folder-Tab Panel Card */}
        {FEATURE_TABS.map((tab, idx) => {
          if (idx !== activeTabIndex) return null;

          return (
            <div
              key={tab.id}
              style={{ backgroundColor: tab.tabColor }}
              className="animate-tab-fade relative rounded-3xl sm:rounded-[32px] border-3 border-[#111111] p-6 sm:p-12 text-white shadow-[0_16px_40px_rgba(0,0,0,0.22)]"
            >
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                {/* Left Text Column */}
                <div className="lg:col-span-7 space-y-6">
                  {/* Eyebrow badge */}
                  <div className="inline-block bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xs uppercase px-3 py-1 rounded-full border border-white">
                    CHAPTER 0{idx + 1}
                  </div>

                  {/* Title with script word */}
                  <h3 className="text-2xl sm:text-4xl lg:text-5xl font-krackerz-display tracking-tight uppercase leading-[1.05]">
                    {tab.title}
                  </h3>

                  {/* Description */}
                  <p className="text-base sm:text-lg font-krackerz-body font-medium text-white/90 leading-relaxed">
                    {tab.description}
                  </p>

                  {/* Asterisk Bullet List */}
                  <ul className="space-y-3 pt-2">
                    {tab.bullets.map((bullet, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-3">
                        <span className="text-white font-krackerz-display text-lg leading-none shrink-0">
                          ✱
                        </span>
                        <span className="font-krackerz-body font-semibold text-sm sm:text-base text-white/95">
                          {bullet}
                        </span>
                      </li>
                    ))}
                  </ul>

                  {/* Mid-Page CTA (Secondary Ink per lime budget) */}
                  <div className="pt-4">
                    <CTAButton
                      onClick={() => openAddContent()}
                      variant="secondary-ink"
                      size="md"
                    >
                      {tab.ctaText}
                    </CTAButton>
                  </div>
                </div>

                {/* Right Image with 8px White Border + Overlapping ScallopBadge */}
                <div className="lg:col-span-5 relative">
                  <div className="relative rounded-2xl overflow-hidden border-4 sm:border-8 border-white shadow-[0_12px_24px_rgba(0,0,0,0.3)] aspect-[4/3] bg-[#111111]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={tab.image}
                      alt={tab.title}
                      className="w-full h-full object-cover"
                    />

                    {/* Corner Platform Overlay */}
                    <div className="absolute bottom-3 left-3 bg-[#111111] text-[#C6FF2E] font-krackerz-display text-[10px] uppercase px-2.5 py-1 rounded border border-white">
                      VERIFIED DATA SOURCE
                    </div>
                  </div>

                  {/* Overlapping Bouncing ScallopBadge (Cream with ink border) */}
                  <div className="absolute -top-6 -right-6 z-20">
                    <ScallopBadge
                      iconName={tab.badgeIcon}
                      label={tab.badgeLabel}
                      bg="#F7F5EE"
                      size="lg"
                      rotation={12}
                    />
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
