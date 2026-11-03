# Keeper Phase 1C-5 — OSS Usage Entitlements

**Date:** 2026-11-02  
**Branch:** `open_source_keeper`  
**Scope:** Application-level OSS entitlement and usage normalization for standalone PostgreSQL and MongoDB, plus safe usage API behavior. No migrations, schema changes, live database calls, Supabase calls, or Docker operations.

## Verdict

**BLOCKED for cross-provider completion.** Standalone PostgreSQL and MongoDB import code no longer consults subscriptions or enforces Free/Basic/Pro quotas, and writes normalized usage in the same transaction as each new media/job record. The Supabase import RPC still enforces plan quotas and writes subscription-derived event/plan values. Its logic is in existing SQL migrations; changing this behavior requires a reviewed database function migration, which this task explicitly prohibits. That path is not claimed unlimited.

Locally, `npm test` and type checking passed. Store behavior was checked through deterministic source-wiring tests, not live provider transactions.

## Findings and changes

### Entitlement and quota paths

| Path | Before | This pass | Verification |
|---|---|---|---|
| Bulk import UI/service | Existing OSS path accepts imports without checking remaining quota; local usage totals expand as imports succeed. | No change. | Existing 1,000-item simulation and zero-remaining tests pass. |
| Standalone PostgreSQL `PostgresStore.importMedia()` | Read `billing_subscriptions`, derived a plan/cycle, counted usage and raised `CREDIT_LIMIT_REACHED` at Free/Basic ceilings. | Removed subscription lookup and quota branch. Uses a seven-day cycle anchored at `keeper_workspace_memory.free_cycle_anchor`. | Source-wiring assertion; no PG service was contacted. |
| MongoDB `MongoStore.importMedia()` | Read `billing_subscriptions`, derived plan/cycle, counted usage and raised `CREDIT_LIMIT_REACHED`. | Removed subscription lookup and quota branch. Uses the same weekly workspace-anchored cycle. | Source-wiring assertion; no Mongo service was contacted. |
| Supabase `keeper_import_media` | Existing migrations enforce Free/Basic limits, read subscriptions, and emit `IMPORT_CREDIT`/subscription plan for paid plan records. | Not changed: this is database function logic and a migration is required. The `/api/ingest` route now returns 503 on any RPC error instead of treating a quota rejection as a successful import. | Static migration inspection only; Supabase not contacted. |
| Checkout, billing, webhook routes | Subscription/payment state is used to manage billing lifecycle and checkout policy. | Preserved; not part of OSS import authorization. Historical billing/payment/webhook records are untouched. | Static route/service inspection; no billing provider contacted. |

### Normalized ledger behavior

`src/services/usage-ledger-contract.ts` now defines the OSS entitlement independently from subscriptions, provides a shared weekly cycle calculation, and creates a ledger row only for outcome `created`. Its normalized fields are `event_type=FREE_IMPORT`, `plan=free`, `amount=1`, and ISO `cycle_start`/`cycle_end`.

- PostgreSQL writes the media row, normalized usage row, and AI job inside its existing transaction. Failures roll back the transaction. Duplicate detection returns before the ledger insert.
- MongoDB writes media, usage, and job inside the existing replica-set transaction. Duplicate detection returns before the ledger insert. Transaction behavior is statically inspected/simulated only.
- Existing historical ledger, subscription, payment, webhook, and failure records are not rewritten or deleted.
- Supabase continues to use its SQL RPC transaction, but the event and plan are still determined by existing subscription SQL until a future migration updates the function.

### Usage API

`/api/usage` continues to report `plan=open-source`, `total=null`, `remaining=null`, and `unlimited=true`. It now queries the configured provider through the shared backend client. A successful exact ledger count is returned as `used` with `usageAvailable=true`. Missing configuration, query failure, or unavailable count returns HTTP 503 with `used=null` and `usageAvailable=false`; unauthenticated requests return 401. The endpoint does not infer a zero count from an error.

The count is the number of retained ledger events for that workspace (currently the route’s all-time count), not a quota or subscription-cycle allowance.

## Tests and verification

- Added deterministic assertions for the canonical event shape, weekly cycle boundaries, duplicate/no-op exclusion, unlimited entitlement with usage above 30/300, and independence from active/cancelled/expired subscription statuses.
- Added source-wiring assertions that PG/Mongo import functions contain no subscription lookup or quota rejection, and that ledger writes remain in their transaction paths.
- Added usage API assertions for unlimited output and explicit unavailable state, and an ingest assertion against false success on RPC rejection.
- Existing bulk-import tests simulate 1,000-item import and zero remaining local allowance.
- **Not provider tests:** no driver mocks exercised SQL/Mongo query calls; no transaction rollback was executed against a DB.

Commands:

- `npm test` — **PASS**, 299/299 assertions; live Supabase RLS test skipped.
- `npm run type-check -- --incremental false` — **PASS**.
- `npx eslint src/services/usage-ledger-contract.ts src/lib/database/postgres-store.ts src/lib/database/mongodb-store.ts src/app/api/usage/route.ts src/app/api/ingest/route.ts scripts/run-tests.ts` — **PASS**, 0 errors and 25 warnings in existing test-runner and Mongo adapter lines.
- `git diff --check` — **PASS**.

## Remaining blockers and prerequisites

1. Supabase needs a reviewed migration replacing `keeper_import_media` to remove subscription/quota enforcement, use the OSS workspace cycle, and write exactly `FREE_IMPORT/free/1`. Until deployed, Supabase imports can still be blocked by historical subscription/usage state, returning 503 rather than a false success.
2. Provider-level transaction and usage API verification requires explicitly disposable PostgreSQL/MongoDB and Supabase Auth/RLS environments. None was used in this pass.
3. Schema parity is assumed from the checked-in provider schemas: both PostgreSQL schema definitions include `amount` with a default/check and cycle columns. MongoDB is schemaless; runtime index behavior was not tested. No schema was applied.

## Exact files changed for this pass

- `src/services/usage-ledger-contract.ts`
- `src/lib/database/postgres-store.ts`
- `src/lib/database/mongodb-store.ts`
- `src/app/api/usage/route.ts`
- `src/app/api/ingest/route.ts`
- `scripts/run-tests.ts`
- `ai/audits/phase-1c-5-oss-usage-entitlements-2026-11-02.md`
- `ai/CURRENT_STATUS.md`
- `ai/CHANGELOG_AI.md`
- `ai/HANDOFF.md`
