"use client";

import React, { useState, useRef } from "react";
import { LAPTOP_STICKERS } from "./krackerz-tokens";
import { StickerLabel } from "./StickerLabel";
import { CTAButton } from "./CTAButton";
import { ScallopDivider } from "./ScallopDivider";
import { RotateCcw, X, Move } from "lucide-react";
import { useRecall } from "@/context/RecallContext";

interface StickerState {
  id: string;
  x: number;
  y: number;
  rotate: number;
  zIndex: number;
}

export function StickerShopSection() {
  const { openAddContent } = useRecall();
  const boardRef = useRef<HTMLDivElement>(null);

  const [tooltipDismissed, setTooltipDismissed] = useState(false);
  const [highestZ, setHighestZ] = useState(10);
  const [stickers, setStickers] = useState<StickerState[]>(() =>
    LAPTOP_STICKERS.map((st, idx) => ({
      id: st.id,
      x: st.initialX,
      y: st.initialY,
      rotate: st.initialRotate,
      zIndex: idx + 1,
    }))
  );

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ mouseX: number; mouseY: number; initialX: number; initialY: number } | null>(null);

  const handlePointerDown = (id: string, e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    const newZ = highestZ + 1;
    setHighestZ(newZ);

    const target = stickers.find((s) => s.id === id);
    if (!target) return;

    setDraggingId(id);
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      initialX: target.x,
      initialY: target.y,
    };

    setStickers((prev) =>
      prev.map((s) => (s.id === id ? { ...s, zIndex: newZ } : s))
    );
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!draggingId || !dragStartRef.current || !boardRef.current) return;

    const deltaX = e.clientX - dragStartRef.current.mouseX;
    const deltaY = e.clientY - dragStartRef.current.mouseY;

    setStickers((prev) =>
      prev.map((s) => {
        if (s.id !== draggingId) return s;
        return {
          ...s,
          x: Math.max(10, Math.min(620, dragStartRef.current!.initialX + deltaX)),
          y: Math.max(10, Math.min(300, dragStartRef.current!.initialY + deltaY)),
        };
      })
    );
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggingId) {
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
      setDraggingId(null);
      dragStartRef.current = null;
    }
  };

  const resetStickers = () => {
    setStickers(
      LAPTOP_STICKERS.map((st, idx) => ({
        id: st.id,
        x: st.initialX,
        y: st.initialY,
        rotate: st.initialRotate,
        zIndex: idx + 1,
      }))
    );
  };

  return (
    <section id="stickers" className="relative py-28 sm:py-36 px-4 sm:px-6 lg:px-8 bg-[#111111] text-white border-b-2 border-[#111111] overflow-hidden">
      {/* Background Graphic */}
      <div className="absolute inset-0 opacity-15 pointer-events-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1600&auto=format&fit=crop&q=80"
          alt="Studio Desk"
          className="w-full h-full object-cover filter blur-lg"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Section Headline */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-block bg-[#C4271B] text-white font-krackerz-display text-xs uppercase px-4 py-1.5 rounded-full border-2 border-white shadow-[0_3px_0_#ffffff] mb-6">
            INTERACTIVE PLAYGROUND // TACTILE VAULT
          </div>

          <h2 className="text-4xl sm:text-6xl md:text-7xl font-krackerz-display text-white tracking-tight uppercase leading-[1.02] select-none">
            WORK IN{" "}
            <StickerLabel rotation={-3} size="xl" className="align-middle">
              STYLE
            </StickerLabel>
          </h2>

          <div className="font-krackerz-script font-bold text-3xl sm:text-5xl text-[#C6FF2E] lowercase mt-3">
            customise your digital workspace
          </div>

          <p className="mt-4 text-base sm:text-lg font-krackerz-body font-medium text-white/70 max-w-xl mx-auto">
            Drag the stickers around on the silver lid mockup. Every sticker reflects a core Recall architectural guarantee.
          </p>

          <div className="mt-8 flex items-center justify-center gap-4">
            {/* Mid-page CTA: Secondary Cream or Ink */}
            <CTAButton
              onClick={() => openAddContent()}
              variant="secondary-cream"
              size="md"
            >
              SAVE A LINK NOW
            </CTAButton>

            <button
              type="button"
              onClick={resetStickers}
              className="inline-flex items-center gap-2 font-krackerz-display text-xs uppercase px-5 py-3 rounded-full bg-white text-[#111111] border-2 border-white shadow-[0_3px_0_#111111] hover:scale-105 transition-transform"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>RESET STICKERS</span>
            </button>
          </div>
        </div>

        {/* Interactive Laptop Lid Mockup Canvas */}
        <div className="relative max-w-4xl mx-auto">
          {/* Tooltip Pill */}
          {!tooltipDismissed && (
            <div className="absolute -top-12 left-1/2 -translate-x-1/2 z-30 inline-flex items-center gap-2 bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xs px-4 py-2 rounded-full border-2 border-white shadow-[0_4px_0_#ffffff] animate-bounce">
              <Move className="w-3.5 h-3.5" />
              <span>DRAG THE STICKERS TO CUSTOMIZE THE LID!</span>
              <button
                type="button"
                onClick={() => setTooltipDismissed(true)}
                className="w-4 h-4 rounded-full bg-white text-[#111111] flex items-center justify-center ml-2"
                aria-label="Dismiss tooltip"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          )}

          {/* Silver Laptop Lid Body */}
          <div
            ref={boardRef}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`relative w-full h-[380px] sm:h-[460px] rounded-[36px] bg-gradient-to-b from-[#E2E4E9] to-[#C8CCD5] border-4 border-[#111111] shadow-[0_24px_60px_rgba(0,0,0,0.6)] p-6 overflow-hidden select-none ${
              draggingId ? "touch-none" : ""
            }`}
          >
            {/* Apple / Recall Embossed Center Emblem */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-2xl bg-[#D0D4DD] border-2 border-white/60 shadow-inner flex items-center justify-center pointer-events-none opacity-60">
              <span className="font-krackerz-display text-3xl text-[#111111]/40">✱</span>
            </div>

            {/* Draggable Stickers */}
            {stickers.map((s) => {
              const def = LAPTOP_STICKERS.find((d) => d.id === s.id);
              if (!def) return null;
              const isBeingDragged = draggingId === s.id;

              return (
                <div
                  key={s.id}
                  onPointerDown={(e) => handlePointerDown(s.id, e)}
                  style={{
                    transform: `translate3d(${s.x}px, ${s.y}px, 0) rotate(${s.rotate}deg) scale(${isBeingDragged ? 1.12 : 1})`,
                    zIndex: s.zIndex,
                  }}
                  className={`absolute top-0 left-0 cursor-grab active:cursor-grabbing transition-transform duration-75 select-none touch-none ${
                    isBeingDragged ? "drop-shadow-[0_16px_24px_rgba(0,0,0,0.45)]" : "drop-shadow-[0_6px_12px_rgba(0,0,0,0.25)]"
                  }`}
                >
                  <div
                    style={{ backgroundColor: def.bg, color: def.text }}
                    className="px-4 py-2 sm:px-5 sm:py-2.5 rounded-xl border-3 border-white font-krackerz-display text-xs sm:text-sm uppercase tracking-wider flex items-center gap-2 whitespace-nowrap"
                  >
                    <span>{def.label}</span>
                    <span className="font-krackerz-script text-lg sm:text-xl font-bold lowercase text-[#C4271B]">
                      recall
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Laptop Base Stand Hint */}
          <div className="w-1/2 h-3 mx-auto bg-[#888D98] rounded-b-xl border-x-2 border-b-2 border-[#111111]" />
        </div>
      </div>

      {/* Bottom Scalloped Transition into Cream Section */}
      <div className="absolute bottom-0 left-0 right-0">
        <ScallopDivider fillColor="#F7F5EE" position="bottom" height={36} />
      </div>
    </section>
  );
}
