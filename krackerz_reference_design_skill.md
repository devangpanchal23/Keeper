# Krackerz-Inspired Motion & UI Recreation Skill

## Purpose

Use this skill when redesigning an existing website so its **interaction
quality, motion language, editorial composition, pacing, and visual
energy** closely match the reference experience at
`https://krackerz.com/`, while keeping the target project's own brand,
copy, assets, data, routes, and functionality.

This is a reverse-engineered implementation guide based on observable
public behavior and structure. Do **not** copy proprietary source code,
branding, written content, logos, illustrations, photographs, or other
protected assets from the reference. Recreate the design system and
interaction principles with original implementation and project-owned
assets.

------------------------------------------------------------------------

## 1. Reference Snapshot

Reference: Krackerz --- sales/career course for designers.

Observed public page structure:

1.  Header/navigation
2.  Large editorial hero
3.  Repeating/moving career-goal cards or visual items
4.  "Design School" problem/positioning section
5.  Core Features
6.  Scenario Based Learning feature
7.  Win Work Prep feature
8.  Community feature
9.  Social-proof/testimonial area
10. Founder/profile section
11. Awards/experience presentation
12. Pricing
13. Partner section
14. FAQ
15. Interactive sticker/laptop area
16. Final CTA
17. Footer

The experience is not a conventional SaaS landing page. It behaves more
like an **interactive editorial portfolio / creative campaign site**.

------------------------------------------------------------------------

# 2. Core Design Direction

The target site should feel:

-   Editorial rather than template-based
-   Bold and art-directed
-   Playful without becoming childish
-   High-contrast
-   Intentionally imperfect/asymmetric
-   Motion-led
-   Scroll-responsive
-   Image-rich
-   Typographically expressive
-   Dense in selected areas and spacious in others
-   Built around oversized statements rather than generic cards
-   Human-designed rather than "AI landing page" styled

Avoid the usual generated-site patterns:

-   Generic gradient hero
-   Centered heading + paragraph + two buttons
-   Repeated glassmorphism cards
-   Excessive rounded rectangles
-   Purple/blue AI gradients
-   Identical three-column feature grids
-   Excessive icon badges
-   Uniform spacing everywhere
-   Every section using the same container/card treatment

------------------------------------------------------------------------

# 3. Layout System

## Desktop

Use a fluid editorial canvas.

Recommended content width:

``` css
--page-padding: clamp(20px, 3vw, 56px);
--content-max: 1600px;
```

Prefer:

-   Full-bleed sections where visual impact is important
-   Constrained inner wrappers for readable copy
-   Deliberate overlaps
-   Large vertical transitions between narrative chapters
-   Occasional horizontal overflow for marquees/carousels
-   Alternating composition instead of repetitive section templates

Do not make every section `max-width: 1200px; margin: auto`.

Some sections should intentionally occupy nearly the entire viewport.

## Mobile

Do not merely shrink desktop.

Recompose:

-   Reduce simultaneous visual elements
-   Stack editorial compositions intentionally
-   Preserve oversized typography where possible
-   Convert horizontal feature arrangements into swipe/stack experiences
-   Remove decorative motion that hurts readability
-   Keep touch targets \>= 44px
-   Prevent horizontal page overflow unless the section deliberately
    owns horizontal scrolling

------------------------------------------------------------------------

# 4. Typography Language

The reference uses typography as a primary graphic element.

Recreate these principles:

-   Very large display headlines
-   Strong uppercase usage
-   Mixed-case emphasis inside headlines
-   Tight headline leading
-   Strong contrast between display and supporting copy
-   Small uppercase eyebrow labels
-   Large words functioning as visual objects
-   Occasional expanded letter spacing for decorative microcopy

Recommended system:

``` css
--font-display: "Your Project Display Font", sans-serif;
--font-body: "Your Project Body Font", sans-serif;

--display-xl: clamp(4rem, 10vw, 10rem);
--display-lg: clamp(3rem, 7vw, 7rem);
--display-md: clamp(2.5rem, 5vw, 5rem);
--body-lg: clamp(1.05rem, 1.4vw, 1.4rem);
--body-md: 1rem;
--eyebrow: 0.75rem;
```

Headline characteristics:

