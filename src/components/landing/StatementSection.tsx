"use client";

import React from "react";
import { ShieldCheck } from "lucide-react";
import { StickerLabel } from "./StickerLabel";
import { ScallopBadge } from "./ScallopBadge";

export function StatementSection() {
  const [isInView, setIsInView] = React.useState(false);
  const sectionRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
        }
      },
      { threshold: 0.2 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="relative py-24 sm:py-32 px-4 sm:px-6 lg:px-8 bg-white border-b-2 border-[#111111] overflow-hidden"
    >
      <div className="max-w-6xl mx-auto">
        {/* Giant Statement Headline */}
        <div className="text-center max-w-4xl mx-auto mb-16">
          <div
            className={`inline-block bg-[#C4271B] text-white font-krackerz-display text-xs uppercase px-4 py-1.5 rounded-full border-2 border-[#111111] shadow-[0_3px_0_#111111] mb-6 transition-all duration-500 ${
              isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            THE SYSTEM TRAP
          </div>

          <h2 className="text-3xl sm:text-6xl md:text-7xl font-krackerz-display text-[#111111] tracking-tight leading-[1.02] uppercase select-none break-words">
            <span
              className={`inline-block transition-all duration-700 delay-100 ${
                isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
            >
              ALGORITHMIC FEEDS TAUGHT{" "}
            </span>
            <span
              className={`inline-block transition-all duration-700 delay-200 text-[#4E0F15] ${
                isInView ? "opacity-100 scale-100" : "opacity-40 scale-95"
              }`}
            >
              CONSUMPTION.
            </span>
            <br />
            <span className={`inline-block mt-3 ${isInView ? "animate-sticker-slap" : "opacity-0"}`}>
              <StickerLabel rotation={-4} size="xl">
                NOT RETENTION
              </StickerLabel>
            </span>
          </h2>

          <p
            className={`mt-6 text-base sm:text-lg font-krackerz-body font-medium text-[#111111]/70 max-w-2xl mx-auto leading-relaxed transition-all duration-700 delay-300 ${
              isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
          >
            Every day you find breakthroughs: an architectural pattern in a GitHub issue, a design insight in an Instagram reel, a brutal post-mortem on Reddit. You click save. And by tomorrow morning, it is gone forever.
          </p>
        </div>

        {/* Large Rounded Media / Demonstration Panel with Parallax Framing */}
        <div className="relative rounded-3xl border-3 border-[#111111] bg-[#111111] p-3 sm:p-4 shadow-[0_16px_36px_rgba(0,0,0,0.22)] overflow-hidden">
          {/* Top Window Bar (Mac / Studio Style) */}
          <div className="flex items-center justify-between pb-3 px-2 border-b border-white/10 gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-[#C4271B]" />
              <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-[#F7F5EE]" />
              <span className="w-2.5 sm:w-3 h-2.5 sm:h-3 rounded-full bg-white/40" />
            </div>

            <div className="font-mono text-[10px] sm:text-xs text-[#C6FF2E] uppercase tracking-wider font-bold truncate max-w-[140px] sm:max-w-none">
              RECALL_INGESTION_ENGINE_v2.6.mp4
            </div>

            <div className="text-[10px] sm:text-[11px] font-mono text-white/50 shrink-0">
              00:42 // 60 FPS
            </div>
          </div>

          {/* Interactive Video / Canvas Simulation */}
          <div className="relative aspect-video rounded-2xl overflow-hidden bg-[#0A0C10] flex items-center justify-center">
            {/* Background Graphic / Video Placeholder */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=1600&auto=format&fit=crop&q=80"
              alt="Recall Ingestion System Interface"
              className="w-full h-full object-cover opacity-60"
            />

            {/* Glowing Oxblood Pipeline Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#4E0F15] via-[#4E0F15]/60 to-transparent flex flex-col justify-end p-6 sm:p-10">
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xs px-3 py-1 rounded-full mb-3 border border-white/20">
                  <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                  <span>DETERMINISTIC EXTRACTION ACTIVE</span>
                </div>

                <h3 className="text-xl sm:text-3xl font-krackerz-display text-white uppercase tracking-tight mb-2">
                  FROM RAW URL TO PERMANENT MEMORY IN 420ms
                </h3>

                <p className="text-xs sm:text-sm font-krackerz-body text-white/80 leading-relaxed font-medium">
                  We bypass algorithmic feeds, extract genuine transcripts, normalize tags, and save verified creator attribution.
                </p>
              </div>
            </div>

            {/* Floating Top Right Scallop Flower Badge (Cream with ink border) */}
            <div className="absolute top-6 right-6">
              <ScallopBadge iconName="Rocket" bg="#F7F5EE" size="md" rotation={8} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
