"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, Menu, X } from "lucide-react";
import { useRecall } from "@/context/RecallContext";
import { ROUTES } from "@/config/routes";

export function KrackerzNav() {
  const { openAddContent, user } = useRecall();
  const [isScrolled, setIsScrolled] = useState(false);
  const [navVisible, setNavVisible] = useState(true);
  const [activeSection, setActiveSection] = useState<string>("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const progressBarRef = React.useRef<HTMLDivElement>(null);
  const lastScrollYRef = React.useRef(0);
  const isScrolledRef = React.useRef(false);
  const navVisibleRef = React.useRef(true);
  const activeSectionRef = React.useRef("");

  // Ultra-high performance scroll listener (0 forced reflows, RAF throttled, no listener re-binding)
  useEffect(() => {
    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY;
          const docHeight = document.documentElement.scrollHeight - window.innerHeight;
          const progress = docHeight > 0 ? Math.min(1, Math.max(0, currentScrollY / docHeight)) : 0;

          // 1. Update 2px progress bar directly without React re-render
          if (progressBarRef.current) {
            progressBarRef.current.style.transform = `scaleX(${progress})`;
          }

          // 2. Only update isScrolled when boolean actually flips
          const newIsScrolled = currentScrollY > 20;
          if (newIsScrolled !== isScrolledRef.current) {
            isScrolledRef.current = newIsScrolled;
            setIsScrolled(newIsScrolled);
          }

          // 3. Hide on scroll down, show on scroll up (only when boolean flips)
          let newNavVisible = navVisibleRef.current;
          if (currentScrollY > 120) {
            const diff = currentScrollY - lastScrollYRef.current;
            if (diff > 8) {
              newNavVisible = false;
            } else if (diff < -8) {
              newNavVisible = true;
            }
          } else {
            newNavVisible = true;
          }

          if (newNavVisible !== navVisibleRef.current) {
            navVisibleRef.current = newNavVisible;
            setNavVisible(newNavVisible);
          }
          lastScrollYRef.current = currentScrollY;

          // 4. Lightweight scrollspy using offsetTop (avoids forced layout reflow of getBoundingClientRect)
          const sections = ["features", "pricing", "partners", "faq", "stickers"];
          let foundSection = "";
          for (const sectionId of sections) {
            const el = document.getElementById(sectionId);
            if (el) {
              const top = el.offsetTop - 250;
              const bottom = top + el.offsetHeight;
              if (currentScrollY >= top && currentScrollY < bottom) {
                foundSection = sectionId;
                break;
              }
            }
          }
          if (foundSection !== activeSectionRef.current) {
            activeSectionRef.current = foundSection;
            setActiveSection(foundSection);
          }

          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "FEATURES", id: "features", href: "#features" },
    { label: "PRICING", id: "pricing", href: "#pricing" },
    { label: "PARTNERS", id: "partners", href: "#partners" },
    { label: "FAQ", id: "faq", href: "#faq" },
    { label: "STICKER LAB", id: "stickers", href: "#stickers" },
  ];

  return (
    <>
      {/* 2px Oxblood Scroll Progress Bar at very top of screen */}
      <div
        ref={progressBarRef}
        className="fixed top-0 left-0 right-0 h-[2px] bg-[#4E0F15] z-[60] origin-left will-change-transform"
        style={{ transform: "scaleX(0)" }}
        aria-hidden="true"
      />

      {/* Floating Header */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          navVisible ? "translate-y-0" : "-translate-y-full"
        } ${isScrolled ? "py-2 sm:py-2.5" : "py-4 sm:py-5"}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Main Floating Nav Pill Bar */}
          <div className="flex items-center justify-between rounded-full bg-[#F7F5EE]/95 backdrop-blur-md border border-[#111111] shadow-[0_4px_12px_rgba(17,17,17,0.08)] px-3 sm:px-4 py-2">
            {/* Logo inside the bar */}
            <Link href={ROUTES.home} className="group flex items-center gap-2 select-none shrink-0 pr-2">
              <div className="w-8 h-8 rounded-lg bg-[#111111] flex items-center justify-center text-[#C6FF2E] font-krackerz-display text-base shadow-[0_2px_0_#C4271B] transition-transform duration-200 group-hover:-translate-y-0.5">
                R
              </div>
              <div className="flex items-center">
                <span className="font-krackerz-display text-lg sm:text-2xl text-[#111111] tracking-tight uppercase">
                  RECALL
                </span>
                <span className="text-[#C4271B] font-krackerz-display text-lg sm:text-2xl animate-pulse ml-0.5">
                  ✱
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links with Scrollspy */}
            <nav className="hidden lg:flex items-center gap-5 text-xs font-krackerz-display tracking-wider text-[#111111]">
              {navLinks.map((link) => {
                const isActive = activeSection === link.id;
                return (
                  <a
                    key={link.label}
                    href={link.href}
                    className={`relative py-1 transition-colors duration-150 ${
                      isActive ? "text-[#C4271B]" : "hover:text-[#C4271B]"
                    }`}
                  >
                    {link.label}
                    {isActive && (
                      <span className="absolute -bottom-1 left-0 right-0 h-[2px] bg-[#C4271B] rounded-full" />
                    )}
                  </a>
                );
              })}
            </nav>

            {/* Right CTAs Cluster */}
            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Product Dashboard Button -> /app (Secondary: ink border, cream fill, ink text, NOT lime) */}
              <Link
                href={ROUTES.dashboard}
                prefetch
                aria-label="Go to product dashboard"
                className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-2 rounded-full bg-[#F7F5EE] text-[#111111] border border-[#111111] font-krackerz-display text-xs uppercase tracking-wide shadow-[0_2px_0_#111111] hover:shadow-[0_3px_0_#111111] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4271B] transition-all"
              >
                <span className="whitespace-nowrap">
                  {user?.name ? (
                    <>
                      <span className="hidden sm:inline">Open </span>Dashboard
                    </>
                  ) : (
                    "Dashboard"
                  )}
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5] shrink-0" />
              </Link>

              {/* Primary Waitlist / Ingestion CTA (Lime fill, single primary CTA of viewport) */}
              <button
                type="button"
                onClick={() => openAddContent()}
                className="group hidden sm:inline-flex items-center gap-2 bg-[#C6FF2E] text-[#111111] font-krackerz-display text-xs uppercase px-4 sm:px-5 py-2 rounded-full border border-[#111111] shadow-[0_2px_0_#111111] hover:shadow-[0_3px_0_#111111] hover:-translate-y-0.5 active:translate-y-0.5 active:shadow-none transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4271B]"
              >
                <span>INGEST LINK</span>
                <span className="w-4 h-4 rounded-full bg-[#C4271B] text-white flex items-center justify-center transition-transform group-hover:translate-x-0.5">
                  <ArrowRight className="w-2.5 h-2.5 stroke-[2.5]" />
                </span>
              </button>

              {/* Mobile Hamburger Button */}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden w-9 h-9 rounded-full bg-white border border-[#111111] shadow-[0_2px_0_#111111] flex items-center justify-center text-[#111111]"
                aria-label="Toggle navigation menu"
              >
                {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Full-Screen Menu Drawer */}
        {mobileMenuOpen && (
          <div className="lg:hidden px-4 pt-2 pb-4 max-w-7xl mx-auto">
            <div className="bg-[#F7F5EE] border-2 border-[#111111] rounded-3xl p-6 shadow-[0_8px_0_#111111] space-y-5">
              <nav className="flex flex-col space-y-3 font-krackerz-display text-base text-[#111111]">
                {navLinks.map((link) => (
                  <a
                    key={link.label}
                    href={link.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className="py-1 hover:text-[#C4271B] transition-colors"
                  >
                    {link.label}
                  </a>
                ))}
              </nav>

              {/* Pinned Action Buttons */}
              <div className="pt-4 border-t border-[#111111]/20 flex flex-col gap-3">
                {/* Secondary Dashboard Button */}
                <Link
                  href={ROUTES.dashboard}
                  prefetch
                  onClick={() => setMobileMenuOpen(false)}
                  aria-label="Go to product dashboard"
                  className="w-full flex items-center justify-center gap-2 bg-[#F7F5EE] text-[#111111] font-krackerz-display text-xs py-3 rounded-full border-2 border-[#111111] shadow-[0_3px_0_#111111]"
                >
                  <span>{user?.name ? "Open Dashboard" : "Dashboard"}</span>
                  <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                </Link>

                {/* Primary Action Button */}
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    openAddContent();
                  }}
                  className="w-full flex items-center justify-center gap-2 bg-[#C6FF2E] text-[#111111] font-krackerz-display text-xs py-3.5 rounded-full border-2 border-[#111111] shadow-[0_3px_0_#111111]"
                >
                  <span>INGEST URL NOW</span>
                  <ArrowRight className="w-3.5 h-3.5 stroke-[2.5]" />
                </button>
              </div>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