``` css
.hero-title {
  font-size: var(--display-xl);
  line-height: 0.82;
  letter-spacing: -0.055em;
  text-transform: uppercase;
}
```

Do not copy the reference font without proper licensing. Match its
**character** with a legally available project font.

------------------------------------------------------------------------

# 5. Color Strategy

The reference experience relies more on art direction and contrast than
on generic gradients.

Use the target project's palette, but organize it into:

-   Main background
-   Main foreground
-   One strong accent
-   One secondary accent
-   Optional warm/off-white surface
-   Optional dark/inverted section

Example token structure:

``` css
:root {
  --bg: #...;
  --fg: #...;
  --surface: #...;
  --accent: #...;
  --accent-2: #...;
  --border: color-mix(in srgb, var(--fg) 18%, transparent);
}
```

Rules:

-   Prefer flat, confident color fields.
-   Use gradients only if the target brand genuinely needs them.
-   Alternate light/dark or accent sections to create chapter breaks.
-   Do not make every component use a separate color.

------------------------------------------------------------------------

# 6. Smooth Scrolling

The site should have premium inertial-feeling scrolling without making
navigation sluggish.

Preferred implementation hierarchy:

1.  Use the project's existing smooth-scroll solution if present.
2.  If none exists and dependencies are allowed, use a lightweight
    smooth-scroll library such as Lenis.
3.  If no dependency should be added, use native scrolling plus
    scroll-linked animation.

Native baseline:

``` css
html {
  scroll-behavior: smooth;
}
```

For a Lenis-style implementation:

-   Keep wheel/touch input responsive.
-   Avoid extreme lerp values.
-   Do not create a large delay between input and viewport movement.
-   Synchronize animation updates with `requestAnimationFrame`.
-   Integrate with the animation library's ticker if GSAP is already
    present.

Target feel:

-   Smooth
-   Slightly damped
-   No rubber-band fake physics
-   No delayed clicks
-   No scroll hijacking

Respect:

``` css
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
}
```

When reduced motion is enabled, disable non-essential scroll
interpolation and large transforms.

------------------------------------------------------------------------

# 7. Global Motion Language

Motion should feel **physical, editorial, and intentional**.

Use several motion families rather than one repeated fade-up.

## A. Masked text reveals

For major headings:

-   Wrap line/word in an overflow-hidden container.
-   Animate child from approximately `y: 105%` to `y: 0`.
-   Optional 1--2 degree rotation.
-   Stagger lines/words.
-   Use strong ease-out timing.

Suggested timing:

``` text
duration: 0.7–1.1s
ease: cubic-bezier(0.16, 1, 0.3, 1)
stagger: 40–100ms
```

## B. Image reveals

Possible treatments:

-   Clip-path reveal
-   Mask wipe
-   Scale from \~1.08 to 1
-   Translate + scale
-   Container reveal while image counter-moves

Do not animate every image identically.

## C. Scroll parallax

Use restrained differential movement:

-   Background image: slower than page
-   Foreground sticker/card: slightly faster
-   Headline: small translate shift
-   Decorative item: optional rotation

Typical transform range:

``` text
20–120px desktop
10–50px mobile
```

Avoid huge parallax distances that detach content from layout.

## D. Rotation

Use small scroll-driven rotation for playful objects:

``` text
-6deg → 4deg
or
4deg → -3deg
```

Avoid rotating body copy.

## E. Scale

Use subtle scale transitions:

``` text
0.94 → 1
1 → 1.04
```

Reserve dramatic scaling for hero transitions.

------------------------------------------------------------------------

# 8. Hero Experience

The hero should immediately establish an art-directed identity.

Reference characteristics:

-   Small positioning statement
-   Huge multi-line headline
-   Strong line breaks
-   Visual/media element
-   Primary CTA
-   Motion visible immediately
-   Layered composition rather than a generic split hero

Implementation guidance:

``` text
Viewport:
  Header
  Small eyebrow
  Oversized headline
  CTA
  Editorial visual layer
  Moving/rotating supporting elements
```

Hero headline should occupy a significant percentage of the viewport.

Animation sequence:

