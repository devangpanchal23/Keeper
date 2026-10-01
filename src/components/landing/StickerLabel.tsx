"use client";

import React from "react";

interface StickerLabelProps {
  children: React.ReactNode;
  rotation?: number;
  className?: string;
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "lime-on-black" | "black-on-lime" | "white-on-red";
}

export function StickerLabel({
  children,
  rotation = -3,
  className = "",
  size = "md",
  variant = "lime-on-black",
}: StickerLabelProps) {
  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs border-2 shadow-md",
    md: "px-3.5 py-1 text-sm sm:text-base border-[2.5px] shadow-lg",
    lg: "px-4 sm:px-6 py-1.5 sm:py-2 text-lg sm:text-2xl border-[3px] shadow-xl",
    xl: "px-5 sm:px-8 py-2 sm:py-3 text-2xl sm:text-4xl border-[4px] shadow-2xl",
  };

  const variantStyles = {
    "lime-on-black": "bg-[#111111] text-[#C6FF2E] border-white shadow-black/40",
    "black-on-lime": "bg-[#C6FF2E] text-[#111111] border-[#111111] shadow-black/30",
    "white-on-red": "bg-[#C4271B] text-white border-white shadow-black/30",
    "white-on-brick": "bg-[#C4271B] text-white border-white shadow-black/30",
    "black-on-cream": "bg-[#F7F5EE] text-[#111111] border-[#111111] shadow-black/20",
  };

  return (
    <span
      style={{ transform: `rotate(${rotation}deg)` }}
      className={`inline-block font-krackerz-display uppercase tracking-wider rounded-md transition-all duration-200 hover:scale-105 hover:rotate-0 cursor-default select-none ${sizeStyles[size]} ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
