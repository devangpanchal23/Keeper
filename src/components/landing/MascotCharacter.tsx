"use client";

import React, { useState } from "react";

interface MascotCharacterProps {
  mood?: "happy" | "thumbs-up" | "wink";
  className?: string;
  size?: "sm" | "md" | "lg";
}

export function MascotCharacter({
  mood = "happy",
  className = "",
  size = "md",
}: MascotCharacterProps) {
  const [isWiggling, setIsWiggling] = useState(false);

  const sizeClasses = {
    sm: "w-14 h-14",
    md: "w-20 h-20 sm:w-24 sm:h-24",
    lg: "w-28 h-28 sm:w-36 sm:h-36",
  };

  const handleInteract = () => {
    setIsWiggling(true);
    setTimeout(() => setIsWiggling(false), 800);
  };

  return (
    <div
      onClick={handleInteract}
      onMouseEnter={handleInteract}
      className={`inline-block select-none cursor-pointer transition-transform duration-300 hover:scale-110 ${
        isWiggling ? "animate-bounce" : ""
      } ${sizeClasses[size]} ${className}`}
      title="Vaulty — Your Knowledge Companion"
    >
      <svg
        viewBox="0 0 120 120"
        className="w-full h-full filter drop-shadow-[0_8px_12px_rgba(0,0,0,0.18)]"
      >
        {/* Antenna */}
        <line x1="60" y1="20" x2="60" y2="6" stroke="#111111" strokeWidth="4" strokeLinecap="round" />
        <circle cx="60" cy="5" r="5" fill="#C4271B" stroke="#111111" strokeWidth="3" />

        {/* Head / Body Box (Vault Shape: Cream neutral with ink border) */}
        <rect
          x="20"
          y="20"
          width="80"
          height="80"
          rx="18"
          fill="#F7F5EE"
          stroke="#111111"
          strokeWidth="4"
        />

        {/* Inner Screen Area */}
        <rect
          x="28"
          y="28"
          width="64"
          height="52"
          rx="10"
          fill="#111111"
        />

        {/* Eyes */}
        {mood === "wink" ? (
          <>
            <circle cx="45" cy="50" r="6" fill="#C6FF2E" />
            <path d="M 68 50 Q 75 46 82 50" stroke="#C6FF2E" strokeWidth="4" strokeLinecap="round" fill="none" />
          </>
        ) : (
          <>
            {/* Left Eye */}
            <circle cx="45" cy="50" r="6" fill="#C6FF2E">
              <animate
                attributeName="ry"
                values="6; 6; 1; 6; 6"
                dur="3.5s"
                repeatCount="indefinite"
              />
            </circle>
            {/* Right Eye */}
            <circle cx="75" cy="50" r="6" fill="#C6FF2E">
              <animate
                attributeName="ry"
                values="6; 6; 1; 6; 6"
                dur="3.5s"
                repeatCount="indefinite"
              />
            </circle>
          </>
        )}

        {/* Smile */}
        <path
          d="M 50 64 Q 60 72 70 64"
          stroke="#C6FF2E"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Cheek Blushes in Brick Red */}
        <circle cx="36" cy="62" r="3.5" fill="#C4271B" opacity="0.85" />
        <circle cx="84" cy="62" r="3.5" fill="#C4271B" opacity="0.85" />

        {/* Feet */}
        <rect x="36" y="98" width="14" height="12" rx="4" fill="#111111" />
        <rect x="70" y="98" width="14" height="12" rx="4" fill="#111111" />

        {/* Hand (Thumbs-up or wave) */}
        {mood === "thumbs-up" ? (
          <g transform="translate(94, 52)">
            <circle cx="10" cy="10" r="9" fill="#C4271B" stroke="#111111" strokeWidth="3" />
            <path d="M 8 5 L 8 15 M 5 10 L 15 10" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
          </g>
        ) : (
          <g transform="translate(4, 56)">
            <circle cx="10" cy="10" r="8" fill="#C4271B" stroke="#111111" strokeWidth="3" />
          </g>
        )}
      </svg>
    </div>
  );
}
