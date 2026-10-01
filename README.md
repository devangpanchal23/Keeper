# Recall — AI-Powered Universal Bookmark & Knowledge Platform

> **"Save anything. Understand it with AI. Find it anytime."**

An original, pre-production SaaS prototype for an AI-powered universal bookmark and personal knowledge platform. Inspired by modern knowledge apps like Albo, Notion, and Raindrop, with a custom design system, dark/light theme, simulated AI analysis, and client-side persistence.

---

## Key Features

1. **Universal Link Ingestion & Simulated AI Pipeline**:
   - Paste links from YouTube, YouTube Shorts, Instagram Reels/Posts, Reddit, LinkedIn, X (Twitter), TikTok, Pinterest, Medium, Dev.to, Substack, GitHub, or any website.
   - Animated multi-step processing:
     1. Analyzing Link
     2. Detecting Platform
     3. Fetching Metadata (Creator, domain, duration, read time, thumbnail)
     4. Generating Multi-tier AI Summary (Quick, Standard, Detailed)
     5. Creating AI Tags & Topics
     6. Suggesting Matching Collection
     7. Ready to Save with Live Editing
   - **Duplicate URL Detection**: Automatically detects already saved links and displays direct links to the existing bookmark instead of creating clutter.

2. **30+ Curated Seed Bookmarks**:
   - Seeded with 33 realistic saves spanning:
     - **Programming**: React 19 compiler, Next.js App Router caching, CSS Subgrid, Git autosquash, Zustand vs Redux.
     - **AI & Automation**: Andrej Karpathy on multi-agent architectures, LangChain + Next.js streaming.
     - **Business Ideas & SaaS**: Bootstrapped $12k MRR invoice tool post-mortem, solo founder tech stack.
     - **UI/UX Inspiration**: Framer Motion magnetic button glow, screen typography hierarchy, AI interface patterns.
     - **Health & Fitness**: Andrew Huberman sleep & light protocol, morning spinal mobility.
     - **Healthy Recipes**: 15-min spicy garlic salmon bowl (52g protein), Turkish eggs Cilbir.
     - **Travel & Gear**: 14-day Japan itinerary & ryokans, ultralight 28L one-bag packing guide.
     - **Photography**: Sean Tucker street lighting rules, moody green Lightroom mobile preset.
     - **Productivity & Mindset**: Naval Ravikant wealth without luck, Cal Newport slow productivity, Raycast developer workflows.

3. **AI Search & Knowledge Assistant (`/app/ai-assistant`)**:
   - Natural language question answering grounded in your library.
   - Example queries:
     - *"Find everything I saved about React performance."*
     - *"What have I saved about React?"*
     - *"How to build production multi-agent systems?"*
     - *"High-protein quick dinner recipes"*
     - *"Japan 14-day itinerary and packing guide"*
   - Returns synthesized AI answers, key takeaways, and **interactive cited source cards** that link directly to saved items.

4. **Multi-Mode Item Details (`/app/item/[id]`)**:
   - Large hero preview banner with platform and content badges.
   - Interactive 3-mode AI summary switcher:
     - **Quick**: 1-sentence TL;DR
     - **Standard**: Contextual paragraph
     - **Detailed**: Step-by-step breakdown
   - Bulleted Key Takeaways with status checkmarks.
   - Personal Markdown notes with instant auto-save.
   - Raw source metadata (duration, read time, views, likes).
   - Dynamic related saves matched by topic and tags.

5. **Library Management & Powerful Search (`/app/library` & `/app/search`)**:
   - Weighted search across title (10x), tags (8x), topics (7x), AI summary (5x), creator (5x), notes (4x), and URL.
   - Multi-filter controls: Platform, Content Type, Collection, Tag, Date, and Favorites.
   - Grid, List, and Compact view modes.
   - Command Palette (**CMD+K** or **CTRL+K**) for instant spotlight search and navigation.
   - Quick Add shortcut (**CMD+N**).

