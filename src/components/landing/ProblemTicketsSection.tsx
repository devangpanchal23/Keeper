"use client";

import React from "react";
import { PROBLEM_TICKETS } from "./krackerz-tokens";
import { TicketCard } from "./TicketCard";
import { CTAButton } from "./CTAButton";
import { useRecall } from "@/context/RecallContext";

export function ProblemTicketsSection() {
  const { openAddContent } = useRecall();

  return (
    <section className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-krackerz-cream bg-dot-grid border-b-2 border-[#111111] overflow-hidden">
      <div className="max-w-6xl mx-auto">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-block bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xs uppercase px-4 py-1.5 rounded-full border-2 border-[#111111] shadow-[0_3px_0_#111111] mb-6">
            DIAGNOSIS // CHAPTER 01
          </div>

          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-krackerz-display text-[#111111] tracking-tight uppercase leading-[1.02]">
            WHY TRADITIONAL BOOKMARKS
            <br />
            <span className="font-krackerz-script font-bold text-4xl sm:text-6xl text-[#C4271B] lowercase mx-2">
              always
            </span>
            FAIL YOU
          </h2>

          <p className="mt-4 text-base sm:text-lg font-krackerz-body font-medium text-[#111111]/70 max-w-xl mx-auto">
            You save everywhere. You find nothing. Two fatal flaws break human retention in the modern web:
          </p>
        </div>

        {/* Two Tilted Ticket Cards (Rotation <= 3deg per specification) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12 mb-16 items-stretch">
          {PROBLEM_TICKETS.map((ticket) => (
            <TicketCard
              key={ticket.id}
              pillTag={ticket.pillTag}
              headlineScript={ticket.headlineScript}
              headlineMain={ticket.headlineMain}
              body={ticket.body}
              statNum={ticket.statNum}
              statLabel={ticket.statLabel}
              color={ticket.color}
              rotation={ticket.rotation}
              notch="tr"
            />
          ))}
        </div>

        {/* Centered Mid-Page CTA (Secondary Ink per lime budget) */}
        <div className="text-center">
          <CTAButton
            onClick={() => openAddContent()}
            variant="secondary-ink"
            size="lg"
          >
            SOLVE THIS IN YOUR BROWSER
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