1.  Page enters.
2.  Header fades/reveals quickly.
3.  Eyebrow appears.
4.  Headline lines reveal with masks.
5.  CTA enters.
6.  Hero imagery settles using scale/translate.
7.  Ambient elements begin subtle movement.

Keep initial sequence around 1.2--2.0 seconds total, not a long splash
screen.

------------------------------------------------------------------------

# 9. Header / Navigation

Observed navigation categories include Features, Pricing, For partners,
FAQ, Shop, plus a prominent waitlist CTA.

For the target project:

-   Preserve the target project's real routes/anchors.
-   Use compact navigation.
-   Give the CTA stronger visual weight.
-   Consider sticky/fixed navigation only if it supports the target
    layout.
-   Animate header background/border when scrolling if needed.

Interactions:

-   Link underline/offset motion
-   Small arrow shift
-   Background fill transition on CTA
-   Text inversion or sliding-label hover

Do not overanimate navigation.

------------------------------------------------------------------------

# 10. Moving Strips / Marquee Behavior

The reference repeats short user-goal statements and visual items,
producing a campaign-like rhythm.

Implement reusable infinite strips where appropriate.

Structure:

``` html
<div class="marquee">
  <div class="marquee-track">
    <!-- group A -->
    <!-- duplicate group A for seamless loop -->
  </div>
</div>
```

Motion:

``` text
Linear
Continuous
No visible jump
20–45s depending on content width
Pause or slow on hover only if useful
```

Potential variations:

-   Text + thumbnail strip
-   Cards moving horizontally
-   Opposing-direction rows
-   Slightly rotated items

Never make the whole page a collection of marquees.

------------------------------------------------------------------------

# 11. Problem / Manifesto Sections

The reference uses bold statements such as the "Design School" chapter
as large editorial transitions.

For the target site:

-   Convert important product truths into oversized statements.
-   Use very large type.
-   Break text across lines intentionally.
-   Animate lines separately.
-   Use background changes to mark the narrative transition.

A manifesto section can use:

``` text
Small section label
Massive statement
2 supporting editorial points
Strong visual transition
```

Avoid generic "Why choose us?" card grids when a narrative treatment
would be stronger.

------------------------------------------------------------------------

# 12. Feature Section System

The reference's core feature chapter presents major categories and then
expands each into a richer visual story.

Target behavior:

-   Feature selector/tab/list
-   Large active feature title
-   Short supporting points
-   Main image/media panel
-   Decorative visual layers
-   CTA where relevant

Possible interaction:

``` text
Feature A selected
  → visual A appears
  → copy A reveals

Feature B selected
  → visual A exits
  → visual B enters
  → copy B changes
```

Use opacity + clip + transform rather than abrupt DOM swaps.

Transitions:

``` text
350–700ms
ease-out
```

Keyboard interaction must work if tabs are interactive.

------------------------------------------------------------------------

# 13. Layered Image Composition

A major part of the reference's visual identity comes from imagery used
as composition rather than ordinary rectangular cards.

Recreate using project-owned media:

-   Cropped editorial photos
-   Layered PNG/SVG decorations
-   Rotated cards
-   Foreground/background depth
-   Images partially leaving their section bounds
-   Controlled clipping
-   Paper/sticker/poster-like treatments where suitable

Example:

``` css
.visual-card {
  transform: rotate(-3deg);
  will-change: transform;
}

.visual-card:nth-child(2) {
  transform: rotate(4deg);
}
```

Do not download and reuse Krackerz imagery unless the user owns or
licenses it.

------------------------------------------------------------------------

# 14. Testimonials / Social Proof

The reference contains a "You're not alone" section with multiple
personal statements.

Recreate the interaction pattern, not the wording.

Recommended:

-   Large quote typography
-   Name/role/location metadata
-   Horizontal or vertical movement
-   One dominant quote at a time on small screens
-   Staggered positioning on desktop

Animation options:

-   Horizontal looping rail
-   Scroll-progress translate
-   Snap carousel
-   Crossfade between active statements

Avoid generic five-star testimonial cards.

------------------------------------------------------------------------

# 15. Founder / About Section

The reference transitions into a strong founder/profile chapter with a
large image, credentials, awards, and experience.

For a target website with an About/Founder/Team section:

