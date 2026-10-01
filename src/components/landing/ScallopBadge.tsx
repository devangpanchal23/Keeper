"use client";

import React from "react";
import {
  Rocket,
  Brain,
  Trophy,
  Megaphone,
  Star,
  Hourglass,
  Sparkles,
  Zap,
  ShieldCheck,
  Bookmark,
} from "lucide-react";

interface ScallopBadgeProps {
  iconName?: string;
  label?: string;
  bg?: string;
  iconColor?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
  rotation?: number;
}

const ICON_MAP: Record<string, React.ElementType> = {
  Rocket,
  Brain,
  Trophy,
  Megaphone,
  Star,
  Hourglass,
  Sparkles,
  Zap,
  ShieldCheck,
  Bookmark,
};

export function ScallopBadge({
  iconName = "Sparkles",
  label,
  bg = "#F7F5EE",
  iconColor = "#111111",
  size = "md",
  className = "",
  rotation = 0,
}: ScallopBadgeProps) {
  const IconComponent = ICON_MAP[iconName] || Sparkles;

  const sizeStyles = {
    sm: "w-10 h-10 p-2",
    md: "w-14 h-14 p-3.5",
    lg: "w-20 h-20 p-5",
  };

  const iconSizes = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-10 h-10",
  };

  return (
    <div
      style={{ transform: `rotate(${rotation}deg)` }}
      className={`relative inline-flex items-center justify-center transition-transform duration-300 hover:rotate-12 hover:scale-110 select-none ${className}`}
    >
      {/* Scalloped Flower Silhouette SVG */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-0 w-full h-full drop-shadow-md"
        fill={bg}
        stroke="#111111"
        strokeWidth="3"
      >
        <path d="M50 0 C58 12 70 12 78 4 C84 16 96 22 96 35 C104 45 104 57 96 67 C96 80 84 86 78 98 C70 90 58 90 50 102 C42 90 30 90 22 98 C16 86 4 80 4 67 C-4 57 -4 45 4 35 C4 22 16 16 22 4 C30 12 42 12 50 0 Z" />
      </svg>

      {/* Center Icon */}
      <div
        className={`relative z-10 flex items-center justify-center ${sizeStyles[size]}`}
        style={{ color: iconColor }}
      >
        <IconComponent className={`${iconSizes[size]} stroke-[2.2]`} />
      </div>

      {label && (
        <span className="absolute -bottom-6 whitespace-nowrap bg-[#111111] text-[#F7F5EE] font-krackerz-display text-[9px] uppercase px-2 py-0.5 rounded border border-white shadow-sm">
          {label}
        </span>
      )}
    </div>
  );
}