6. **Workspace Organization**:
   - Collections gallery (`/app/collections`) and detail views (`/app/collections/[id]`) with custom color palettes.
   - Favorites (`/app/favorites`) and Recent Activity (`/app/recent`).
   - Archive (`/app/archive`) with 1-click restore.
   - Trash (`/app/trash`) with restore and "Empty Trash" purge.
   - Settings (`/app/settings`) with theme switcher (Dark / Light / System), default AI summary mode, simulated model switcher (Recall Flash, Pro, Claude 3.5 Sonnet, GPT-4o), JSON export/backup, and **Reset Demo Data** button.

---

## Architecture & Modular Services

The codebase strictly decouples business logic from presentation components:

```
src/
├── types/
│   └── index.ts                 # TypeScript models: User, SavedItem, Collection, Tag, AISummary, etc.
├── services/
│   ├── storage-service.ts       # LocalStorage sync, JSON export/import, default resets
│   ├── provider-service.ts      # Domain detection & mock metadata extractors for YouTube, IG, Reddit, X, etc.
│   ├── ai-service.ts            # Simulated AI summaries, key takeaways, semantic search & assistant chat
│   ├── search-service.ts        # Weighted multi-field ranking and filtering engine
│   ├── collection-service.ts    # Collection CRUD and dynamic item counts
│   └── content-service.ts       # Bookmark CRUD, duplicate checking, notes, favorites, archiving, trash
├── context/
│   └── RecallContext.tsx        # Global reactive state, keyboard shortcuts, modal controls, toasts
├── data/
│   └── seed-data.ts             # 33 comprehensive seed bookmarks across 10 collections
├── components/
│   ├── cards/
│   │   ├── SaveItemCard.tsx     # Rich grid card with thumbnail, AI snippet, and dropdown actions
│   │   └── SaveItemListRow.tsx  # Sleek horizontal list row
│   ├── layout/
│   │   ├── Header.tsx           # Global search trigger, + Add Content, notifications, theme, profile
│   │   ├── Sidebar.tsx          # Nav links, collapsible collections drawer, storage badge
│   │   ├── MobileNav.tsx        # Responsive bottom bar for mobile screens
│   │   └── AppShell.tsx         # Layout wrapper
│   ├── modals/
│   │   ├── AddContentModal.tsx  # Universal save flow with animated pipeline & duplicate detection
│   │   ├── CommandPalette.tsx   # CMD+K spotlight modal
│   │   ├── CollectionModal.tsx  # Create/edit collection with color picker
│   │   └── QuickNoteModal.tsx   # Fast personal note editor
│   └── common/
│       ├── FilterBar.tsx        # Search input, dropdown filters, view switcher
│       ├── PlatformBadge.tsx    # Styled badges with brand icons & colors
│       ├── ContentTypeBadge.tsx # Video, Short, Reel, Article, Post, Product, etc.
│       ├── ToastContainer.tsx   # Floating animated alerts
│       ├── SkeletonGrid.tsx     # Skeleton cards for loading states
│       └── EmptyState.tsx       # Contextual empty state illustrations
└── app/
    ├── page.tsx                 # Landing Page with live hero URL analyzer & feature tabs
    ├── login/page.tsx           # Login with 1-click Demo fast access
    ├── signup/page.tsx          # Signup with 1-click Demo fast access
    ├── app/
    │   ├── page.tsx             # Dashboard overview with stats, AI highlights, recent saves
    │   ├── library/page.tsx     # All Saves library with FilterBar & view switching
    │   ├── collections/         # Collections gallery & detail views
    │   ├── favorites/           # Starred items
    │   ├── recent/              # Recently saved & recently viewed
    │   ├── search/              # Weighted global search
    │   ├── ai-assistant/        # Conversational AI assistant with cited source cards
    │   ├── item/[id]/           # Full item detail view with 3 summary modes & notes
    │   ├── archive/             # Archived items
    │   ├── trash/               # Trash with restore & permanent delete
    │   └── settings/            # Theme, AI model selector, JSON export, reset demo data
    └── globals.css              # Dark/light theme custom CSS variables, glassmorphism, glowing accents
```

---

## Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run the development server**:
   ```bash
   npm run dev
   ```

