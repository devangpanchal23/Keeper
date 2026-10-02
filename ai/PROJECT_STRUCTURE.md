# Keeper — Project Structure

*Last Updated: 2026-10-02*

This document provides an annotated map of the repository to guide code navigation.

---

## Directory Hierarchy Overview

```text
Keeper/
├── .env.example                # Template for environment configuration
├── AGENTS.md                   # Agent guidelines & Next.js rule block
├── CLAUDE.md                   # Pointer to AI context & guidelines
├── package.json                # Next.js 16.3.7, React 19.2.8, Tailwind 4
├── tsconfig.json               # TypeScript strict configuration (@/* alias)
│
├── ai/                         # REPOSITORY-LOCAL AI KNOWLEDGE SYSTEM (You are here)
│   ├── AI_CONTEXT.md           # Master entry point for new AI sessions
│   ├── CURRENT_STATUS.md       # Real-time working, partial, & broken statuses
│   ├── HANDOFF.md              # Immediate state of active task & next steps
│   └── ...                     # Subsystem guides
│
├── public/                     # Static assets (favicons, SVGs)
│
├── scripts/                    # Test harnesses and developer CLI tools
│   ├── run-tests.ts            # 24-suite production test suite (110+ assertions)
│   ├── smoke-test.ts           # Rapid sanity test for core ingestion & providers
│   └── palette-audit.ts        # Design token and color palette validator
│
└── src/
    ├── app/                    # Next.js App Router (pages and API routes)
    │   ├── api/                # Backend API routes
    │   ├── app/                # Main authenticated web app pages
    │   ├── item/[id]/          # Saved item detail view
    │   ├── globals.css         # Tailwind v4 theme & Krackerz tokens
    │   ├── layout.tsx          # Root layout with font imports & providers
    │   └── page.tsx            # Marketing landing page (Krackerz design)
    │
    ├── components/             # React presentation components
    │   ├── bulk-import/        # Bulk import dialog, table, progress modal
    │   ├── cards/              # ItemCard, grid/list view renders
    │   ├── common/             # Button, Input, Modal, Badge, Toast
    │   ├── landing/            # Krackerz editorial landing components
    │   ├── layout/             # TopNav, Sidebar, AppHeader
    │   └── modals/             # AddContentModal, CreateCollectionModal
    │
    ├── config/                 # Static configuration and environment constants
    │
    ├── context/                # Global state
    │   └── RecallContext.tsx   # Primary React Context for client state
    │
    ├── data/                   # Seed data and mock items
    │   └── seed-data.ts        # Initial collections, tags, and demo items
    │
    ├── lib/                    # Shared utilities
    │   ├── constants.ts        # Storage keys, platform badges, color maps
    │   └── utils.ts            # Class name merger (cn), formatting helpers
    │
    ├── services/               # Core business logic singletons
    │   ├── ai-pipeline.ts      # Grounded AI summarization, topics, intent
    │   ├── ai-service.ts       # AI chat assistant & natural language query
    │   ├── auth-service.ts     # User sessions & password hashing
    │   ├── collection-service.ts # Collection management & metrics
    │   ├── content-service.ts  # Item persistence & safeMerge policy
    │   ├── ingestion-service.ts # URL ingestion & metadata pipeline
    │   ├── migration-service.ts # Schema upgrades & data migrations
    │   ├── search-service.ts   # Weighted full-text search engine
    │   ├── storage-service.ts  # Tenant-isolated storage abstraction
    │   │
    │   ├── bulk-import/        # Bulk import orchestration
    │   │   ├── adapters/       # Platform-specific archive readers
    │   │   │   ├── instagram-export-adapter.ts # Meta JSON/ZIP parser
    │   │   │   └── zip-archive-reader.ts       # Safe zero-dep ZIP reader
    │   │   ├── export-parser.ts   # Unified export file parser
    │   │   ├── import-job-service.ts # Job runner & concurrency queue
    │   │   └── oauth-service.ts   # OAuth state security & encryption
    │   │
    │   ├── evidence/           # Multi-source evidence fusion
    │   ├── media/              # Media acquisition & thumbnail resolvers
    │   │   ├── instagram-thumbnail-resolver.ts # Priority thumbnail resolver
    │   │   ├── media-acquisition-service.ts    # Headless media fetcher
    │   │   ├── transcription-service.ts        # Audio transcription
    │   │   └── visual-text-service.ts          # OCR & visual text
    │   │
    │   ├── normalizer/         # Cross-platform normalization
    │   │   └── metadata-normalizer.ts # Mojibake fix & tag sanitization
    │   │
    │   ├── providers/          # Modular content providers
    │   │   ├── content-provider.interface.ts # Base provider contract
    │   │   ├── provider-registry.ts          # Provider singleton registry
    │   │   ├── instagram-provider.ts         # Instagram post/reel logic
    │   │   ├── youtube-provider.ts           # YouTube video/shorts logic
    │   │   ├── reddit-provider.ts            # Reddit thread & media logic
    │   │   ├── linkedin-provider.ts          # LinkedIn post/pulse logic
    │   │   ├── x-provider.ts                 # X / Twitter tweet logic
    │   │   └── generic-provider.ts           # Fallback website reader
    │   │
    │   └── reprocessing/       # Item re-enrichment
    │       └── reprocessing-service.ts # Safe re-enrichment service
    │
    └── types/
        └── index.ts            # Comprehensive TypeScript type definitions
```

