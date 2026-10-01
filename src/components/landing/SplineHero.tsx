"use client";

import React, { useState, useEffect, useRef } from "react";
import { Box, ShieldCheck, Sparkles } from "lucide-react";

// Robust TypeScript augmentation for both React 18 and React 19 JSX systems
declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "spline-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          url?: string;
          "loading-anim-type"?: string;
        },
        HTMLElement
      >;
    }
  }
}

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "spline-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          url?: string;
          "loading-anim-type"?: string;
        },
        HTMLElement
      >;
    }
  }
}

interface SplineHeroProps {
  className?: string;
}

export function SplineHero({ className = "" }: SplineHeroProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInViewport, setIsInViewport] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [reducedMotion, setReducedMotion] = useState(false);
  const [splineLoaded, setSplineLoaded] = useState(false);

  const splineSceneUrl = process.env.NEXT_PUBLIC_SPLINE_HERO_URL || "";

  useEffect(() => {
    setIsClient(true);

    if (typeof window === "undefined") return;

    // Check system preference for reduced motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handleMotionChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handleMotionChange);

    // If a Spline Scene URL is supplied, load Spline viewer dynamically without bundler errors
    if (splineSceneUrl && !mediaQuery.matches) {
      if ("customElements" in window && window.customElements.get("spline-viewer")) {
        setSplineLoaded(true);
      } else {
        const existingScript = document.querySelector('script[src*="spline-viewer"]');
        if (!existingScript) {
          const script = document.createElement("script");
          script.type = "module";
          script.src = "https://unpkg.com/@splinetool/viewer@latest/build/spline-viewer.js";
          script.async = true;
          script.onload = () => setSplineLoaded(true);
          document.head.appendChild(script);
        } else {
          setSplineLoaded(true);
        }
      }
    }

    // IntersectionObserver to pause processing when offscreen (saves GPU & battery)
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsInViewport(entry.isIntersecting);
      },
      { threshold: 0.1 }
    );

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener("change", handleMotionChange);
    };
  }, [splineSceneUrl]);

  // Mouse tilt physics for the 3D sticker object
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reducedMotion || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5; // -0.5 to 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setMousePos({ x, y });
  };

  const handleMouseLeave = () => {
    setMousePos({ x: 0, y: 0 });
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className={`relative w-full aspect-[16/10] sm:aspect-[16/9] max-w-xl mx-auto rounded-3xl overflow-hidden select-none ${className}`}
      style={{ perspective: 1000 }}
    >
      {/* If Spline scene URL is provided and in viewport, render live Spline canvas */}
      {isClient && splineSceneUrl && splineLoaded && isInViewport && !reducedMotion ? (
        <div className="w-full h-full">
          {React.createElement("spline-viewer", {
            url: splineSceneUrl,
            "loading-anim-type": "spinner-small",
            style: { width: "100%", height: "100%" },
          })}
        </div>
      ) : (
        /* High-Performance 3D Interactive Badge (60:30:10 Palette, 0 CLS, Zero-Bundle Cost) */
        <div
          style={{
            transform: reducedMotion
              ? "none"
              : `rotateY(${mousePos.x * 24}deg) rotateX(${-mousePos.y * 24}deg) translateZ(20px)`,
            transition: "transform 0.15s ease-out",
          }}
          className="relative w-full h-full flex items-center justify-center p-6 bg-gradient-to-b from-[#F7F5EE] to-[#EBE7DC] border-2 border-[#111111] rounded-3xl shadow-[0_16px_36px_rgba(17,17,17,0.12)]"
        >
          {/* Subtle 3D Ambient Shadow */}
          <div className="absolute inset-0 rounded-3xl bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-white/60 via-transparent to-black/5 pointer-events-none" />

          {/* Central 3D Embossed Shield Object */}
          <div className="relative flex flex-col items-center justify-center text-center p-8 rounded-2xl bg-[#4E0F15] text-[#F7F5EE] border-[3px] border-[#111111] shadow-[0_12px_24px_rgba(78,15,21,0.3)] max-w-sm">
            {/* Top Glossy Highlight Ribbon */}
            <div className="absolute top-2 left-6 right-6 h-1 bg-white/20 rounded-full" />

            {/* Glowing Icon Hub */}
            <div className="w-16 h-16 rounded-2xl bg-[#111111] border-2 border-[#F7F5EE] flex items-center justify-center text-[#C6FF2E] mb-4 shadow-lg">
              <Box className="w-8 h-8 stroke-[2.2]" />
            </div>

            <div className="font-krackerz-display text-xl sm:text-2xl text-[#F7F5EE] uppercase tracking-tight leading-snug mb-2">
              DETERMINISTIC KNOWLEDGE ENGINE
            </div>

            <div className="font-krackerz-body font-semibold text-xs text-white/80 leading-relaxed mb-4">
              Real-time multi-platform extraction with verified creator provenance.
            </div>

            {/* Micro Badge */}
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#111111] text-[#C6FF2E] font-krackerz-display text-[10px] uppercase border border-white/20">
              <ShieldCheck className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>3D SENSORY VAULT // READY</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