-   Use a dominant portrait/project visual.
-   Pair it with oversized identity text.
-   Reveal metrics individually.
-   Use award/logo rails sparingly.
-   Allow image movement at a different scroll speed from copy.

Counters should only animate if the target project has real numeric
metrics.

Never invent achievements.

------------------------------------------------------------------------

# 16. Pricing

The reference contains distinct pricing options with monthly/yearly
context.

If the target project has pricing:

-   Preserve real plans/data.
-   Use bold plan naming.
-   Keep price hierarchy extremely clear.
-   Use one visually emphasized plan only when the business actually
    wants one emphasized.
-   Animate pricing switch without layout jumping.
-   Keep feature lists readable.

Motion:

``` text
Plan hover: 4–10px lift or small scale
CTA hover: fill/label transition
Toggle: spring-like indicator movement
```

Do not copy reference pricing or commercial wording.

------------------------------------------------------------------------

# 17. FAQ Interaction

Use an accessible accordion.

Behavior:

-   One or multiple open items depending on project needs.
-   Animate height smoothly.
-   Rotate/transform plus icon.
-   Keep question typography prominent.
-   Maintain keyboard accessibility.

Animation:

``` text
250–450ms
ease: cubic-bezier(0.16, 1, 0.3, 1)
```

Do not animate from hardcoded height when content is dynamic.

------------------------------------------------------------------------

# 18. Interactive "Play" Moment

The reference includes a "design your laptop" / draggable sticker
interaction.

This is important because it breaks the normal scroll narrative with a
playful direct-manipulation moment.

For the target project, create an equivalent **brand-relevant
interaction**, not necessarily stickers.

Options:

-   Drag project-related objects
-   Arrange cards
-   Move badges
-   Interactive product customization
-   Cursor-following objects
-   Small physics-like canvas

If using draggable elements:

-   Support pointer events.
-   Support touch.
-   Constrain objects to a safe region.
-   Set sensible initial positions.
-   Do not block page scrolling on mobile unless the user is actively
    dragging.
-   Provide a non-drag fallback if accessibility requires it.

------------------------------------------------------------------------

# 19. CTA Sections

Major CTAs should feel like visual chapters.

Use:

-   Huge headline
-   Short supporting line
-   One dominant action
-   Large background visual or graphic object
-   Strong contrast change

Button hover possibilities:

1.  Background sweep
2.  Inner label translates vertically
3.  Arrow translates/rotates
4.  Slight magnetic movement on desktop

Magnetic motion should be subtle:

``` text
max translation: ~4–8px
```

Disable magnetic behavior for touch devices.

------------------------------------------------------------------------

# 20. Footer

Reference footer is compact and brand-led.

For target project:

-   Preserve real legal/company information.
-   Repeat a concise brand proposition if appropriate.
-   Include required navigation/social links.
-   Avoid a massive generic sitemap unless the project needs it.
-   Give the final viewport a composed visual ending.

------------------------------------------------------------------------

# 21. Hover Effects

Use multiple hover behaviors depending on component.

## Buttons

``` text
duration: 200–350ms
background fill
text shift
arrow shift
```

## Navigation

``` text
underline grow
small vertical label movement
opacity change
```

## Images

``` text
image scale: 1 → 1.03/1.05
container remains clipped
duration: 500–900ms
```

## Cards

``` text
translateY: 0 → -4px
rotate: optional ±1deg
```

Do not make everything scale to 1.05.

------------------------------------------------------------------------

# 22. Cursor Behavior

Only use a custom cursor if the target site genuinely benefits from it.

Possible cursor states:

-   Default dot/ring
-   "View"
-   "Drag"
-   "Open"

Rules:

-   Desktop pointer devices only
-   No custom cursor on touch
-   Do not hide the native cursor until custom cursor is initialized
-   Use requestAnimationFrame
-   Avoid expensive React state updates on every pointermove

------------------------------------------------------------------------

# 23. Scroll-Triggered Animation Architecture

If the project already uses GSAP:

Use GSAP + ScrollTrigger.

Recommended patterns:

``` text
Text reveal:
start: "top 85%"
end: "top 45%"

Parallax:
scrub: true
start: "top bottom"
end: "bottom top"

Pinned storytelling:
Use only for one or two high-value sections.
```

