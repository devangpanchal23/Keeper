"use client";

import React from "react";
import { KrackerzNav } from "@/components/landing/KrackerzNav";
import { KrackerzHero } from "@/components/landing/KrackerzHero";
import { KrackerzMarquee } from "@/components/landing/KrackerzMarquee";
import { StatementSection } from "@/components/landing/StatementSection";
import { ProblemTicketsSection } from "@/components/landing/ProblemTicketsSection";
import { CoreFeaturesStack } from "@/components/landing/CoreFeaturesStack";
import { TestimonialsSection } from "@/components/landing/TestimonialsSection";
import { FounderAboutSection } from "@/components/landing/FounderAboutSection";
import { PricingSection } from "@/components/landing/PricingSection";
import { PartnersFaqSection } from "@/components/landing/PartnersFaqSection";
import { StickerShopSection } from "@/components/landing/StickerShopSection";
import { FinalCtaFooter } from "@/components/landing/FinalCtaFooter";
import { CustomCursor } from "@/components/landing/CustomCursor";
import { StickyMobileCta } from "@/components/landing/StickyMobileCta";
import { AddContentModal } from "@/components/modals/AddContentModal";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-krackerz-cream text-[#111111] selection:bg-[#C6FF2E] selection:text-[#111111] overflow-x-clip font-krackerz-body antialiased">
      {/* Desktop-only Custom Cursor Follower */}
      <CustomCursor />

      {/* Floating Pill Nav with solid cream backing & secondary Dashboard route */}
      <KrackerzNav />

      {/* Main Experience Blueprint */}
      <main id="main-content" className="relative">
        {/* Section B: Hero with cloud shapes, display headline, 3D Spline centerpiece & fanned cards */}
        <KrackerzHero />

        {/* Continuous Kinetic Editorial Marquee */}
        <KrackerzMarquee />

        {/* Section C: Statement + video with [NOT RETENTION] die-cut sticker */}
        <StatementSection />

        {/* Section D: Two tilted ticket cards with circular punch notches (rotation <= 3deg) */}
        <ProblemTicketsSection />

        {/* Section E: 3 Sticky Folder-Tab Feature Panels in 3-shade brand progression */}
        <CoreFeaturesStack />

        {/* Section F: Testimonials fanned carousel with full legibility, touch swipe & auto-rotate */}
        <TestimonialsSection />

        {/* Section G: Founder / Architecture stats with 3-tone cards & telemetry */}
        <FounderAboutSection />

        {/* Section H: Pricing with Oxblood toggle & featured card */}
        <PricingSection />

        {/* Section I: Partners panel + 2-column FAQ with brick/ink plus indicators */}
        <PartnersFaqSection />

        {/* Section J: Interactive Laptop Lid Mockup with draggable tactile stickers */}
        <StickerShopSection />

        {/* Section K: Final CTA with rising deep oxblood cloud blob + rich footer */}
        <FinalCtaFooter />
      </main>

      {/* Sticky Mobile CTA Bar for conversion */}
      <StickyMobileCta />

      {/* Universal URL Ingestion Modal (seamlessly triggered by hero input & CTAs) */}
      <AddContentModal />
    </div>
  );
}
