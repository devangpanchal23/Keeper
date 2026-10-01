"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";

interface CTAButtonProps {
  children: React.ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary-lime" | "secondary-ink" | "secondary-cream" | "secondary-white" | "dark-oxblood";
  size?: "sm" | "md" | "lg";
  className?: string;
  showArrow?: boolean;
  arrowType?: "right" | "up-right";
  ariaLabel?: string;
  magnetic?: boolean;
}

export function CTAButton({
  children,
  href,
  onClick,
  variant = "primary-lime",
  size = "md",
  className = "",
  showArrow = true,
  arrowType = "right",
  ariaLabel,
  magnetic = true,
}: CTAButtonProps) {
  const buttonRef = useRef<HTMLButtonElement | HTMLAnchorElement | null>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!magnetic || !buttonRef.current) return;
    // Check if desktop pointer
    if (typeof window !== "undefined" && !window.matchMedia("(pointer: fine)").matches) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxShift = 5; // Subtle 5px magnetic attraction
    const shiftX = Math.max(-maxShift, Math.min(maxShift, (e.clientX - centerX) * 0.2));
    const shiftY = Math.max(-maxShift, Math.min(maxShift, (e.clientY - centerY) * 0.2));
    setOffset({ x: shiftX, y: shiftY });
  };

  const handleMouseLeave = () => {
    setOffset({ x: 0, y: 0 });
  };

  const sizeStyles = {
    sm: "px-3.5 sm:px-4 py-2 text-xs",
    md: "px-6 sm:px-8 py-3.5 sm:py-4 text-xs sm:text-sm md:text-base",
    lg: "px-8 sm:px-10 py-4 sm:py-5 text-sm sm:text-base md:text-lg",
  };

  const variantStyles = {
    // Reserved for Hero CTA and Final CTA only
    "primary-lime":
      "bg-[#C6FF2E] text-[#111111] border-2 border-[#111111] shadow-[0_4px_0_#111111] hover:shadow-[0_6px_0_#111111] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#111111]",
    // Default mid-page CTA (ink filled with cream text)
    "secondary-ink":
      "bg-[#111111] text-[#F7F5EE] border-2 border-[#111111] shadow-[0_4px_0_#111111] hover:shadow-[0_6px_0_#111111] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#111111]",
    // Dashboard button (cream fill, ink border, ink text)
    "secondary-cream":
      "bg-[#F7F5EE] text-[#111111] border-2 border-[#111111] shadow-[0_4px_0_#111111] hover:shadow-[0_6px_0_#111111] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#111111]",
    "secondary-white":
      "bg-white text-[#111111] border-2 border-[#111111] shadow-[0_4px_0_#111111] hover:shadow-[0_6px_0_#111111] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#111111]",
    "dark-oxblood":
      "bg-[#4E0F15] text-[#F7F5EE] border-2 border-[#111111] shadow-[0_4px_0_#111111] hover:shadow-[0_6px_0_#111111] hover:-translate-y-0.5 active:translate-y-1 active:shadow-[0_1px_0_#111111]",
  };

  const arrowCircleStyles = {
    "primary-lime": "bg-[#C4271B] text-white",
    "secondary-ink": "bg-[#F7F5EE] text-[#111111]",
    "secondary-cream": "bg-[#111111] text-white",
    "secondary-white": "bg-[#111111] text-white",
    "dark-oxblood": "bg-[#C4271B] text-white",
  };

  const ArrowIcon = arrowType === "up-right" ? ArrowUpRight : ArrowRight;

  const content = (
    <span className="flex items-center justify-center gap-2.5 sm:gap-3 font-krackerz-display uppercase tracking-wide">
      <span>{children}</span>
      {showArrow && (
        <span
          className={`w-6 h-6 sm:w-7 sm:h-7 rounded-full flex items-center justify-center transition-transform duration-200 group-hover:translate-x-0.5 shrink-0 ${arrowCircleStyles[variant]}`}
        >
          <ArrowIcon className="w-3.5 h-3.5 stroke-[2.5]" />
        </span>
      )}
    </span>
  );

  const baseClasses = `group inline-flex items-center justify-center rounded-full transition-all duration-150 select-none cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4271B] focus-visible:ring-offset-2 ${sizeStyles[size]} ${variantStyles[variant]} ${className}`;

  const magneticStyle = {
    transform: `translate3d(${offset.x}px, ${offset.y}px, 0)`,
    transition: offset.x === 0 && offset.y === 0 ? "transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)" : "none",
  };

  if (href) {
    return (
      <Link
        href={href}
        ref={buttonRef as React.Ref<HTMLAnchorElement>}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={magneticStyle}
        aria-label={ariaLabel}
        className={baseClasses}
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      ref={buttonRef as React.Ref<HTMLButtonElement>}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={magneticStyle}
      onClick={onClick}
      aria-label={ariaLabel}
      className={baseClasses}
    >
      {content}
    </button>
  );
}
