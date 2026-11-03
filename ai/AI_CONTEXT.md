# Keeper — AI Context

*Last updated: 2026-11-02*

## Local Provider Verification (2026-11-02)

- Work remains on `open_source_keeper`; current worktree changes must be preserved.
- `docker-compose.local-test.yml` defines isolated loopback-only test PostgreSQL/MongoDB services and dedicated test volumes. Initialization is explicit; no schema reset is automatic. Commands are documented in `ai/TESTING_GUIDE.md`.
- Current machine lacks a reachable Docker daemon and Compose plugin, so provider services/tests are not verified. Do not connect to local developer databases or use `.env.local` for integration tests.
- This checkout has no `supabase/config.toml` or Supabase CLI. Supabase local Auth/RLS is unsupported until a reviewed local project setup exists; do not copy it from another branch.
- Supabase Auth is still required by `createBackendServerClient()` before selecting the data provider. Standalone store checks would not constitute API auth or RLS verification.
- Phase 1 remains open; see `ai/CURRENT_STATUS.md`, `ai/DATABASE_PROVIDER_MATRIX.md`, and `ai/TESTING_GUIDE.md` for exact verification labels.

> [!IMPORTANT]
> **START HERE:** Read every Markdown file in `ai/` before beginning work. Then inspect `git status` and `git log -n 30 --stat`. Follow `DEVELOPMENT_RULES.md`, preserve the existing design/theme unless asked otherwise, and ask the user before large structural changes. Verify current behavior in source; code is the technical source of truth.

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

- **Framework**: Next.js 16.4.3 (App Router, React Server Components & Client Components)
- **Runtime / UI Core**: React 19.3.1, React DOM 19.3.1
- **Language**: TypeScript 5 (Strict Mode enabled in [`tsconfig.json`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/tsconfig.json))
- **Styling**: Tailwind CSS v4 (`@tailwindcss/postcss` 4.x, Vanilla CSS tokens in [`src/app/globals.css`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/app/globals.css), `tailwind-merge`, `clsx`)
- **Visual system**: Editorial landing page uses cream/ink/gold Keeper tokens with Geist; legacy Krackerz display styles also exist in CSS. Preserve route-specific styling and theme behavior rather than assuming every page shares one palette.
- **Icons & Delight**: `lucide-react` 1.61.0, `canvas-confetti` 1.9.4
- **Testing**: Native Node.js test runner using `tsx` (`scripts/run-tests.ts`, `scripts/smoke-test.ts`)
- **Linting**: ESLint 9 (`eslint-config-next` 16.4.0)

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

## Setup and configuration names

