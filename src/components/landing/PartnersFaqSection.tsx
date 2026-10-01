"use client";

import React, { useState } from "react";
import { FAQ_ITEMS } from "./krackerz-tokens";
import { StickerLabel } from "./StickerLabel";
import { MascotCharacter } from "./MascotCharacter";
import { CTAButton } from "./CTAButton";
import { Plus } from "lucide-react";
import { useRecall } from "@/context/RecallContext";

export function PartnersFaqSection() {
  const { openAddContent } = useRecall();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggleAccordion = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <section id="faq" className="relative py-28 sm:py-36 px-4 sm:px-6 lg:px-8 bg-white border-b-2 border-[#111111] overflow-hidden">
      <div className="max-w-6xl mx-auto space-y-24">
        {/* Oxblood Partners / Studio Banner Panel */}
        <div id="partners" className="relative rounded-3xl sm:rounded-[36px] bg-[#4E0F15] text-white p-8 sm:p-14 border-3 border-[#111111] shadow-[0_16px_36px_rgba(0,0,0,0.25)] overflow-hidden">
          {/* Subtle Dark Blob Accent */}
          <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-[#111111]/40 rounded-full blur-3xl pointer-events-none" />

          <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4">
              <div className="font-krackerz-script font-bold text-4xl sm:text-5xl text-[#C6FF2E] lowercase">
                built for
              </div>

              <h2 className="text-3xl sm:text-5xl font-krackerz-display tracking-tight uppercase leading-[1.05]">
                ENGINEERING TEAMS, DESIGN STUDIOS, & RESEARCH CELLS
              </h2>

              <p className="text-base sm:text-lg font-krackerz-body font-medium text-white/85 max-w-xl leading-relaxed">
                Connect your organization&apos;s shared intelligence. Index conference videos, design references, and technical RFCs in one sovereign workspace.
              </p>

              {/* Mid-page CTA: Secondary Ink or Cream per rule */}
              <div className="pt-2">
                <CTAButton
                  href="/sign-up"
                  variant="secondary-ink"
                  size="md"
                >
                  GET ENTERPRISE DEMO
                </CTAButton>
              </div>
            </div>

            {/* 3 Circular Scalloped Photos */}
            <div className="lg:col-span-4 flex items-center justify-center lg:justify-end gap-3 sm:gap-4 select-none">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-3 border-white shadow-xl hover:scale-105 transition-transform bg-[#111111]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300&auto=format&fit=crop&q=80"
                  alt="Partner 1"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full overflow-hidden border-3 border-white shadow-xl hover:scale-105 transition-transform -translate-y-4 bg-[#111111]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80"
                  alt="Partner 2"
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full overflow-hidden border-3 border-white shadow-xl hover:scale-105 transition-transform bg-[#111111]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="https://images.unsplash.com/photo-1517841905240-472988babdf9?w=300&auto=format&fit=crop&q=80"
                  alt="Partner 3"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>

        {/* 2-Column FAQ Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          {/* Left Column: Heading + Wavy Tag + Thumbs-up Mascot */}
          <div className="lg:col-span-5 lg:sticky lg:top-32 space-y-6">
            <div className="inline-block bg-[#C4271B] text-white font-krackerz-display text-xs uppercase px-4 py-1.5 rounded-full border-2 border-[#111111] shadow-[0_3px_0_#111111] -rotate-3">
              FAQ // FREQUENT INQUIRIES
            </div>

            <h2 className="text-3xl sm:text-5xl lg:text-6xl font-krackerz-display text-[#111111] tracking-tight uppercase leading-[1.02]">
              BEFORE YOU
              <br />
              <StickerLabel rotation={-3} size="xl">
                GET STARTED
              </StickerLabel>
            </h2>

            <p className="text-base font-krackerz-body font-medium text-[#111111]/70 leading-relaxed">
              Everything you need to know about deterministic extraction, zero-hallucination guarantees, and sovereign storage.
            </p>

            {/* Mascot Dynamic Reaction Illustration */}
            <div className="pt-4 flex items-center gap-4">
              <MascotCharacter
                mood={openIndex !== null ? "thumbs-up" : "happy"}
                size="lg"
                className="transition-transform duration-300 hover:scale-110"
              />
              <div
                key={openIndex ?? "none"}
                className="animate-tab-fade bg-[#F7F5EE] p-3 rounded-2xl border-2 border-[#111111] font-krackerz-display text-xs text-[#111111] uppercase max-w-[200px] shadow-[0_3px_0_#111111]"
              >
                {openIndex === 0
                  ? "Vaulty guarantees 100% data provenance!"
                  : openIndex === 1
                  ? "All 11 platforms supported natively!"
                  : openIndex === 2
                  ? "Natural language semantic search active!"
                  : openIndex === 3
                  ? "100% sovereign & 1-click JSON export!"
                  : openIndex === 4
                  ? "Free starter tier with zero card needed!"
                  : "Click any question to inspect the engine!"}
              </div>
            </div>
          </div>

          {/* Right Column: Accordion Rows with Scalloped Plus (Brick/Ink outline per rule) */}
          <div className="lg:col-span-7 space-y-4">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openIndex === idx;

              return (
                <div
                  key={idx}
                  className={`rounded-2xl border-2 border-[#111111] transition-all duration-200 overflow-hidden shadow-[0_4px_0_#111111] ${
                    isOpen ? "bg-[#F7F5EE]" : "bg-white hover:bg-[#F7F5EE]/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleAccordion(idx)}
                    aria-expanded={isOpen}
                    className="w-full p-5 sm:p-6 text-left flex items-center justify-between gap-4 select-none cursor-pointer"
                  >
                    <span className="font-krackerz-display text-base sm:text-lg text-[#111111] uppercase tracking-tight leading-snug">
                      {item.question}
                    </span>

                    {/* Indicator: FAQ plus icons -> brick/ink outline per rule */}
                    <span
                      className={`w-9 h-9 rounded-full border-2 border-[#111111] flex items-center justify-center shrink-0 transition-all duration-300 ${
                        isOpen
                          ? "bg-[#C4271B] text-white rotate-45"
                          : "bg-[#F7F5EE] text-[#111111] rotate-0"
                      }`}
                    >
                      <Plus className="w-5 h-5 stroke-[2.5]" />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 pt-1 text-sm sm:text-base font-krackerz-body font-medium text-[#111111]/80 leading-relaxed border-t border-[#111111]/10">
                      {item.answer}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
