# Keeper — Free Open-Source AI-Powered Universal Bookmark & Knowledge Platform

> **"Save anything. Understand it with AI. Find it anytime."**

An AI-powered universal bookmark and knowledge platform. Keeper combines a Next.js workspace, local library state, authenticated ingestion, durable AI processing, grounded search, and rich multi-device organization.

This branch (`open_source_keeper`) is the **Free Open-Source Edition** of Keeper. All monetization, subscription plans, payment checkout gateways, and artificial usage quotas have been removed. All features are 100% free and unlocked for self-hosting.

## Database and self-hosting choices

Keeper supports three server-side storage modes. Select one per Keeper deployment with the private environment variable `DATABASE_PROVIDER`:

| Value | Storage | Best fit | Setup |
|---|---|---|---|
| `supabase` | Supabase Postgres, PostgREST, SQL functions, and Supabase Auth | Simplest managed setup and current default | Configure a Supabase project and apply the ordered `supabase/migrations/*.sql` files. |
| `postgres` | A user-managed PostgreSQL database | Local PostgreSQL, a private server, or hosted PostgreSQL | Set `DATABASE_URL`, then apply [`database/postgres/001_keeper.sql`](database/postgres/001_keeper.sql). |
| `mongodb` | A user-managed MongoDB database | Local MongoDB replica set or MongoDB Atlas | Set `MONGODB_URI`; Keeper creates required indexes on first server connection. |

**Supabase is still the identity provider in all three modes.** Sign-in, signup, session refresh, and server-side user verification currently use Supabase Auth. When `DATABASE_PROVIDER=postgres` or `mongodb`, content, AI, usage, conversation, and billing records use the selected database, while Supabase Auth supplies the verified user/workspace ID. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or the legacy anon key) for every mode. `SUPABASE_SERVICE_ROLE_KEY` is needed only for `DATABASE_PROVIDER=supabase`.

Database selection is for a **whole Keeper installation**, not an individual account in a shared hosted Keeper service. Connection strings are server secrets and must never be placed in `NEXT_PUBLIC_*` variables. Each mode points to a separate store; changing `DATABASE_PROVIDER` does not copy or migrate existing records.

### Common configuration

```bash
cp .env.example .env.local
# Configure Supabase Auth values, then choose one database mode below.
npm ci
npm run dev
```

Use the Supabase project’s publishable/anon key for browser authentication. Keep database passwords, private keys, and service-role keys server-side. Restart the Next.js server after changing `.env.local`.

### Supabase-managed Postgres

Leave `DATABASE_PROVIDER=supabase`. Configure the Supabase URL, publishable key, and server-only service-role key. Apply the project migrations in filename order using the documented Supabase migration workflow; do not apply them to production as an exploratory check. Supabase mode uses its existing Auth integration, RLS policies, and SQL RPC functions.

### Local or hosted PostgreSQL

Set `DATABASE_PROVIDER=postgres` and `DATABASE_URL` to a private Postgres connection string. A local Docker instance can be started with:

```bash
docker run --name keeper-postgres \
  -e POSTGRES_USER=keeper \
  -e POSTGRES_PASSWORD=replace-with-a-local-password \
  -e POSTGRES_DB=keeper \
  -p 5432:5432 -d postgres:17
```

Apply Keeper’s standalone schema once, using a database owner/migration account:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f database/postgres/001_keeper.sql
```

Example local setting:

```dotenv
DATABASE_PROVIDER=postgres
DATABASE_URL=postgresql://keeper:replace-with-a-local-password@localhost:5432/keeper
DATABASE_POOL_MAX=10
```

For cloud Postgres, use the provider’s TLS connection string and its recommended pooled/direct connection endpoint. The server process needs network access to the database. Run schema changes as a migration role; use a separate restricted runtime role where your deployment supports it. The app’s API routes enforce workspace scoping, so do not expose this database directly to browsers or public networks.

### Local MongoDB or MongoDB Atlas

Set `DATABASE_PROVIDER=mongodb` and `MONGODB_URI`. Keeper creates unique and lookup indexes for media identity, import jobs, collections, transcripts, analyses, billing records, usage, and AI conversations when the first database client connects.

MongoDB transactions are required for atomic import, credit ledger, and AI job creation. **Use MongoDB Atlas or a local replica set**; a standalone `mongod` does not provide multi-document transactions. For local development, start a single-node replica set:

```bash
docker run --name keeper-mongodb -p 27017:27017 -d mongo:8 --replSet rs0 --bind_ip_all
docker exec keeper-mongodb mongosh --quiet --eval 'rs.initiate()'
```

Then configure:

```dotenv
DATABASE_PROVIDER=mongodb
MONGODB_URI=mongodb://localhost:27017/keeper?replicaSet=rs0
MONGODB_DATABASE=keeper
DATABASE_POOL_MAX=10
```

For Atlas, create a database user with access only to the Keeper database, allow network access from the Keeper server, and use the connection string supplied by Atlas (normally `mongodb+srv://...`). The URI contains credentials: store it only in `.env.local` or your deployment’s secret manager.