---

## Key Files: Detail Breakdown

### `src/types/index.ts`
- **What it does**: Defines every domain interface, union, and payload structure.
- **Why it exists**: Guarantees type safety across providers, services, context, and UI.
- **Who calls it**: Virtually every TypeScript file in `src/`.

### `src/context/RecallContext.tsx`
- **What it does**: Holds active state for items, collections, filters, search terms, and active import jobs. Exposes action handlers (`addContent`, `deleteItem`, `updateItem`, `deleteCollectionItems`).
- **Why it exists**: Eliminates prop-drilling; guarantees consistent UI updates across dashboard, detail view, and modals.
- **Who calls it**: All client components in `src/app/app/` and `src/components/`.

### `src/services/content-service.ts`
- **What it does**: Performs CRUD operations on `SavedItem` entities and executes `safeMerge` to protect authoritative data against overwrites.
- **Why it exists**: Centralizes persistence invariants so neither UI, AI, nor bulk import can accidentally corrupt data.
- **Who calls it**: `RecallContext`, `IngestionService`, `ReprocessingService`, `AIService`.

### `src/services/ingestion-service.ts`
- **What it does**: Accepts a URL, calls the matching provider, executes `AIPipeline`, normalizes tags, and stores the resulting item.
- **Why it exists**: Defines the universal standard ingestion pipeline for both single saves and bulk import queue workers.
- **Who calls it**: `RecallContext.addContent`, `ImportJobService.startJob`.

### `src/services/bulk-import/import-job-service.ts`
- **What it does**: Pre-analyzes candidates (5-way breakdown), runs concurrent worker pools (concurrency 1–5), updates job status, and handles duplicate strategies.
- **Why it exists**: Prevents UI freezing during large imports (100–1,000+ items) and provides resumable job execution.
- **Who calls it**: `BulkImportModal`, `src/app/api/bulk-import/`.

### `src/services/media/instagram-thumbnail-resolver.ts`
- **What it does**: Resolves authentic Instagram thumbnails and displays honest vector fallback cards when remote media is inaccessible.
- **Why it exists**: Prevents fake stock photos (Unsplash, Matrix wallpapers) from misleading the user when Instagram guest access is restricted.
- **Who calls it**: `InstagramProvider`, `InstagramExportAdapter`, `IngestionService`.

### `scripts/run-tests.ts`
- **What it does**: Comprehensive standalone test suite containing 110+ automated assertions across 24 test suites.
- **Why it exists**: Rapid end-to-end regression validation without external test runner bloat.
- **Who calls it**: Executed via `npm test` by CI/CD and developers.
