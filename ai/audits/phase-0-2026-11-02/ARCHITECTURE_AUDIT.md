# Keeper Phase 0 — Architecture Audit

**Audit date:** 2026-11-02  
**Scope:** Read-only inspection of the `open_source_keeper` checkout. Source and configuration were inspected; live production, deployment, database schema state, and provider behavior were not independently verified.

## Executive summary

Keeper is a Next.js application with a browser-first library state layer and a second authenticated server persistence path. It already includes platform ingestion, export-based bulk import, durable asynchronous AI media jobs, grounded summaries/tags, local search, assistant retrieval, and cloud conversation history. It does not have vector indexing, semantic retrieval infrastructure, a general content snapshot/media archive, user activity/recommendation history, learning progress data, or graph persistence. The largest readiness constraint is split persistence: authenticated imports and AI records can live in a server database while many library edits and the broader library remain local-first.

The repository advertises three server data stores (Supabase, PostgreSQL, MongoDB), but Supabase Auth remains required for identities in all three modes (`README.md`, `src/lib/database/backend-client.ts`). Database runtime state and applied migrations were unavailable for inspection; schema findings below refer to checked-in SQL only.

## Verified stack

| Layer | Actual checkout evidence |
|---|---|
| Web framework | Next.js `16.4.3` (`package.json`); App Router routes in `src/app`, Next config in `next.config.ts`. |
| UI/runtime | React and React DOM `19.3.1`; client components and React Context. |
| Language | TypeScript `^5`, strict mode in `tsconfig.json`. |
| CSS | Tailwind CSS v4, PostCSS plugin, global CSS tokens (`package.json`, `postcss.config.mjs`, `src/app/globals.css`). |
| Server/API | Next.js route handlers under `src/app/api/**/route.ts`; server-only backend/auth helpers. |
| Identity | Supabase Auth via `@supabase/ssr` and `@supabase/supabase-js`; verified user lookup at API boundaries. |
| Persistence | Supabase/PostgREST, PostgreSQL (`pg`), or MongoDB (`mongodb`), selected by `DATABASE_PROVIDER`; browser `localStorage` and in-memory fallback also remain. |
| AI/media | Configurable Gemini or OpenAI-compatible text analysis/assistant; configurable transcription providers and OCR sidecar; FFmpeg/media acquisition services. |
| Billing residue | Razorpay package, API routes, webhook handling, and billing schemas remain in the checkout despite the open-source README saying monetization was removed. Runtime routes appear edition-stubbed, but need explicit endpoint verification. |
| Tests/lint | `node --import tsx scripts/run-tests.ts`; TypeScript compiler; ESLint 9 / `eslint-config-next` 16.4.3. |
| CI/deployment | GitHub Actions in `.github/workflows/{ci,deploy,design-audit,ai-worker}.yml`; Dockerfile and Compose are present. |

## Architecture and entry points

