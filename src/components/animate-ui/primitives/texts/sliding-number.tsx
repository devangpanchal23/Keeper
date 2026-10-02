"use client";

import { useEffect, useRef, useState } from "react";

type SlidingNumberProps = {
  value: string | number;
  className?: string;
  duration?: number;
};

/**
 * A lightweight, accessible digit roller for numeric highlights.
 * It starts moving when it enters the viewport and respects reduced motion.
 */
export function SlidingNumber({ value, className, duration = 700 }: SlidingNumberProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const [hasEntered, setHasEntered] = useState(false);
  const text = String(value);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setHasEntered(true);
          observer.disconnect();
        }
      },
      { threshold: 0.25 },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={containerRef} className={className} aria-label={text}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true" className="inline-flex items-baseline">
        {[...text].map((character, index) => {
          if (!/\d/.test(character)) {
            return <span key={`${character}-${index}`}>{character}</span>;
          }

          const digit = Number(character);
          return (
            <span key={`digit-${index}`} className="relative inline-block h-[1em] overflow-hidden align-bottom">
              <span
                className="sliding-number-digits flex flex-col will-change-transform"
                style={{
                  transform: `translateY(-${(hasEntered ? digit : 0) * 10}%)`,
                  transition: `transform ${duration}ms cubic-bezier(0.22, 1, 0.36, 1)`,
                }}
              >
                {Array.from({ length: 10 }, (_, number) => (
                  <span key={number} className="h-[1em] leading-[1em]">
                    {number}
                  </span>
                ))}
              </span>
            </span>
          );
        })}
      </span>
    </span>
  );
}
