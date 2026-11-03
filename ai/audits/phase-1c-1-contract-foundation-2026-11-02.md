# Keeper Phase 1C-1 — Shared Contract Foundation

**Date:** 2026-11-02  
**Branch:** `open_source_keeper`  
**Scope:** Shared, provider-neutral application contracts and deterministic tests. No schema/provider persistence behavior or entitlement decision was changed.

## Result

**PASS for the shared contract foundation; BLOCKED for provider parity and database implementation.** Typed job/media states, retry/lease policy constants, a pure fingerprint v1 function, and the OSS usage-ledger shape are implemented and covered by local deterministic tests. No provider writes yet use the fingerprint or ledger helper. Existing persistence and import entitlement behavior remain unchanged by design.

## Implemented contracts

### AI job lifecycle

- Shared processing stages now include `QUEUED`, legacy `PENDING`, `EXTRACTING`, `MEDIA_FOUND`, `EXTRACTING_AUDIO`, `TRANSCRIBING`, `TRANSCRIPT_READY`, `ANALYZING`, `GENERATING_TAGS`, `MATCHING_COLLECTION`, `ORGANIZING`, and `INDEXING`.
- `AIJobStatus` permits the processing stages and only generic terminal states `COMPLETED` and `FAILED`.
- `MediaProcessingFailureStatus` separately permits `EXTRACTION_FAILED`, `TRANSCRIPTION_FAILED`, `ANALYSIS_FAILED`, `ORGANIZATION_FAILED`, and `INDEXING_FAILED`. The existing `AIProcessingState` name remains as a compatibility alias for media status consumers.
- Retry policy constants define a five-minute lease and five total attempts. Existing retry logic classifies permanent errors and uses exponential delays of 15, 30, 60, 120, and 240 seconds, capped at one hour.
- This work does not change claim SQL or Mongo claim behavior. Provider gaps documented in Phase 1A remain: standalone PostgreSQL and Mongo omit some stages; PostgreSQL has no exhaustion handling; Mongo does not terminalize exhausted leases and claims as `TRANSCRIBING`.

### Fingerprint v1

- Inputs are considered in fixed order: title, description, caption, body text.
- String fields are NFC-normalized, lowercased with JavaScript's locale-independent `toLowerCase()`, whitespace runs collapse to one ASCII space, and each field is trimmed. Non-string and empty fields are omitted.
- Normalized fields join with a fixed newline separator to preserve boundaries. The 80-scalar threshold counts the joined normalized string using Unicode scalar values (`Array.from`), so emoji count once each and structural separators count as scalar values.
- Empty or fewer than 80 scalar values returns `null`; qualifying text hashes as UTF-8 SHA-256 and returns `v1:` plus 64 lowercase hex digits.
- The helper does not mutate source fields. It does not dual-read legacy fingerprints or write persistence data.

Golden vectors are in `scripts/run-tests.ts`: empty, 79/80/81 ASCII scalar values, 79/80 emoji scalar values, multilingual text, NFC equivalence, case normalization, whitespace collapse, and distinct field boundaries.

### OSS usage-ledger normalization

- A successful newly created import maps to `{ event_type: "FREE_IMPORT", plan: "free", amount: 1 }`.
- A duplicate or no-op maps to `null`; callers must invoke ledger insertion only after a successful new media record is committed.
- The utility is pure and does not alter provider stores, import entitlement behavior, billing/subscription records, or cycle timestamp fields. Provider integration remains future work.

## Workspace ownership helper coverage

Verified from source:

- `createBackendServerClient()` authenticates with Supabase Auth and injects the verified user's ID into RPC `p_workspace_id` for standalone stores. The generic `.from()` proxy is a pass-through, so routes must continue to add explicit ownership predicates.
- Media list/detail/update/delete/reprocess paths and AI conversation/message/retrieval routes contain workspace filters in the inspected route code. Worker media/transcript/analysis/collection operations generally pair media/job identity with the claimed job workspace.
- Both standalone stores scope import dedupe and most record updates by workspace. `recordAssignment()` in PostgreSQL inserts/upserts a `(workspace_id, media_id)` assignment without first checking that the media belongs to that workspace; Mongo does the same in its corresponding `recordAssignment()` path. There is no FK/validator guarantee in the application contract that substitutes for this parent check.
- PostgreSQL `recordAssignment()` also accepts a collection ID without verifying the collection belongs to the workspace. Mongo's corresponding method likewise does not validate collection ownership. Supabase integrity depends on existing RLS/RPC/schema controls and must be separately verified.
- This audit did not exhaustively prove all routes or Supabase policies. The ownership gaps above require provider-specific tests and an explicit parent-ownership check before database changes.

## Existing behavior intentionally unchanged

- Open-source UI/API currently advertise unlimited imports. Recent branch commit `1a9b495` removes residual commercial quota behavior from the OSS application paths, but provider store import implementations still contain subscription/limit logic as recorded in the Phase 1A contract. No import flow was altered in this task.
- Billing, webhook, payment-failure, subscription, and usage persistence remain intact.
- No PostgreSQL or MongoDB connection was made; Supabase and Docker were not accessed.

## Modified files

- `src/types/index.ts`
- `src/services/ai-job-retry-policy.ts`
- `src/services/content-fingerprint.ts` (new)
- `src/services/usage-ledger-contract.ts` (new)
- `scripts/run-tests.ts`
- `ai/audits/phase-1c-1-contract-foundation-2026-11-02.md` (new)

## Verification

The shared contract tests are registered in the existing Node/tsx regression runner.

- `npm test` — PASS, 296/296 assertions; live Supabase RLS test skipped by its opt-in guard.
- `npm run type-check -- --incremental false` — PASS.
- `npm run lint` — PASS, 0 errors and 255 warnings across the repository. Focused ESLint on changed TS/TSX paths also passed with 0 errors; it reported 42 pre-existing warnings in `scripts/run-tests.ts` and `src/types/index.ts`, with none in the added contract utility files.
- `npm run build -- --webpack` — PASS, production compilation and static generation completed.
- Provider integration was not run. No database or Docker service was accessed.

Provider integration, SQL/Mongo parity, schema constraints, migration/backfill, and import-entitlement changes are outside this pass and remain unverified/unimplemented.

## Next implementation sequence

1. Add provider-independent store contract tests using isolated disposable test services.
2. Apply the pure fingerprint helper consistently in all provider insert/update paths only after legacy dual-read and backfill behavior is designed and tested.
3. Normalize newly written OSS ledger rows in each provider, preserving duplicate/no-op idempotency and all billing history.
4. Add explicit workspace parent checks to assignment and collection relationships; verify media/job/child ownership with provider-specific negative tests.
5. Align provider job claim stage coverage, lease recovery, attempt exhaustion, and status constraints only after inventory results and migration review.

