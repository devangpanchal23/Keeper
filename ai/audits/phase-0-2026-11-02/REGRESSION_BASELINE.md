# Keeper Phase 0 — Regression Baseline

## Working tree and baseline

- Branch: `open_source_keeper`.
- `git status --short` was empty before this audit. No existing application changes were present to preserve in the working tree.
- The latest commit is `1a9b495 fix: remove residual commercial import quotas from open-source edition`; preceding recent commits include the open-source audit/release infrastructure and database/auth integration. See `git log -n 30 --stat` for the inspected history.
- Existing prior audit docs and `OPEN_SOURCE_POST_RELEASE_VERIFICATION.md` were inspected as historical context. Their claims are not re-certified by this pass.

## Validation commands

| Exact command | Executed | Result | Interpretation |
|---|---:|---|---|
| `npm test` | Yes | **Fail: 288/289 assertions passed.** `Cross-Device Sync 9: Configured database multi-tenant isolation verification` failed at “Alice workspace query executes without error.” | The harness reads `.env.local` itself and attempts live read-only Supabase queries when credentials are present. Cause may be unavailable/wrong project, missing table/migration, network, or policy/configuration; origin is unknown. Secret values were not inspected or reported. All other local assertions passed. |
| `npm run type-check -- --incremental false` | Yes | **Pass**, exit 0. | No TypeScript errors under the current checkout. `--incremental false` avoids updating compiler build metadata. |
| `npm run lint` | Yes | **Pass with warnings**, exit 0; 0 errors, 255 warnings. | Warnings span unused values, `any`, hook dependency/effect guidance, and Next navigation usage. This is not a warning-free lint baseline. |
| `npm run build` | No | Not run. | Next build writes `.next` and may fetch fonts; safe read-only inspection was preferred. No build status is asserted. |
| `npm run audit:design` | No | Not run. | Not needed to answer the architecture/runtime audit; not a non-mutating guarantee was established. |
| Database migration/apply, Docker startup, live provider calls | No | Not run. | These can mutate databases, start services, or call external systems. |

The single test failure existed during this audit; its introduction date is **unknown** because no pre-change baseline or isolated staging credentials were available. The test is explicitly an integration check, not a pure unit test.

## Existing defects and regression-sensitive behavior

### P0: Authentication signing fallback

`src/lib/supabase/auth-session.ts` uses a predictable deterministic fallback secret if `AUTH_SESSION_SECRET`, Supabase service role key, Supabase key, and URL candidates do not provide a sufficiently long value. An attacker who knows this fallback can forge the seven-day expiry marker under that misconfigured path. This is a source-level security defect, not runtime-tested here. Self-hosted deployments must configure an independent strong secret; implementation remediation belongs in a later authorized phase.

### P1: Cloud integration test fails

The local test harness reads secret-bearing `.env.local` internally and queries two hard-coded workspace IDs through Supabase. It fails at its first data query, so no conclusion about tenant isolation in the live database can be made from this run. The deterministic source tests for workspace scoping pass, but do not replace an isolated real DB test.

### P1: Main library sync is partial

README documents local storage for the main library and several mutations while the database path backs imports, AI, collections used for processing, and history. New AI features that assume every user item is durable/server-readable can lose or omit locally authored items and edits across devices.

### P1: Separate schemas and database modes

Supabase uses ordered migrations with RLS and RPC functions; standalone Postgres has a checked-in initial schema; MongoDB creates indexes at runtime and requires replica-set transactions. They are separate implementations, not one migration system. Feature work needs parity checks and integration tests in each supported mode.

### P1: Platform content access limitations

Source inspection and `ai/AI_MEDIA_ARCHITECT.md` state that public metadata providers do not guarantee body/media access for Instagram/LinkedIn/YouTube. A successful bookmark is not proof of transcript, OCR, summary, or preserved media. New flows must retain explicit partial/failure states.

### P2: Bulk Locate relies on client/library identity

`ImportReportView` resolves `savedItemId`, then canonical URL variants through in-memory `items` and `ContentService`; navigation goes directly to `/app/item/{id}`. The current regression test passes for fixtures, but library sync lag, stale report IDs, or canonical URL spelling mismatch can leave a report item without a resolvable Locate target. No functional defect was reproduced in this run.

### P2: Source Text Analysis conditions

The view is gated by `shouldShowSourceTextAnalysis` and local tests cover equivalence, missing caption, multilingual differences, OCR/transcription, and extraction failure. Actual accuracy still depends on correct caption/transcript/OCR provenance; a bad upstream extraction can show or suppress incorrect text even when the conditional logic behaves as tested.

### Regression invariants to protect

- Never mutate authoritative URL/creator/caption/saved date from AI, reprocessing, or weaker provider results (`ContentService.safeMerge`, `content-service.ts`).
- Keep same content canonicalized consistently and distinct source IDs distinct.
- Keep user/workspace scope on reads, updates, deletes, worker reads, retrieval and future vector/document indexes.
- Preserve valid export imports when remote extraction fails.
- Never label absent media as authentic; retain explicit placeholder/failure behavior.
- Keep AI output evidence-grounded and distinguish verified source from generated material.
- Keep “Locate” ID reconciliation and historical report behavior.
- Preserve unlimited-import open-source behavior; do not reintroduce commercial entitlements or quota gates.

## Test coverage inventory (from `scripts/run-tests.ts`)

The suite contains parser/provider/normalization, import/retry/concurrency, tenant-isolation unit behavior, source immutability, transcript/OCR/AI gates, source text display, assistant retrieval 24-case evaluation, conversation history, thumbnail provenance, Razorpay webhook-policy tests, and an optional live DB test. Test names and source logic are present in the repository. The run total was 289; only the configured live DB query failed.