- **UI:** Marketing routes at `src/app/page.tsx`; authenticated workspace surfaces under `src/app/app/` (dashboard, library, collections, bulk import, search, AI assistant, archive, favorites, recent, trash, profile/settings); item detail at `src/app/app/item/[id]/page.tsx`.
- **Client state:** `src/context/RecallContext.tsx` holds items, collections, filters, sync status, and mutations. `src/services/storage-service.ts` persists the local compatibility cache keyed by user and uses an in-memory store where browser storage is unavailable.
- **Content model and services:** `src/types/index.ts` defines `SavedItem`, `Collection`, provenance, content representations, import jobs/reports, and AI results. `ContentService` centralizes safe merges and content CRUD; `CollectionService` handles collection operations.
- **Single URL intake:** `POST /api/ingest` is called by `src/components/modals/AddContentModal.tsx`; `IngestionService` routes to modular providers, normalizes source facts, handles media preview, and stores an item.
- **Bulk intake:** Instagram JSON/ZIP and YouTube Takeout/URL-list parsers and adapters live in `src/services/bulk-import/`. `ImportJobService` runs browser-side bounded concurrency with per-item status, retry, pause/resume, and reports. Authenticated server routes under `/api/bulk-import/` create/parse/control jobs and reports.
- **Server persistence:** `src/lib/database/provider.ts`, `backend-client.ts`, `postgres-store.ts`, and `mongodb-store.ts` implement the selectable database abstraction. Supabase uses SQL RPCs and RLS; standalone Postgres/Mongo use server-side workspace-scoped access, with Supabase Auth still the identity source.
- **Durable media AI:** `/api/ingest` writes imported media and an AI job through the database path. `/api/ai/worker` authenticates a worker secret, claims a leased job, fetches available source media, transcribes/OCRs, runs analysis and collection matching, and persists status/evidence. GitHub Actions scheduler exists in `.github/workflows/ai-worker.yml`.
- **Assistant:** `SearchService` performs in-memory weighted token/synonym/fuzzy matching. `AIService` prepares relevant sources; `AssistantAnswerService` can call a configured model and accepts only exact quotes from known saved item text. Conversation history is local for demo sessions and has workspace-scoped tables/routes for cloud sessions.

## Persistence and processing boundaries

`README.md` documents the current split explicitly: the selected database stores authenticated import/AI state, collections used by processing, usage/billing, and cloud assistant history, while notes, favorites, archive/trash, many item edits, and the broader library can remain local. `RecallContext.tsx` performs local-first hydration and asynchronous sync. Therefore, “cross-device library sync” is not a complete property of all records or mutations, even though several sync endpoints and tests exist.

Checked-in SQL provides tables for media, current transcript, transcript history, AI analyses, collections, durable jobs, collection profiles/assignments/corrections, usage ledger, and assistant conversations/messages. Media uses a JSONB payload as a flexible SavedItem representation, with some indexed identity/status fields. No vector extension, embedding table, FTS generated column, graph tables, or snapshot/blob metadata table appears in checked-in schemas.

## Security and operations observations

- Authenticated routes generally call Supabase `auth.getUser()` and constrain record lookups by workspace. Supabase migrations enable RLS on core tables; the standalone PostgreSQL DDL does not enable database RLS, so isolation there depends on API code and private database networking.
- `src/lib/supabase/auth-session.ts` derives its HMAC secret from configuration but includes a deterministic hard-coded fallback seed when all configured candidates are missing. This is a high-priority security concern for self-hosters who omit `AUTH_SESSION_SECRET` and Supabase secrets; the fallback is predictable and must be replaced before treating the fallback path as secure.
- AI worker secret comparison is timing-safe and worker jobs are leased/retried. AI source text is treated as untrusted input in prompts; returned analysis evidence is validated against source text.
- `src/app/api/ai/worker/route.ts` logs/persists failure messages; inspect data redaction and retention before sending user content or provider diagnostics to centralized logs.
- Environment variable *names* are documented in `.env.example`; this audit did not read `.env.local` values or expose secrets.

## Open-source and deployment footprint

The repo includes MIT `LICENSE`, `CONTRIBUTING.md`, `SECURITY.md`, `README.md`, `Dockerfile`, and `docker-compose.yml`. Docker Compose starts Keeper plus PostgreSQL and optionally MongoDB. The app still requires Supabase Auth configuration, while the base Compose file selects local Postgres; it does not provide a local authentication service. Compose contains sample passwords and is suitable only as a local example unless operators replace them. Docker builder runs `npm run build`; build was not run during this audit because it writes `.next` output and may make external font requests.

## Evidence limits

This report describes checked-in source and files only. It does not verify applied migrations, configured provider credentials, live Supabase/Postgres/Mongo behavior, actual deployment secrets, scheduler execution, platform extraction success, or production performance. The legacy open-source and subsystem audit files were also inspected as context but were not treated as proof of current behavior.
