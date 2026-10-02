"use client";

import React from "react";
import Link from "next/link";
import { ArrowLeft, Home, ArrowUpRight } from "lucide-react";
import { ROUTES } from "@/config/routes";
import { MascotCharacter } from "@/components/landing/MascotCharacter";
import { StickerLabel } from "@/components/landing/StickerLabel";

export default function NotFoundPage() {
  return (
    <div className="min-h-screen bg-[#F7F5EE] bg-dot-grid text-[#111111] flex flex-col items-center justify-center p-4 sm:p-8 font-krackerz-body select-none">
      {/* Central Ticket Card Container */}
      <div className="relative max-w-lg w-full bg-white border-3 border-[#111111] rounded-3xl p-5 sm:p-12 shadow-[0_16px_36px_rgba(17,17,17,0.18)] text-center ticket-notch-tr">
        {/* Decorative Ticket Punch Hole */}
        <div className="absolute top-3 right-3 w-8 h-8 rounded-full border border-dashed border-[#111111]/30 pointer-events-none" />

        {/* Eyebrow Pill */}
        <div className="inline-block bg-[#111111] text-[#C6FF2E] font-krackerz-display text-xs uppercase px-4 py-1.5 rounded-full border border-white shadow-sm mb-6">
          STATUS 404 // MEMORY VOID
        </div>

        {/* Mascot */}
        <div className="mb-6 flex justify-center">
          <MascotCharacter mood="wink" size="lg" />
        </div>

        {/* 404 Headline */}
        <h1 className="text-6xl sm:text-7xl font-krackerz-display text-[#111111] tracking-tight uppercase leading-none mb-3">
          404{" "}
          <span className="font-krackerz-script font-bold text-5xl sm:text-6xl text-[#C4271B] lowercase align-middle">
            oops!
          </span>
        </h1>

        <div className="mb-6">
          <StickerLabel rotation={-3} size="md">
            PAGE NOT FOUND
          </StickerLabel>
        </div>

        <p className="text-sm sm:text-base font-medium text-[#111111]/80 max-w-md mx-auto leading-relaxed mb-8">
          The link you requested has vanished into the algorithmic void. Don&apos;t worry, your sovereign vault is safe.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={ROUTES.home}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#111111] text-[#F7F5EE] font-krackerz-display text-xs uppercase px-5 py-3 rounded-full border-2 border-[#111111] shadow-[0_3px_0_#111111] hover:shadow-[0_5px_0_#111111] hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Return Home</span>
          </Link>

          <Link
            href={ROUTES.dashboard}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-[#F7F5EE] text-[#111111] font-krackerz-display text-xs uppercase px-5 py-3 rounded-full border-2 border-[#111111] shadow-[0_3px_0_#111111] hover:shadow-[0_5px_0_#111111] hover:-translate-y-0.5 active:translate-y-0.5 transition-all"
          >
            <span>Open Dashboard</span>
            <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
          </Link>
        </div>
      </div>
    </div>
  );
}