- Install with `npm ci`; run `npm run dev`, `npm run type-check`, `npm test`, `npm run lint`, `npm run audit:design`, `npm run build`, and `npm start` as needed. CI uses Node.js 24.
- Public/app config: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, optional `NEXT_PUBLIC_SPLINE_HERO_URL`.
- Platform integrations: `YOUTUBE_API_KEY`, `INSTAGRAM_OEMBED_TOKEN`, `META_APP_ACCESS_TOKEN`.
- Supabase server access: `SUPABASE_SERVICE_ROLE_KEY`.
- Auth session expiry signing: required independent server-only `AUTH_SESSION_SECRET` (at least 32 UTF-8 bytes; low-diversity and placeholder values are rejected). Generate with `openssl rand -base64 48`; do not substitute Supabase keys or URLs. Missing/weak configuration prevents marker signing; there is no development fallback. Rotation invalidates existing markers.
- Billing: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`.
- AI worker: `AI_WORKER_SECRET` (legacy `CRON_SECRET` is also referenced). Transcription names include `TRANSCRIPTION_PROVIDER`, `TRANSCRIPTION_FALLBACK`, `GEMINI_API_KEY`, `DEEPGRAM_API_KEY`, `OPENAI_TRANSCRIPTION_API_KEY`, `OPENAI_TRANSCRIPTION_MODEL`, `WHISPER_SERVICE_URL`, `WHISPER_SERVICE_TOKEN`, `WHISPER_MODEL`, and `AUDIO_EXTRACTION_SERVICE_URL`. Analysis names include `CONTENT_AI_PROVIDER`, `CONTENT_AI_API_KEY`, `CONTENT_AI_API_URL`, and `CONTENT_AI_MODEL`. OCR uses `OCR_SERVICE_URL` and `OCR_SERVICE_TOKEN`.
- OAuth token encryption: `TOKEN_ENCRYPTION_KEY`.
- Deploy/smoke names include `PRODUCTION_APP_URL`, Vercel GitHub secrets, `DEPLOY_URL`, and `VERCEL_AUTOMATION_BYPASS_SECRET`. These are names only; do not commit values.
- Default `npm test` is isolated from live databases. Live Supabase RLS validation is explicitly invoked with `npm run test:integration:supabase` and dedicated `KEEPER_TEST_*` variables documented in `ai/TESTING_GUIDE.md`.
- Migration files are ordered `202610060001_billing.sql`, `202610070001` through `202610070004`, then `202610200001_ai_pipeline_recovery.sql`. The recovery migration is uncommitted and its application status is UNVERIFIED. Do not apply or test migrations against production; a separate project ref and explicit staging identity must be confirmed first.

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

## Current State (verified from checkout on 2026-11-02)

- Runtime versions in `package.json`: Next.js 16.4.3, React/React DOM 19.3.1, TypeScript 5, Tailwind CSS 4, Node 24 in CI.
- Durable Supabase-backed media jobs, billing, authenticated APIs, and localStorage legacy library coexist. Do not describe all user library state as cloud-synced.
- Phase 0 reports are in `ai/audits/phase-0-2026-11-02/`. Phase 1 adds `ai/SECURITY_BASELINE.md`, `ai/PERSISTENCE_ARCHITECTURE.md`, `ai/DATABASE_PROVIDER_MATRIX.md`, and `ai/TESTING_GUIDE.md`.
- Session expiry markers now require independent `AUTH_SESSION_SECRET`; no Supabase credential/URL or hardcoded development fallback is used.
- `npm test` no longer reads `.env.local`; live Supabase RLS checks require `npm run test:integration:supabase` and dedicated test configuration. The live integration path was not run in Phase 1.
- Media and collection reads now return explicit failures rather than treating backend errors as empty/default data. `syncWorkspace` preflights both reads before migration or cache reconciliation. Mutation state is still local-first; failures show a sync error but there is no durable outbox, tombstone queue, or versioned conflict resolver. Do not claim full server-authoritative synchronization; see `ai/PERSISTENCE_ARCHITECTURE.md`.
- Phase 1 corrective validation on 2026-11-02: `npm test` 292/292 passed (live RLS skipped); `npm run type-check -- --incremental false` passed; `npm run lint` exited 0 with 0 errors and 255 warnings; `git diff --check` passed. Route/provider behavior, production build, live tenant isolation, and database migrations remain unverified. Phase 1 is partial/open.

## Current Production State

- **Bulk Import Engine**: Production-ready for Instagram JSON/ZIP and YouTube Takeout CSV. Concurrency queue, pause/resume, and pre-import breakdown are fully functional.
- **Data Immutability (P0)**: **RESOLVED**. Authoritative Meta export metadata (canonical URL, creator handle, original caption, saved timestamp, shortcode, FBID) cannot be mutated by remote guest scraping, AI analysis, reprocessing, or duplicate updates.
- **Authentic Thumbnails (P1)**: **LIMITED**. Authentic media from ZIP archives or verified providers is strictly preserved. When authentic media is inaccessible (e.g. unauthenticated JSON-only imports without Graph API credentials), Keeper displays an honest vector placeholder card; stock photos (Unsplash, Matrix wallpaper) are permanently banned.
- **Collection Management & Bulk Deletion**: Fully isolated per user with multi-collection unlinking semantics and comprehensive multi-tenant authorization security.
- **AI Grounding**: Durable server-side AI worker with grounded evidence gates and explicit failure states; provider credentials, live APIs, and Supabase production behavior remain environment-dependent and are not verified in this checkout.

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
