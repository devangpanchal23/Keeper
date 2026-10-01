"use client";

import React, { useState, useEffect, useRef } from "react";
import { TESTIMONIALS } from "./krackerz-tokens";
import { StickerLabel } from "./StickerLabel";
import { CTAButton } from "./CTAButton";
import { Quote, ChevronLeft, ChevronRight } from "lucide-react";
import { useRecall } from "@/context/RecallContext";

export function TestimonialsSection() {
  const { openAddContent } = useRecall();
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartXRef = useRef<number | null>(null);

  const total = TESTIMONIALS.length;

  const nextSlide = () => setActiveIndex((prev) => (prev + 1) % total);
  const prevSlide = () => setActiveIndex((prev) => (prev - 1 + total) % total);

  // Auto-rotate every 4.5 seconds; pauses on hover
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(nextSlide, 4500);
    return () => clearInterval(interval);
  }, [isPaused, total]);

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    if (deltaX > 40) prevSlide();
    else if (deltaX < -40) nextSlide();
    touchStartXRef.current = null;
  };

  return (
    <section
      id="testimonials"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      className="relative py-28 sm:py-36 px-4 sm:px-6 lg:px-8 bg-[#111111] text-white border-b-2 border-[#111111] overflow-hidden"
    >
      {/* Background Motion Blurred Photo Overlay with Oxblood Tint */}
      <div className="absolute inset-0 bg-[#4E0F15]/40 opacity-70 pointer-events-none" />
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=1600&auto=format&fit=crop&q=80"
          alt="Studio Background"
          className="w-full h-full object-cover filter blur-md"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Section Headline */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          {/* Eyebrow: max 1 lime sticker per section */}
          <div className="inline-block bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xs uppercase px-4 py-1.5 rounded-full border-2 border-white shadow-[0_3px_0_#ffffff] mb-6">
            COMMUNITY PROOF // ZERO GUESSWORK
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-krackerz-display text-white tracking-tight uppercase leading-[1.02] select-none">
            YOU&apos;RE{" "}
            <span className="font-krackerz-script font-bold text-5xl sm:text-7xl text-[#C4271B] lowercase mx-1 inline-block -rotate-6">
              not
            </span>{" "}
            ALONE
            <span className="inline-block ml-3 align-middle">
              <StickerLabel rotation={4} size="md">
                TESTED
              </StickerLabel>
            </span>
          </h2>

          <p className="mt-4 text-base sm:text-lg font-krackerz-body font-medium text-white/70 max-w-xl mx-auto">
            Designers, engineers, and researchers saving what matters across 11 platforms.
          </p>
        </div>

        {/* Fanned Carousel with Non-clipped, Fully Readable Text (min 16px, max 4 lines) */}
        <div
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="relative max-w-3xl mx-auto mb-12 min-h-[340px] flex items-center justify-center"
        >
          {TESTIMONIALS.map((item, idx) => {
            const offset = (idx - activeIndex + total) % total;
            const isCenter = offset === 0;
            const isRight = offset === 1 || (total === 2 && offset === 1);
            const isLeft = offset === total - 1;

            // Show active center, left neighbour, and right neighbour
            if (!isCenter && !isRight && !isLeft) return null;

            let transform = "scale-90 opacity-0 pointer-events-none";
            let zIndex = 10;

            if (isCenter) {
              transform = "scale-100 rotate-0 opacity-100 translate-x-0 z-30 shadow-[0_20px_48px_rgba(0,0,0,0.5)]";
              zIndex = 30;
            } else if (isRight) {
              transform = "scale-90 rotate-3 opacity-60 translate-x-12 sm:translate-x-32 z-20 cursor-pointer";
              zIndex = 20;
            } else if (isLeft) {
              transform = "scale-90 -rotate-3 opacity-60 -translate-x-12 sm:-translate-x-32 z-20 cursor-pointer";
              zIndex = 20;
            }

            return (
              <div
                key={item.id}
                onClick={() => setActiveIndex(idx)}
                style={{ backgroundColor: item.color }}
                className={`absolute w-full max-w-xl p-8 sm:p-10 rounded-3xl border-3 border-white transition-all duration-500 ease-out select-none flex flex-col justify-between ${transform}`}
              >
                {/* Top Quote Tag */}
                <div className="flex items-center justify-between mb-4">
                  <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <Quote className="w-5 h-5 fill-white" />
                  </div>
                  <span className="font-krackerz-display text-xs uppercase px-3 py-1 rounded-full bg-black/40 text-white border border-white/30">
                    {item.tag}
                  </span>
                </div>

                {/* Quote Body: min 16px font, max 4 lines, no clipping */}
                <p className="font-krackerz-body font-medium text-base sm:text-lg text-white leading-relaxed mb-6 line-clamp-4 italic">
                  &ldquo;{item.quote}&rdquo;
                </p>

                {/* Author Info */}
                <div className="pt-4 border-t border-white/20 flex items-center justify-between">
                  <div>
                    <div className="font-krackerz-display text-base uppercase text-white tracking-wide">
                      {item.name}
                    </div>
                    <div className="font-krackerz-body text-xs text-white/80 font-bold mt-0.5">
                      {item.role} • {item.city}
                    </div>
                  </div>

                  <span className="font-mono text-xs text-white/50 border border-white/20 px-2 py-0.5 rounded">
                    0{idx + 1} / 0{total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Carousel Navigation Arrows & Indicators */}
        <div className="flex items-center justify-center gap-4 mb-16 select-none">
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous testimonial"
            className="w-11 h-11 rounded-full bg-white text-[#111111] border-2 border-white flex items-center justify-center shadow-[0_3px_0_#111111] hover:scale-105 active:scale-95 transition-transform"
          >
            <ChevronLeft className="w-5 h-5 stroke-[2.5]" />
          </button>

          {/* Dots */}
          <div className="flex items-center gap-2">
            {TESTIMONIALS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setActiveIndex(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  i === activeIndex ? "w-8 bg-[#C4271B]" : "w-2.5 bg-white/40 hover:bg-white/70"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next testimonial"
            className="w-11 h-11 rounded-full bg-white text-[#111111] border-2 border-white flex items-center justify-center shadow-[0_3px_0_#111111] hover:scale-105 active:scale-95 transition-transform"
          >
            <ChevronRight className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* Centered Mid-Page CTA (Secondary Ink per lime budget) */}
        <div className="text-center">
          <CTAButton
            onClick={() => openAddContent()}
            variant="secondary-ink"
            size="lg"
          >
            JOIN 4,200+ CURATORS TODAY
          </CTAButton>
        </div>
      </div>
    </section>
  );
}
