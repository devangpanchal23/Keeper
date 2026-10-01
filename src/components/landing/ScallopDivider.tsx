"use client";

import React from "react";

interface ScallopDividerProps {
  fillColor: string;
  position?: "top" | "bottom";
  className?: string;
  height?: number;
}

export function ScallopDivider({
  fillColor,
  position = "bottom",
  className = "",
  height = 36,
}: ScallopDividerProps) {
  const patternId = React.useId().replace(/:/g, "-");
  const isTop = position === "top";

  return (
    <div
      className={`w-full overflow-hidden leading-none select-none pointer-events-none ${className}`}
      style={{ height: `${height}px` }}
      aria-hidden="true"
    >
      <svg
        className="w-full h-full block"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="none"
        viewBox="0 0 1200 36"
      >
        <defs>
          <pattern
            id={`scallop-${patternId}`}
            x="0"
            y="0"
            width="48"
            height="36"
            patternUnits="userSpaceOnUse"
          >
            {isTop ? (
              // Scallops curving upwards into the previous section
              <path
                d="M 0,36 C 12,0 36,0 48,36 Z"
                fill={fillColor}
              />
            ) : (
              // Scallops curving downwards into the next section
              <path
                d="M 0,0 C 12,36 36,36 48,0 Z"
                fill={fillColor}
              />
            )}
          </pattern>
        </defs>
        <rect
          width="100%"
          height="36"
          fill={`url(#scallop-${patternId})`}
        />
      </svg>
    </div>
  );
}
