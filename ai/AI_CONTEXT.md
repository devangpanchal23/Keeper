# Keeper — AI Context

*Last Updated: 2026-10-02*

> [!IMPORTANT]
> **CODE IS THE FINAL TECHNICAL SOURCE OF TRUTH.**
> This `/ai` directory is a navigation, continuity, and architecture layer designed for AI coding assistants. If documentation ever conflicts with active code, inspect the codebase, determine the real behavior, and update this documentation. Never alter production code merely to match stale documentation.

---

## What Keeper Is

**Keeper** (internally referred to as `recall-app` in `package.json`) is an AI-powered universal content capture, bookmarking, and knowledge management application. It enables users to:
1. **Save Content from Any Platform**: Single URL ingestion and bulk-import from official data exports (Meta/Instagram JSON/ZIP, YouTube Takeout CSV).
2. **Organize Knowledge**: Route into user-defined collections, system collections, multiple collection memberships, tags, favorites, and trash.
3. **Analyze Content with Grounded AI**: Generate multi-tier summaries (quick TL;DR, standard overview, detailed breakdown), extract topics, keywords, intent classification, and key points without hallucinating missing data.
4. **Search & AI Chat**: Multi-field weighted full-text search and RAG-style conversational AI assistant operating over saved context.
5. **Preserve Authentic Evidence**: Strict data provenance separating immutable source-authoritative metadata from AI-derived fields and visual media representations.

---

## Technology Stack

