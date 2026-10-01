"use client";

import React, { useState } from "react";
import { Sparkles, SlidersHorizontal } from "lucide-react";
import { useRecall } from "@/context/RecallContext";
import { HERO_FAN_CARDS } from "./krackerz-tokens";
import { MascotCharacter } from "./MascotCharacter";
import { StickerLabel } from "./StickerLabel";
import { CTAButton } from "./CTAButton";
import { ScallopBadge } from "./ScallopBadge";
import { SplineHero } from "./SplineHero";

export function KrackerzHero() {
  const { openAddContent } = useRecall();
  const [quickUrl, setQuickUrl] = useState("");
  const [isStraightened, setIsStraightened] = useState(false);
  const [scrollStraighten, setScrollStraighten] = useState(0);
  const [hoveredCardId, setHoveredCardId] = useState<string | null>(null);

  const lastProgressRef = React.useRef(0);

  React.useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const y = window.scrollY;
          // Only calculate while within or near the hero section (y < 420px)
          if (y <= 420 || lastProgressRef.current < 1) {
            const progress = Math.min(1, Math.max(0, (y - 60) / 260));
            if (
              Math.abs(progress - lastProgressRef.current) > 0.04 ||
              (progress === 1 && lastProgressRef.current !== 1) ||
              (progress === 0 && lastProgressRef.current !== 0)
            ) {
              lastProgressRef.current = progress;
              setScrollStraighten(progress);
            }
          }
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleQuickIngest = (e: React.FormEvent) => {
    e.preventDefault();
    if (quickUrl.trim()) {
      openAddContent(quickUrl.trim());
    } else {
      openAddContent("https://youtu.be/3lZF8W_AaUo");
    }
  };

  return (
    <section className="relative pt-32 sm:pt-40 pb-24 px-4 sm:px-6 lg:px-8 bg-krackerz-cream bg-dot-grid overflow-hidden border-b-2 border-[#111111]">
      {/* Decorative Cloud Shapes in Background */}
      <div className="absolute top-12 left-1/2 -translate-x-1/2 w-[900px] sm:w-[1300px] h-[400px] bg-white rounded-[100px] -z-0 opacity-80 blur-2xl pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto flex flex-col items-center text-center">
        {/* Eyebrow: Black pill with lime text & Scallop Badge */}
        <div className="inline-flex items-center gap-2.5 bg-[#111111] text-[#C6FF2E] rounded-full pl-2 pr-4 py-1.5 border-2 border-[#111111] shadow-[0_4px_0_#111111] mb-8 select-none">
          <div className="w-6 h-6 rounded-full bg-[#C6FF2E] text-[#111111] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 stroke-[2.5]" />
          </div>
          <span className="font-krackerz-display text-xs sm:text-sm tracking-wider uppercase">
            RECALL 2.6 // UNIVERSAL KNOWLEDGE VAULT
          </span>
        </div>

        {/* 3-Line Giant Display Headline with Masked Reveals & Stagger */}
        <div className="max-w-5xl mb-8">
          <h1 className="text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-krackerz-display text-[#111111] tracking-tight leading-[0.98] uppercase select-none">
            <span className="line-mask pb-1">
              <span className="block animate-line-reveal">
                WE{" "}
                <span className="font-krackerz-script font-bold text-5xl sm:text-7xl md:text-8xl lg:text-9xl text-[#C4271B] lowercase mx-1 inline-block -rotate-6">
                  don&apos;t
                </span>{" "}
                JUST
              </span>
            </span>
            <span className="line-mask my-1 pb-1">
              <span className="inline-flex items-center justify-center flex-wrap gap-3 animate-line-reveal delay-100">
                <span>SAVE CONTENT</span>
                <MascotCharacter mood="happy" size="md" className="align-middle inline-block" />
              </span>
            </span>
            <span className="line-mask pt-1">
              <span className="block animate-line-reveal delay-200">
                <span>WE TURN IT INTO </span>
                <StickerLabel rotation={-3} size="lg" className="align-middle ml-2">
                  MEMORY
                </StickerLabel>
              </span>
            </span>
          </h1>
        </div>

        {/* Subtitle */}
        <p className="max-w-2xl text-base sm:text-lg font-krackerz-body font-medium text-[#111111]/80 leading-relaxed mb-8">
          The universal bookmarking engine for creators, engineers, and researchers.
          Extract genuine transcripts, raw descriptions, and validated authors with zero hallucination.
        </p>

        {/* Live URL Ingestion Input & Single Primary Lime CTA */}
        <div className="w-full max-w-xl mb-6">
          <form
            onSubmit={handleQuickIngest}
            className="flex flex-col sm:flex-row items-stretch gap-3 bg-white p-2 rounded-2xl sm:rounded-full border-2 border-[#111111] shadow-[0_6px_0_#111111]"
          >
            <input
              type="url"
              value={quickUrl}
              onChange={(e) => setQuickUrl(e.target.value)}
              placeholder="Paste any YouTube, Reddit, Instagram or Web URL..."
              className="flex-1 px-5 py-3.5 text-sm sm:text-base font-krackerz-body bg-transparent text-[#111111] placeholder:text-[#111111]/40 focus:outline-none"
            />
            <CTAButton size="md" variant="primary-lime" className="shrink-0">
              SAVE TO VAULT
            </CTAButton>
          </form>

          {/* Quick-try sample chips */}
          <div className="flex items-center justify-center flex-wrap gap-2 mt-4 text-xs font-krackerz-body">
            <span className="text-[#111111]/60 font-bold">Try instant demo:</span>
            <button
              type="button"
              onClick={() => openAddContent("https://youtu.be/3lZF8W_AaUo")}
              className="underline font-bold text-[#C4271B] hover:text-[#111111] transition-colors"
            >
              YouTube Video
            </button>
            <span className="text-[#111111]/30">•</span>
            <button
              type="button"
              onClick={() => openAddContent("https://www.instagram.com/reel/C3x90ZaLkPq/")}
              className="underline font-bold text-[#C4271B] hover:text-[#111111] transition-colors"
            >
              Instagram Reel
            </button>
            <span className="text-[#111111]/30">•</span>
            <button
              type="button"
              onClick={() => openAddContent("https://www.reddit.com/r/SaaS/comments/1bgf90a/micro_saas_tips/")}
              className="underline font-bold text-[#C4271B] hover:text-[#111111] transition-colors"
            >
              Reddit Thread
            </button>
          </div>
        </div>

        {/* Spline 3D Hero Centerpiece (0 CLS, lazy loaded, brand-palette fallback) */}
        <div className="w-full max-w-lg mx-auto mb-12">
          <SplineHero />
        </div>

        {/* Scrub & Alignment Control Bar */}
        <div className="w-full flex items-center justify-between max-w-5xl mb-6 px-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#C4271B] animate-ping" />
            <span className="font-krackerz-display text-xs text-[#111111] uppercase tracking-wider">
              YOUR SAVED STREAM // RECENT ARTIFACTS
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsStraightened(!isStraightened)}
            className="inline-flex items-center gap-2 font-krackerz-display text-xs bg-white text-[#111111] border-2 border-[#111111] shadow-[0_2px_0_#111111] hover:shadow-[0_4px_0_#111111] px-4 py-1.5 rounded-full transition-all"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span>{isStraightened ? "FAN CARDS OUT" : "ALIGN ROW (STRAIGHTEN)"}</span>
          </button>
        </div>

        {/* Row of 6 Portrait Photo Cards (Fanned & Overlapping -> Straightened, Snap Carousel on Mobile) */}
        <div className="relative w-full max-w-6xl min-h-[380px] sm:min-h-[420px] flex items-center justify-start sm:justify-center py-6 overflow-x-auto sm:overflow-visible no-scrollbar snap-x snap-mandatory px-6 sm:px-0 scroll-pl-6 scroll-pr-6">
          <div className="flex items-center justify-start sm:justify-center gap-3 sm:gap-4 shrink-0 mx-auto">
            {HERO_FAN_CARDS.map((card, idx) => {
              const isHovered = hoveredCardId === card.id;
              const straightenFactor = isStraightened ? 1 : scrollStraighten;
              const rotation = isHovered ? 0 : card.rotation * (1 - straightenFactor * 0.85);
              const translateY = isHovered ? -24 : (Math.abs(card.rotation) * 2) * (1 - straightenFactor);
              const zIndex = isHovered ? 30 : idx + 1;

              return (
                <div
                  key={card.id}
                  onMouseEnter={() => setHoveredCardId(card.id)}
                  onMouseLeave={() => setHoveredCardId(null)}
                  style={{
                    transform: `translateY(${translateY}px) rotate(${isHovered ? 0 : rotation}deg)`,
                    zIndex,
                  }}
                  className="w-48 sm:w-52 md:w-56 shrink-0 rounded-2xl bg-white border-2 border-[#111111] p-3 shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition-all duration-300 cursor-pointer snap-center"
                >
                  {/* Photo Container */}
                  <div className="relative w-full h-44 sm:h-52 rounded-xl overflow-hidden mb-3 bg-[#111111]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={card.image}
                      alt={card.title}
                      className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                    />

                    {/* Platform Pill Stamp */}
                    <span className="absolute top-2 left-2 bg-[#111111] text-[#C6FF2E] font-krackerz-display text-[9px] uppercase px-2 py-0.5 rounded border border-white">
                      {card.platform}
                    </span>

                    {/* Scallop Badge Corner Sticker on selected cards (Cream with ink border) */}
                    {idx % 2 === 1 && (
                      <div className="absolute -bottom-2 -right-2">
                        <ScallopBadge
                          size="sm"
                          iconName={idx === 1 ? "Zap" : idx === 3 ? "Brain" : "Star"}
                          bg="#F7F5EE"
                        />
                      </div>
                    )}
                  </div>

                  {/* Scalloped Caption Tab (Alternating White / Maroon) */}
                  <div
                    className={`p-2.5 rounded-xl border border-[#111111]/20 ${
                      card.tagBg === "oxblood"
                        ? "bg-[#4E0F15] text-white"
                        : "bg-[#F7F5EE] text-[#111111]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-krackerz-display text-[9px] tracking-wider uppercase opacity-80">
                        {card.tag}
                      </span>
                      <span className="text-[10px] font-krackerz-display">✱</span>
                    </div>
                    <div className="font-krackerz-body font-bold text-xs line-clamp-1 leading-snug">
                      {card.title}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