If the project uses Framer Motion / Motion:

Use viewport-based reveals and `useScroll` / transform mapping.

If no animation library exists:

Prefer: - IntersectionObserver - CSS transitions - requestAnimationFrame
for scroll-linked transforms

Do not install three animation libraries.

------------------------------------------------------------------------

# 24. Easing Tokens

Create consistent easing.

``` css
:root {
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
  --ease-standard: cubic-bezier(0.4, 0, 0.2, 1);
}
```

Use:

-   Expo-like easing for entrances
-   Standard easing for controls
-   Linear easing for marquees
-   Scrubbed transforms for scroll-linked effects

Avoid `transition: all`.

------------------------------------------------------------------------

# 25. Animation Performance Rules

Every implementation must pass these rules:

Prefer animating:

-   transform
-   opacity
-   clip-path where necessary

Avoid continuously animating:

-   width
-   height
-   top
-   left
-   large box-shadow
-   filter blur on many large elements

Use:

``` css
will-change: transform;
```

only on elements that actually animate.

Remove it after animation where practical.

Other requirements:

-   Lazy-load below-the-fold images.
-   Use responsive images.
-   Reserve image dimensions to avoid CLS.
-   Avoid huge uncompressed media.
-   Do not attach individual scroll listeners to dozens of elements.
-   Batch DOM reads/writes.
-   Use requestAnimationFrame for pointer/scroll visual updates.

Target:

-   Smooth interaction near 60fps on modern devices
-   No obvious layout shifts
-   No animation-induced horizontal scrollbar
-   No long main-thread stalls

------------------------------------------------------------------------

# 26. Reduced Motion

Mandatory.

``` css
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Also disable:

-   Continuous marquees where possible
-   Strong parallax
-   Magnetic cursor/button behavior
-   Decorative rotation
-   Smooth-scroll interpolation

Content must remain fully usable.

------------------------------------------------------------------------

# 27. Responsive Motion

Desktop motion should not be copied blindly to mobile.

Desktop: - Layered compositions - Parallax - Pointer effects -
Horizontal movement - Larger transforms

Tablet: - Reduced transform distances - Simplified overlaps

Mobile: - Mostly reveal animations - Shorter travel distances - No
custom cursor - Minimal parallax - Touch-safe interactions - Avoid
pinned sections that trap scrolling

------------------------------------------------------------------------

# 28. Accessibility

Motion quality is irrelevant if usability breaks.

Requirements:

-   Semantic HTML
-   Correct heading hierarchy
-   Visible keyboard focus
-   Keyboard-accessible tabs/accordions
-   Alt text for meaningful images
-   Decorative images ignored by screen readers
-   Sufficient color contrast
-   Buttons must be real buttons
-   Links must be real links
-   `aria-expanded` for accordion triggers
-   No essential information communicated only through animation
-   Reduced-motion support

------------------------------------------------------------------------

# 29. Implementation Workflow for IDE Agent

When this skill is invoked, follow this sequence.

## Step 1 --- Audit existing project

Inspect:

-   Framework
-   Routing
-   Components
-   Styles
-   Fonts
-   Assets
-   Existing animation libraries
-   Existing dependencies
-   Responsive behavior
-   Current business functionality

Do not begin by replacing the project.

## Step 2 --- Build a page map

Map existing target content into the reference-inspired narrative.

Example:

``` text
Existing Hero
→ Editorial animated hero

Existing Benefits
→ Manifesto/problem chapter

Existing Features
→ Interactive core-feature storytelling

Existing Testimonials
→ Moving editorial social proof

Existing About
→ Founder/team editorial chapter

Existing Pricing
→ High-contrast pricing chapter

Existing FAQ
→ Animated accordion

