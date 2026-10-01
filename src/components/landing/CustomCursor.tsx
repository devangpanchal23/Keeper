"use client";

import React, { useEffect, useState } from "react";

export function CustomCursor() {
  const [position, setPosition] = useState({ x: -100, y: -100 });
  const [isHovering, setIsHovering] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isTouch, setIsTouch] = useState(true);

  useEffect(() => {
    // Only enable on desktop pointer devices
    const hasFinePointer = window.matchMedia("(pointer: fine)").matches;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (!hasFinePointer || prefersReducedMotion) {
      setIsTouch(true);
      return;
    }

    setIsTouch(false);

    const onMouseMove = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
      setIsVisible(true);

      const target = e.target as HTMLElement | null;
      if (target) {
        const isInteractive = Boolean(
          target.closest("button, a, input, [role='button'], .cursor-pointer, .cursor-grab")
        );
        setIsHovering(isInteractive);
      }
    };

    const onMouseLeave = () => {
      setIsVisible(false);
    };

    const onMouseEnter = () => {
      setIsVisible(true);
    };

    window.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseleave", onMouseLeave);
    document.addEventListener("mouseenter", onMouseEnter);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseleave", onMouseLeave);
      document.removeEventListener("mouseenter", onMouseEnter);
    };
  }, []);

  if (isTouch || !isVisible) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        transform: `translate3d(${position.x}px, ${position.y}px, 0) translate(-50%, -50%)`,
      }}
      className={`fixed top-0 left-0 pointer-events-none z-[100] transition-[width,height,background-color] duration-150 ease-out rounded-full flex items-center justify-center ${
        isHovering
          ? "w-10 h-10 bg-[#C6FF2E]/30 border-2 border-[#111111] backdrop-blur-[1px]"
          : "w-4 h-4 bg-[#111111] border border-white"
      }`}
    >
      {isHovering && (
        <span className="w-1.5 h-1.5 rounded-full bg-[#111111] pointer-events-none" />
      )}
    </div>
  );
}
