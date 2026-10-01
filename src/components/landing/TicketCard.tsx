"use client";

import React from "react";

interface TicketCardProps {
  pillTag?: string;
  headlineScript?: string;
  headlineMain: string;
  body: string;
  statNum?: string;
  statLabel?: string;
  color?: string;
  rotation?: number;
  className?: string;
  notch?: "tr" | "tl";
}

export function TicketCard({
  pillTag,
  headlineScript,
  headlineMain,
  body,
  statNum,
  statLabel,
  color = "#C4271B",
  rotation = -2,
  className = "",
  notch = "tr",
}: TicketCardProps) {
  const notchClass = notch === "tr" ? "ticket-notch-tr" : "ticket-notch-tl";

  return (
    <div
      style={{
        backgroundColor: color,
        transform: `rotate(${rotation}deg)`,
      }}
      className={`relative p-7 sm:p-9 text-white rounded-2xl border-2 border-[#111111] shadow-[0_12px_24px_rgba(0,0,0,0.18)] transition-all duration-300 hover:rotate-0 hover:scale-[1.02] hover:shadow-[0_16px_32px_rgba(0,0,0,0.25)] ${notchClass} ${className}`}
    >
      {/* Decorative Ticket Punch Hole Ring */}
      <div
        className={`absolute top-2 right-2 w-7 h-7 rounded-full border border-dashed border-white/40 pointer-events-none ${
          notch === "tr" ? "block" : "hidden"
        }`}
      />

      {/* Pill Eyebrow */}
      {pillTag && (
        <div className="inline-block bg-[#111111] text-[#C6FF2E] font-krackerz-display text-[10px] tracking-widest uppercase px-3 py-1 rounded-full border border-white mb-6">
          {pillTag}
        </div>
      )}

      {/* Headline with script accent */}
      <h3 className="text-2xl sm:text-3xl lg:text-4xl font-krackerz-display tracking-tight leading-[1.05] uppercase mb-4">
        {headlineScript && (
          <span className="font-krackerz-script font-bold text-3xl sm:text-4xl lg:text-5xl text-[#C6FF2E] mr-2 lowercase">
            {headlineScript}
          </span>
        )}
        <span>{headlineMain}</span>
      </h3>

      {/* Body Copy */}
      <p className="text-sm sm:text-base font-krackerz-body text-white/90 leading-relaxed font-medium mb-6">
        {body}
      </p>

      {/* Dashed Tear Line */}
      <div className="border-t border-dashed border-white/30 my-6 pt-4 flex items-center justify-between">
        {statNum && (
          <div>
            <div className="text-3xl sm:text-4xl font-krackerz-display text-[#C6FF2E]">
              {statNum}
            </div>
            {statLabel && (
              <div className="text-xs font-krackerz-body uppercase tracking-wider text-white/80 font-bold mt-0.5">
                {statLabel}
              </div>
            )}
          </div>
        )}

        <div className="font-mono text-[10px] uppercase tracking-widest text-white/50 border border-white/20 px-2 py-0.5 rounded">
          TICKET REF // #REC
        </div>
      </div>
    </div>
  );
}