### Persistence scope and switching databases

The selected database backs authenticated imports, durable AI jobs and their derived data, collections synchronized for server processing, usage accounting, billing, and cloud assistant history. The main library still has a browser-local compatibility layer: notes, favorites, archive/trash state, and many collection/item edits are not yet a complete cross-device database sync. Demo and local prototype accounts also use browser storage. This is an existing architecture boundary, not a difference between PostgreSQL and MongoDB.

Keeper does not automatically move data between Supabase, PostgreSQL, and MongoDB. Before changing a deployment’s provider, export/back up the source, migrate records with a reviewed one-time migration, preserve workspace IDs and canonical URLs, and verify counts and ownership before switching traffic. Never point a new provider at production just to test it.

### Server data model and relationships

PostgreSQL uses relational tables with JSONB for the canonical saved-item payload and structured AI output. MongoDB uses collections with the same names; references are explicit workspace/media/conversation IDs rather than ORM-managed relations.

| Entity | PostgreSQL table / MongoDB collection | Relationship and role |
|---|---|---|
| Saved media | `keeper_media` | One row/document per workspace and canonical URL. Stores `payload`, processing state, source identity, and content fingerprint. |
| Transcript | `keeper_media_transcripts` | At most one current transcript per media item; stores segments, language, status, and provider provenance. |
| Transcript history | `keeper_media_transcript_history` | Many archived transcript versions per media item, created during reprocessing. |
| AI analysis | `keeper_media_analyses` | Current grounded summary, tags, topic, collection result, confidence, and analysis JSON for a media item. |
| AI job | `keeper_ai_jobs` | One durable processing job per media item; unique workspace/idempotency key, lease, attempt count, retry time, and failure state. |
| Collection | `keeper_collections` | Workspace-owned collections, unique by workspace and collection ID. Media payloads reference collection IDs. |
| Collection profile | `keeper_collection_profiles` | Workspace/collection terms used for matching; references a collection. |
| Workspace memory | `keeper_workspace_memory` | One row/document per workspace for free-cycle anchor and organizer memory. |
| Organization correction | `keeper_organization_corrections` | Append-only user collection corrections tied to a workspace and media item. |
| Assignment memory | `keeper_workspace_assignments` | Latest AI/manual assignment per workspace/media item. |
| Usage ledger | `keeper_usage_ledger` | Import audit record per workspace/media item for activity tracking. |
| Assistant history | `keeper_ai_conversations`, `keeper_ai_messages` | One conversation to many messages, scoped by workspace. |

### Backend implementation notes

- [`src/lib/database/backend-client.ts`](src/lib/database/backend-client.ts) selects the configured store while keeping Supabase Auth verification at the API boundary.
- [`src/lib/database/postgres-store.ts`](src/lib/database/postgres-store.ts) provides parameterized SQL access, transactional import/quota behavior, and `SKIP LOCKED` AI job claiming.
- [`src/lib/database/mongodb-store.ts`](src/lib/database/mongodb-store.ts) provides collection access, index creation, replica-set transaction handling for imports, and atomic job claiming.
- [`database/postgres/001_keeper.sql`](database/postgres/001_keeper.sql) is the standalone PostgreSQL schema. Supabase projects continue using `supabase/migrations/` because those migrations include Supabase Auth/RLS-specific behavior.
- `DATABASE_POOL_MAX` controls PostgreSQL/MongoDB server pool size (default `10`). Never create database clients in browser components.

MongoDB uses single-document atomic updates and transactions for cross-document operations; a transaction-capable deployment is required for the import invariant. [MongoDB transaction documentation](https://www.mongodb.com/docs/manual/core/transactions/). PostgreSQL job claiming uses row locking with `SKIP LOCKED`, designed for concurrent consumers of queue-like tables. [PostgreSQL locking documentation](https://www.postgresql.org/docs/current/sql-select.html).

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
  - `--oxblood` (`#4E0F15`): Deep hero cloud, dark overlays, and footer.
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
- Integrated as a secondary button in the floating nav, full-screen mobile menu drawer, sticky mobile quick bar, 404 page, and footer.
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

---

## Open-Source Edition Notice

This branch (`open_source_keeper`) provides Keeper as a completely free, self-hostable personal knowledge platform.
- **No Monetization**: No paid tiers, subscription plans, checkout flows, or billing webhooks.
- **No Artificial Quotas**: Unlimited bookmark saving, bulk importing, transcription, and AI assistance.
- **Full Capabilities**: Multi-platform ingestion (YouTube, Instagram, Reddit, X, web), AI summaries, auto-tagging, search, collections, and multi-device sync are completely operational.

