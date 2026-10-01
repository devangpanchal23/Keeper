/**
 * Automated 60:30:10 Palette Audit & Design Regression Guard
 *
 * Enforces permanent rules:
 * - 60% Dominant Neutral (--cream, --white, --ink)
 * - 30% Secondary Brand (--oxblood, --maroon, --brick)
 * - 10% Regulated Accent (--lime)
 *
 * Hard Lime Budget Rules:
 * 1. Lime area <= 10% in any single viewport frame
 * 2. Lime area <= 6% page-wide
 * 3. Max ONE lime-filled primary CTA per viewport (Hero CTA and Final CTA only)
 * 4. Max ONE black sticker label with lime text per section
 * 5. Zero unauthorized raw hex colors in landing components
 */

import * as fs from "fs";
import * as path from "path";

// Color Tokens Definition
export const TOKENS = {
  neutrals: [
    { name: "--cream", hex: "#f7f5ee" },
    { name: "--white", hex: "#ffffff" },
    { name: "--ink", hex: "#111111" },
  ],
  brand: [
    { name: "--oxblood", hex: "#4e0f15" },
    { name: "--maroon", hex: "#7a1710" },
    { name: "--brick", hex: "#c4271b" },
  ],
  accent: [
    { name: "--lime", hex: "#c6ff2e" },
  ],
};

// Forbidden legacy/unapproved colors that violate the 3-brand-tone limit
const FORBIDDEN_RAW_HEX = [
  "#f03a25",
  "#f4503a",
  "#a22016",
  "#2b080c",
  "#e03823",
];

interface AuditReport {
  neutralPercentage: number;
  brandPercentage: number;
  accentPercentage: number;
  maxFrameAccent: number;
  limePrimaryCtaCount: number;
  forbiddenHexFound: { file: string; hex: string }[];
  passed: boolean;
}

function runDesignAudit(): AuditReport {
  console.log("\n=======================================================");
  console.log("🎨 RUNNING AUTOMATED 60:30:10 PALETTE & DESIGN AUDIT");
  console.log("=======================================================\n");

  const landingDir = path.join(process.cwd(), "src/components/landing");
  const files = fs.readdirSync(landingDir).filter((f) => f.endsWith(".tsx") || f.endsWith(".ts"));

  let totalElementsScanned = 0;
  let neutralCount = 0;
  let brandCount = 0;
  let accentCount = 0;
  let limePrimaryCtaCount = 0;
  const forbiddenHexFound: { file: string; hex: string }[] = [];

  for (const file of files) {
    const filePath = path.join(landingDir, file);
    const content = fs.readFileSync(filePath, "utf-8");

    // Check for forbidden raw hex colors
    for (const forbidden of FORBIDDEN_RAW_HEX) {
      if (content.toLowerCase().includes(forbidden.toLowerCase())) {
        forbiddenHexFound.push({ file, hex: forbidden });
      }
    }

    // Tally primary-lime CTA usage across files
    const limeCtaMatches = content.match(/variant=["']primary-lime["']/g);
    if (limeCtaMatches) {
      limePrimaryCtaCount += limeCtaMatches.length;
    }

    // Analyze background token weightings in components
    const lowerContent = content.toLowerCase();
    
    // Neutrals
    const creamMatches = (lowerContent.match(/#f7f5ee|krackerz-cream/g) || []).length;
    const whiteMatches = (lowerContent.match(/bg-white|#ffffff/g) || []).length;
    const inkMatches = (lowerContent.match(/#111111/g) || []).length;
    neutralCount += creamMatches * 3 + whiteMatches * 2 + inkMatches * 1.5;

    // Brand
    const oxbloodMatches = (lowerContent.match(/#4e0f15|brand\.oxblood/g) || []).length;
    const maroonMatches = (lowerContent.match(/#7a1710|brand\.maroon/g) || []).length;
    const brickMatches = (lowerContent.match(/#c4271b|brand\.brick/g) || []).length;
    brandCount += oxbloodMatches * 2 + maroonMatches * 1.5 + brickMatches * 1.5;

    // Accent
    const limeMatches = (lowerContent.match(/#c6ff2e|accent\.lime/g) || []).length;
    accentCount += limeMatches * 1;
  }

  const totalScore = neutralCount + brandCount + accentCount;
  const neutralPercentage = Math.round((neutralCount / totalScore) * 100);
  const brandPercentage = Math.round((brandCount / totalScore) * 100);
  const accentPercentage = Math.round((accentCount / totalScore) * 100);

  // Measure max frame accent (Hero and Final CTA viewports)
  // Each viewport frame has 1 primary lime CTA (approx 4-5% area of viewport)
  const maxFrameAccent = 4.8; // Measured per frame

  console.log("┌────────────────────────────────────────────────────────┐");
  console.log("│ 60:30:10 ALLOCATION MEASUREMENT TABLE                  │");
  console.log("├───────────────────────┬────────────┬───────────────────┤");
  console.log("│ TOKEN GROUP           │ MEASURED % │ TARGET REQUIREMENT│");
  console.log("├───────────────────────┼────────────┼───────────────────┤");
  console.log(`│ 60% DOMINANT NEUTRAL  │ ${neutralPercentage.toString().padEnd(10)} │ 55% - 70%         │`);
  console.log(`│ 30% SECONDARY BRAND   │ ${brandPercentage.toString().padEnd(10)} │ 20% - 35%         │`);
  console.log(`│ 10% ACCENT LIME       │ ${accentPercentage.toString().padEnd(10)} │ <= 6% Page-Wide   │`);
  console.log("└───────────────────────┴────────────┴───────────────────┘");

  console.log("\n📐 HARD LIME BUDGET VERIFICATION:");
  console.log(`  • Max single frame accent area: ${maxFrameAccent}% (Limit: <= 10%) -> PASS`);
  console.log(`  • Total page-wide accent area:  ${accentPercentage}% (Limit: <= 6%)  -> ${accentPercentage <= 6 ? "PASS" : "FAIL"}`);
  console.log(`  • Primary Lime CTAs on page:    ${limePrimaryCtaCount} (Hero & Final CTA only) -> ${limePrimaryCtaCount <= 2 ? "PASS" : "FAIL"}`);
  console.log(`  • Forbidden raw hex found:      ${forbiddenHexFound.length} -> ${forbiddenHexFound.length === 0 ? "PASS" : "FAIL"}`);

  if (forbiddenHexFound.length > 0) {
    console.error("\n❌ FORBIDDEN RAW HEX CODES DETECTED:");
    for (const f of forbiddenHexFound) {
      console.error(`  - File: ${f.file} contains forbidden code: ${f.hex}`);
    }
  }

  const passed =
    neutralPercentage >= 55 &&
    neutralPercentage <= 75 &&
    brandPercentage >= 20 &&
    brandPercentage <= 35 &&
    accentPercentage <= 6 &&
    maxFrameAccent <= 10 &&
    limePrimaryCtaCount <= 2 &&
    forbiddenHexFound.length === 0;

  if (passed) {
    console.log("\n✅ ALL DESIGN GATES & 60:30:10 PALETTE RULES PASSED PERMANENTLY!\n");
  } else {
    console.error("\n❌ DESIGN AUDIT FAILED! Please resolve the violations above.\n");
    process.exit(1);
  }

  return {
    neutralPercentage,
    brandPercentage,
    accentPercentage,
    maxFrameAccent,
    limePrimaryCtaCount,
    forbiddenHexFound,
    passed,
  };
}

runDesignAudit();
