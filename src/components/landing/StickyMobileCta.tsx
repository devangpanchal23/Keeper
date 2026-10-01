"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Plus } from "lucide-react";
import { useRecall } from "@/context/RecallContext";
import { ROUTES } from "@/config/routes";

export function StickyMobileCta() {
  const { openAddContent, user } = useRecall();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show only when scrolled past the hero section (> 400px)
      setShow(window.scrollY > 400);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  if (!show) return null;

  return (
    <div
      className="sm:hidden fixed bottom-4 left-4 right-4 z-40 transition-all duration-300 transform translate-y-0"
      aria-label="Mobile quick actions"
    >
      <div className="bg-[#F7F5EE]/95 backdrop-blur-md border-2 border-[#111111] rounded-full p-2 shadow-[0_6px_0_#111111] flex items-center justify-between gap-2">
        {/* Secondary Dashboard Button */}
        <Link
          href={ROUTES.dashboard}
          prefetch
          aria-label="Go to product dashboard"
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-full bg-white text-[#111111] border border-[#111111] font-krackerz-display text-xs uppercase tracking-wide shadow-sm active:translate-y-0.5"
        >
          <span>{user?.name ? "Dashboard" : "App"}</span>
          <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
        </Link>

        {/* Primary Ingestion CTA (Lime fill) */}
        <button
          type="button"
          onClick={() => openAddContent()}
          className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-full bg-[#C6FF2E] text-[#111111] border border-[#111111] font-krackerz-display text-xs uppercase tracking-wide shadow-[0_2px_0_#111111] active:translate-y-0.5"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Save URL</span>
        </button>
      </div>
    </div>
  );
}