3. **Open the application**:
   - Landing Page: [http://localhost:3000](http://localhost:3000)
   - Main Workspace Dashboard: [http://localhost:3000/app](http://localhost:3000/app)
   - Library: [http://localhost:3000/app/library](http://localhost:3000/app/library)
   - AI Assistant: [http://localhost:3000/app/ai-assistant](http://localhost:3000/app/ai-assistant)

---

## Keyboard Shortcuts

- `CMD + K` or `CTRL + K`: Open Command Palette / Spotlight search from anywhere
- `CMD + N` or `CTRL + N`: Open Universal **+ Add Content** modal
- `ESC`: Close open modals or palette

---

## Krackerz-Inspired Homepage Redesign & 60:30:10 Architecture

The public homepage has been rebuilt in the visual style of [krackerz.com](https://krackerz.com/) (scalloped edges, die-cut sticker labels, ticket cards, folder-tab stacking, playful display typography), fixing all reference design flaws and enforcing an award-grade visual hierarchy:

### 1. Permanent Color System (60:30:10 Rules)
- **60% Dominant Neutral**:
  - `--cream` (`#F7F5EE`): Primary canvas, card backings, and pill backgrounds.
  - `--white` (`#FFFFFF`): Card backgrounds, sticker borders, photo frames.
  - `--ink` (`#111111`): All body typography, headings, outlines, and tactile borders.
  - `--grid-dot` (`#D3D0C5`): Subtle tactile background grid.
- **30% Secondary Brand (MAX 3 Shades)**:
  - `--oxblood` (`#4E0F15`): Deep hero cloud, pricing highlights, dark overlays, and footer.
  - `--maroon` (`#7A1710`): Feature panel progression and architectural telemetry.
  - `--brick` (`#C4271B`): The ONE brand red: problem tickets, stat cards, checkmark badges.
- **10% Regulated Accent**:
  - `--lime` (`#C6FF2E`): Reserved exclusively for the single primary CTA per viewport and max ONE black sticker label per section.

### 2. Hard Lime Budget Verification
1. **Lime Area**: $\le$ 10% in any single viewport frame, $\le$ 6% page-wide.
2. **Lime Fill**: Reserved for exactly ONE primary CTA per viewport (Hero CTA and Final CTA only). Mid-page CTAs use secondary ink (`bg-[#111111] text-[#F7F5EE]`) or secondary cream.
3. **Lime Text**: Max ONE black sticker label (`bg-[#111111] text-[#C6FF2E]`) per section.
4. **All other accents neutralized**: Toggles use oxblood; FAQ plus icons use brick/ink; corner badges use cream or white with ink borders; checkmarks use brick.

### 3. Product Dashboard Integration (`/app`)
- Centralized via `ROUTES.dashboard = "/app"` in [src/config/routes.ts](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/config/routes.ts).
- Integrated as a secondary button in the floating nav, full-screen mobile menu drawer, sticky mobile quick bar, pricing tier, 404 page, and footer.
- Keyboard accessible with visible focus-visible rings and prefetch on hover.

### 4. Interactive Spline 3D Hero Scene
- Built into [SplineHero.tsx](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/components/landing/SplineHero.tsx) using dynamic lazy loading (`ssr: false`).
- Configured via environment variable: `NEXT_PUBLIC_SPLINE_HERO_URL`.
- Defaults to a zero-bundle, high-performance CSS 3D interactive badge with mouse tilt physics when no URL is provided.
- Pauses rendering when offscreen via `IntersectionObserver` and respects `prefers-reduced-motion`.

### 5. Automated Design Audit & CI Verification
Run the automated palette and design audit locally:
```bash
npm run audit:design
```
- Walks component trees and verifies 60:30:10 ratios, max frame accent limits, and forbids any unapproved raw hex codes.
- Automatically enforced on every Pull Request and Push via `.github/workflows/design-audit.yml`.

### 6. Interactive Styleguide
Visit the live styleguide at `/styleguide`:
- Live 60:30:10 allocation meter.
- WCAG AA contrast matrix.
- Interactive token swatches and component hierarchy.