Existing CTA
→ Oversized final campaign CTA
```

Never replace target content with Krackerz content.

## Step 3 --- Establish tokens

Create:

-   typography scale
-   spacing scale
-   color tokens
-   easing tokens
-   animation durations
-   page gutters
-   border rules

## Step 4 --- Build static layout first

Before advanced motion:

-   Match composition
-   Match hierarchy
-   Match section rhythm
-   Match responsive layout

## Step 5 --- Add motion progressively

Order:

1.  Page-load sequence
2.  Text reveals
3.  Section reveals
4.  Image motion
5.  Marquees
6.  Scroll-linked parallax
7.  Feature transitions
8.  Interactive/playful element
9.  Hover/micro-interactions
10. Optional cursor treatment

## Step 6 --- Optimize

Audit:

-   FPS
-   CLS
-   overflow
-   mobile scrolling
-   touch behavior
-   reduced motion
-   asset loading

## Step 7 --- Regression test

Verify all pre-existing functionality still works.

------------------------------------------------------------------------

# 30. Fidelity Checklist

The result should visually/behaviorally communicate these reference
traits:

-   [ ] Oversized editorial typography
-   [ ] Strong deliberate line breaks
-   [ ] Full-width art-directed sections
-   [ ] High visual contrast between sections
-   [ ] Smooth scrolling
-   [ ] Masked headline reveals
-   [ ] Scroll-triggered content entrances
-   [ ] Subtle image parallax
-   [ ] Controlled rotation/scale
-   [ ] Horizontal moving content where appropriate
-   [ ] Layered media compositions
-   [ ] Rich feature storytelling instead of generic cards
-   [ ] Editorial testimonial treatment
-   [ ] Strong profile/about chapter
-   [ ] Distinct pricing presentation if relevant
-   [ ] Animated accessible FAQ
-   [ ] At least one playful direct interaction where appropriate
-   [ ] Premium CTA hover behavior
-   [ ] Responsive re-composition
-   [ ] Reduced-motion fallback
-   [ ] No broken existing functionality

------------------------------------------------------------------------

# 31. Anti-Patterns

Reject an implementation if it becomes:

-   A generic SaaS template
-   A direct content clone
-   A direct asset clone
-   A collection of rounded cards
-   A glassmorphism dashboard
-   An animation showcase with poor usability
-   A site where every element fades upward
-   A site with excessive scroll-jacking
-   A desktop composition merely scaled down on mobile
-   A visually accurate page that breaks existing project functionality

------------------------------------------------------------------------

# 32. Fidelity vs. Ownership Rule

Aim for **high behavioral and compositional fidelity**, not unauthorized
duplication.

Match:

-   Motion philosophy
-   Scroll pacing
-   Editorial hierarchy
-   Density
-   Layout energy
-   Interaction patterns
-   Reveal techniques
-   Visual layering
-   Section transitions
-   Responsive principles

Do not copy:

-   Krackerz logo
-   Krackerz brand name
-   Krackerz photographs
-   Krackerz illustrations
-   Krackerz written copy
-   Krackerz pricing/content
-   Proprietary source code
-   Licensed fonts without permission

Use the target project's own content and assets.

------------------------------------------------------------------------

# 33. Reference Facts Captured During Research

The public reference currently exposes navigation for Features, Pricing,
For partners, FAQ and Shop, with a prominent waitlist action. Its page
narrative includes an oversized opening statement, repeated career-goal
items, a "Design School" positioning chapter, Core Features, Scenario
Based Learning, Win Work Prep, Community, testimonial/social-proof
content, a founder/profile section, pricing, partner content, FAQ, an
interactive laptop/sticker area, a final CTA and footer.

The reference is delivered using Framer-hosted resources, but the target
implementation does **not** need to use Framer. Recreate the experience
using the target project's existing stack wherever possible.

------------------------------------------------------------------------

# 34. Final Instruction to Coding Agent

When asked to redesign a project with this skill:

> Treat Krackerz as a motion, composition, pacing, and art-direction
> reference. First understand the existing application, then redesign
> its presentation without changing its core business logic. Preserve
> the target brand and content. Build the static visual hierarchy before
> adding motion. Recreate the reference's premium editorial feel using
> oversized typography, asymmetric compositions, layered media, smooth
> scroll, masked text reveals, scroll-linked transforms, selective
> marquees, tactile hover states, feature transitions, and one
> purposeful playful interaction. Do not default to generic AI/SaaS
> patterns. Keep animation performant, responsive, accessible, and
> reduced-motion aware. After implementation, test every existing route,
> control, form, and responsive breakpoint and permanently fix
> regressions before completion.