- **Framework**: Next.js 16.3.7 (App Router, Turbopack, React Server Components & Client Components)
- **Runtime / UI Core**: React 19.2.8, React DOM 19.2.8
- **Language**: TypeScript 5 (Strict Mode enabled in [`tsconfig.json`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/tsconfig.json))
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss` 4.x, Vanilla CSS tokens in [`src/app/globals.css`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/app/globals.css), `tailwind-merge`, `clsx`)
- **Icons & Delight**: `lucide-react` 1.49.0, `canvas-confetti` 1.9.4
- **Testing**: Native Node.js test runner using `tsx` (`scripts/run-tests.ts`, `scripts/smoke-test.ts`)
- **Linting**: ESLint 9 (`eslint-config-next` 16.3.7)

---

## Architecture Summary

- **Frontend**: Next.js App Router (`src/app/`):
  - Marketing Landing: [`src/app/page.tsx`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/app/page.tsx) composed as a warm, editorial Keeper product story with an interactive library preview.
  - Web Application: [`src/app/app/`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/app/app/) covering dashboard, library, collections, bulk import, AI assistant, search, favorites, archive, and trash.
  - Item Detail: [`src/app/item/[id]/page.tsx`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/app/item/[id]/page.tsx).
- **State Management**: React Context ([`src/context/RecallContext.tsx`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/context/RecallContext.tsx)) mediating UI events with underlying services.
- **Storage Layer**: [`StorageService`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/storage-service.ts) providing tenant-isolated persistence (browser `localStorage` with in-memory map fallback for SSR and automated testing).
- **Ingestion & Providers**: [`IngestionService`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/ingestion-service.ts) delegating to modular platform providers in [`src/services/providers/`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/providers/) (Instagram, YouTube, Reddit, LinkedIn, X, and Generic Website).
- **Bulk Import**: Multi-stage worker queue in [`ImportJobService`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/bulk-import/import-job-service.ts) supporting Meta JSON/ZIP exports and YouTube CSVs with pre-import analysis, concurrency control, and duplicate resolution.
- **Grounded AI Pipeline**: [`AIPipeline`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/ai-pipeline.ts) and [`AIService`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/ai-service.ts) enforcing evidence-grounded summarization, topic extraction, and conversational search.

---

## Critical Entry Points

For the durable asynchronous AI media pipeline, plan limits, schema, worker operation, and known production setup gaps, read [`ai/AI_MEDIA_ARCHITECT.md`](AI_MEDIA_ARCHITECT.md).
For required GitHub Actions gates, Vercel production deployment setup, rollback behavior, and repository administrator configuration, read [`ai/CI_CD.md`](CI_CD.md).

| Path | Purpose |
| :--- | :--- |
| [`src/types/index.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/types/index.ts) | Canonical source of truth for all domain interfaces (`SavedItem`, `Collection`, `ImportJob`, etc.) |
| [`src/context/RecallContext.tsx`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/context/RecallContext.tsx) | Client state hub coordinating collection mutations, search filtering, and CRUD operations |
| [`src/services/content-service.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/content-service.ts) | Item CRUD, collection-scoped deletion, and central `safeMerge` immutability policy |
| [`src/services/ingestion-service.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/ingestion-service.ts) | Multi-step single-URL ingestion and metadata separation pipeline |
| [`src/services/bulk-import/import-job-service.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/bulk-import/import-job-service.ts) | Bulk import orchestration, worker concurrency queue, and progress tracking |
| [`src/services/media/instagram-thumbnail-resolver.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/media/instagram-thumbnail-resolver.ts) | Strict thumbnail priority resolver and stock photo ban enforcement |
| [`scripts/run-tests.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/scripts/run-tests.ts) | 24-suite automated production regression test harness |

---

## Current Production State

- **Bulk Import Engine**: Production-ready for Instagram JSON/ZIP and YouTube Takeout CSV. Concurrency queue, pause/resume, and pre-import breakdown are fully functional.
- **Data Immutability (P0)**: **RESOLVED**. Authoritative Meta export metadata (canonical URL, creator handle, original caption, saved timestamp, shortcode, FBID) cannot be mutated by remote guest scraping, AI analysis, reprocessing, or duplicate updates.
- **Authentic Thumbnails (P1)**: **LIMITED**. Authentic media from ZIP archives or verified providers is strictly preserved. When authentic media is inaccessible (e.g. unauthenticated JSON-only imports without Graph API credentials), Keeper displays an honest vector placeholder card; stock photos (Unsplash, Matrix wallpaper) are permanently banned.
- **Collection Management & Bulk Deletion**: Fully isolated per user with multi-collection unlinking semantics and comprehensive multi-tenant authorization security.
- **AI Grounding**: High-fidelity local AI rules pipeline with graceful fallbacks for restricted guest content.

---

## Critical Invariants

1. **Valid Export Data Must Survive Network/Scraper Failure**: If an export supplies creator `@penguin` and URL `https://instagram.com/reel/123`, a network timeout or restricted guest page during ingestion must NOT cause the item to be dropped or corrupted.
2. **Authoritative Export Metadata Must Never Be Overwritten by Weaker Evidence**: `creator`, `caption`, `canonicalUrl`, and `savedDate` from official exports always win over remote guest scraping or AI outputs via [`ContentService.safeMerge`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/content-service.ts#L150).
3. **URL Immutability**: Changing `/reel/AAA/` to `/reel/BBB/` is a fatal data corruption violation. Only canonicalization of the exact same content (e.g. stripping UTM tracking params) is permitted.
4. **Authentic Thumbnails Only — No Stock Wallpaper**: Misleading stock images (Unsplash, code/matrix wallpaper, generic laptop images) must NEVER be presented as authentic media. If authentic media is absent, keep the explicit branded SVG placeholder (`INSTAGRAM_REEL_PLACEHOLDER`).
5. **Tenant Isolation**: Multi-tenant authorization must prevent User A from targeting, deleting, or viewing User B's collections or items.
6. **Separation of Source Content and AI Content**: The AI pipeline may generate summaries, topics, and intent, but it must NEVER overwrite the original source caption or creator.

---

## Reading Order for New AI Agents

When starting a session or resuming work, read files in this exact sequence:

1. [`ai/AI_CONTEXT.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/AI_CONTEXT.md) *(this document)* — High-level orientation.
2. [`ai/CURRENT_STATUS.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/CURRENT_STATUS.md) — What is working, broken, and recently fixed.
3. [`ai/HANDOFF.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/HANDOFF.md) — Exact state of the last task, what was tried, and immediate next steps.
4. **Subsystem Documentation** *(as required by task)*:
   - Bulk Import: [`ai/BULK_IMPORT.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/BULK_IMPORT.md)
   - Data Models & Field Ownership: [`ai/DATA_MODELS.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/DATA_MODELS.md)
   - Platform Providers: [`ai/PROVIDERS.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/PROVIDERS.md)
   - AI & Summaries: [`ai/AI_PIPELINE.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/AI_PIPELINE.md)
   - Storage & State: [`ai/STORAGE_AND_STATE.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/STORAGE_AND_STATE.md)
   - Testing & Validation: [`ai/TESTING.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/TESTING.md)
   - Development Rules: [`ai/DEVELOPMENT_RULES.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/DEVELOPMENT_RULES.md)
5. **Inspect Active Source Code**: Always verify against active code before making any edits.
