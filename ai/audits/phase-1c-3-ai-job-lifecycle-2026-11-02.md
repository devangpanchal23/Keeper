# Keeper Phase 1C-3 — AI Job Lifecycle Provider Parity

**Date:** 2026-11-02  
**Branch:** `open_source_keeper`  
**Scope:** Standalone PostgreSQL and MongoDB job claiming, exhaustion handling, and reprocessing reset. Supabase migrations and database services were not touched.

## Verdict

**PASS for implementation and deterministic local contract tests; live provider parity remains unverified.** Both standalone providers now share the recognized processing-stage list, claim into `EXTRACTING`, increment claims atomically, grant the five-minute lease, respect the five-claim maximum, terminalize expired exhausted jobs, and order claims deterministically. Tests that model transactions/concurrency are simulations and do not establish actual database behavior.

## Provider behavior implemented

### PostgreSQL

- `claimJob()` continues to use a transaction and `FOR UPDATE SKIP LOCKED`.
- Before selecting a job, one CTE/update operation terminalizes expired or unlocked jobs at five attempts: job status becomes `FAILED`, the lock clears, missing diagnostics become a retry-limit message and `RETRY_EXHAUSTED`, and the corresponding workspace/media row becomes `FAILED` in the same transaction.
- `coalesce` preserves any pre-existing failure code, including historical unknown values.
- Claimable states come from `AI_JOB_PROCESSING_STAGES` (including `QUEUED`, legacy `PENDING`, and every active stage). Claims require `attempts < 5`, due `available_at`, and no live lease. The update increments attempts atomically, sets `EXTRACTING`, and sets `locked_until` to five minutes from database time.
- Candidate order is `available_at`, `created_at`, then `id`; row locking continues to prevent two workers taking the same selected job.
- Reprocessing now also clears `failure_code`, in addition to attempts, lock, last error, and resetting availability/status.

### MongoDB

- Claim and exhaustion handling now run within `session.withTransaction()`; this requires the existing replica-set deployment mode.
- Expired/unlocked exhausted jobs are terminalized with an update pipeline that preserves non-null historical error/failure-code values. Corresponding media rows are updated by the explicit `(workspace_id, media_id)` pairs in the same transaction.
- The atomic `findOneAndUpdate` accepts the shared status list, attempts below five, due availability, and absent/expired leases. It increments attempts, transitions to `EXTRACTING`, and grants a five-minute lease.
- Sort order is `available_at`, `created_at`, application `id`, then Mongo `_id` as a stable final tie-breaker for legacy documents.
- Existing reprocessing already clears attempts, lock, last error, and failure code while setting `QUEUED` and a fresh `available_at`; this behavior is covered by source-level regression checks.

### Worker and status separation

- Worker failure handling now types job transitions as `AIJobStatus` and media-stage failures as `MediaProcessingFailureStatus`/`MediaProcessingStatus`. Retryable errors become `QUEUED`; permanent or exhausted failures become terminal job `FAILED`, while the media row retains the relevant stage failure on permanent processing errors.
- Successful completion remains `COMPLETED`; worker failure and success paths clear locks. Existing failure-code vocabulary and diagnostic fields are not replaced.

## Tests added

`scripts/run-tests.ts` adds deterministic mock/simulation coverage for:

- Every recognized claimable state, including `QUEUED`, legacy `PENDING`, `MEDIA_FOUND`, `EXTRACTING_AUDIO`, and `TRANSCRIPT_READY`.
- Claim transition to `EXTRACTING`, one-time attempt increments, and exact five-minute leases.
- Due-time and live-lock eligibility.
- Retry delays at attempts 1–5 and the one-hour cap.
- Retryable versus permanent outcomes and the five-claim limit.
- Recovery of an expired fourth claim, then terminalization of an expired fifth claim with `RETRY_EXHAUSTED` and cleared lock.
- Preservation of a pre-existing historical failure code.
- Deterministic `available_at` / `created_at` / ID ordering.
- Simulated concurrent workers acquiring distinct jobs.
- Generic terminal job status versus media-specific failure type.
- PostgreSQL skip-locked query wiring and MongoDB transaction/atomic-claim wiring.
- Reprocessing reset fields in both provider implementations.

The concurrency, lease, state, and transaction assertions are mock simulations plus source-wiring checks. They do not execute either provider's SQL or Mongo operations.

## Verification

- `npm test` — **PASS**, 298/298 assertions. The opt-in Supabase RLS test was skipped.
- `npm run type-check -- --incremental false` — **PASS**.
- Focused ESLint (`postgres-store.ts`, `mongodb-store.ts`, AI worker, retry policy, and test runner) — **PASS**, 0 errors and 25 existing warnings (24 in the test runner and one pre-existing unused binding in Mongo store).
- `git diff --check` — **PASS**.
- No database, Docker service, or Supabase project was accessed; no migration was run.

## Exact files modified for this pass

- `src/lib/database/postgres-store.ts`
- `src/lib/database/mongodb-store.ts`
- `src/app/api/ai/worker/route.ts`
- `scripts/run-tests.ts`
- `ai/audits/phase-1c-3-ai-job-lifecycle-2026-11-02.md` (new)

## Remaining limitations

- PostgreSQL claim concurrency, interval expression, CTE terminalization, and rollback were not executed against a live PostgreSQL instance.
- MongoDB transaction retry/commit behavior and concurrent `findOneAndUpdate` claims were not verified on a replica set.
- Supabase behavior was not changed or retested; its migration implementation remains separate.
- This pass does not add database status constraints or repair pre-existing records. Legacy statuses/codes remain untouched unless they meet the existing claimable-state and exhausted-lease rules.

