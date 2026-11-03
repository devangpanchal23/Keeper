# Keeper Phase 1C-6 — Supabase OSS Import Entitlement Parity

**Date:** 2026-11-02
**Branch:** `open_source_keeper`
**Verdict:** **PASS for migration creation and static review; NOT applied or live-verified.**

## Scope and evidence

The latest checked-in definition of `public.keeper_import_media(text,jsonb,text)` is in `supabase/migrations/202610070003_universal_ai_reprocessing.sql` (the earlier definition in `202610070001_ai_media_architect.sql` is superseded by its later `CREATE OR REPLACE`). The app caller is `src/app/api/ingest/route.ts`; it passes canonical URL, payload, and idempotency key, then consumes `media_id`, `status`, and `duplicate`.

The previous function:

- derived workspace from `auth.uid()` and rejected unauthenticated calls;
- serialized workspace imports with an advisory transaction lock;
- scoped canonical URL, source identity and fingerprint duplicate searches to `workspace_id`;
- selected `billing_subscriptions`, set plan/cycle limits, counted the cycle ledger, and raised `CREDIT_LIMIT_REACHED`;
- created media, wrote a plan-derived `FREE_IMPORT` or `IMPORT_CREDIT` event, and queued an AI job in the RPC transaction;
- ran `SECURITY DEFINER` with `search_path = public, auth`; revoked execution from `public` and `anon`, then granted it to `authenticated`.

Static migration inspection cannot reveal the owner or effective deployed grants of a live function. PostgreSQL `CREATE OR REPLACE FUNCTION` preserves function identity, owner and existing ACL; the migration explicitly reasserts the current narrow role grant. Runtime owner, ACL, and RLS behavior remain unverified until a disposable Supabase project is available.

## Migration behavior

Created `supabase/migrations/202611020001_phase_1c_6_oss_import_entitlements.sql`. It changes only the import function body and reasserts its existing execute grant. It does not edit historical migrations, create/drop tables, modify RLS, rewrite ledger history, or change billing records.

The replacement preserves the function signature, `auth.uid()` ownership derivation, invalid-auth/input errors, advisory lock, all workspace-scoped duplicate checks, legacy SQL fingerprint behavior, conflict handling, media insertion, AI job insertion, transaction atomicity, security-definer mode, fixed search path, and caller-visible response keys. It removes all subscription reads and plan quota calculations. `used` remains an event count for the current workspace-anchored seven-day window; `remaining` is JSON null.

For a new media row it inserts exactly one event with `event_type=FREE_IMPORT`, `plan=free`, `amount=1`, and the workspace-anchor-derived `cycle_start`/`cycle_end`. The cycle calculation matches `getOssImportCycle(now, free_cycle_anchor)` in `src/services/usage-ledger-contract.ts`: the current seven-day window starts at the anchor plus the floor of elapsed seven-day intervals. SQL truncates the anchor to milliseconds to match JavaScript `Date` precision in standalone PostgreSQL and MongoDB. Clock skew or a request exactly at a cycle boundary can still select adjacent cycles across separately timed providers; ledger writes themselves use the cycle returned in that import transaction. Existing `(workspace_id, media_id)` uniqueness protects ledger cardinality. Duplicates return before the ledger insert; later insert/job errors abort the function transaction. No historical rows are rewritten.

## Safety and compatibility review

- **RLS/auth:** No policy or table privilege changes. The authenticated RPC still obtains its tenant from `auth.uid()` and never accepts a caller-provided workspace ID.
- **Function security:** `SECURITY DEFINER` and `search_path = public, auth` are retained. Grant remains restricted to `authenticated`, with `public` and `anon` revoked. No owner change is issued.
- **Dependencies:** Relies on existing `keeper_media`, `keeper_workspace_memory.free_cycle_anchor`, `keeper_usage_ledger.amount/cycle_start/cycle_end`, `keeper_ai_jobs`, `pgcrypto.digest`, and existing uniqueness constraints. No schema changes are included. Presence/validity in a deployed database is not verified here.
- **RPC compatibility:** Existing response keys remain (`duplicate`, `media_id`, `status`, `plan`, `used`, `remaining`, `cycle_end`); duplicate response remains its existing smaller shape. `/api/ingest` already treats RPC errors as failures and reads the retained fields.
- **Billing history:** Subscription, payment, webhook, failure, and old usage records remain untouched. Commercial entitlement logic remains out of this open-source import path.

## Tests and verification

Added static SQL tests for quota/subscription removal, >30/>300 OSS entitlement, normalized single ledger insertion, duplicate ordering, atomic write ordering, auth/workspace scoping, grants/security settings, caller response compatibility, and absence of destructive/unrelated SQL. These tests inspect source only; they do not parse or execute SQL and do not prove deployed RLS/function behavior.

- `npm test` — **PASS**, 300/300; opt-in live Supabase RLS test skipped.
- `npm run type-check -- --incremental false` — **PASS**.
- `npx eslint scripts/run-tests.ts` — **PASS**, 0 errors and 24 warnings in existing test harness code outside the new test block.
- `git diff --check` — **PASS**.
- Supabase/PostgreSQL/MongoDB and Docker — **NOT RUN**, as required.

## Migration and rollback considerations

This is a forward-only migration. Applying it changes only future import behavior and future ledger events. A rollback would need a separately reviewed forward migration restoring a prior function body; doing so reintroduces legacy quotas and may block new imports based on historical usage. It does not require deleting or rewriting the newly normalized rows. The migration has not been applied, so application order, SQL syntax against the deployed schema, effective owner/ACL, and end-to-end Auth/RLS behavior still require verification in a disposable Supabase environment before release.

## Exact files changed for Phase 1C-6

- `supabase/migrations/202611020001_phase_1c_6_oss_import_entitlements.sql` — new, unapplied migration.
- `scripts/run-tests.ts` — deterministic static migration contract checks.
- `ai/audits/phase-1c-6-supabase-oss-entitlement-2026-11-02.md` — this report.
- `ai/CURRENT_STATUS.md`, `ai/CHANGELOG_AI.md`, `ai/HANDOFF.md` — phase status and handoff notes.

## Phase 1C-6A review follow-up

The Phase 1C-6A review identified timezone-dependent calendar-day arithmetic and a broad `SECURITY DEFINER` search path with unqualified `digest`. Phase 1C-6B narrows the search path, resolves the installed pgcrypto namespace from catalogs for a schema-qualified digest call, and uses fixed epoch seconds for cycle calculations. See `ai/audits/phase-1c-6b-supabase-migration-hardening-2026-11-02.md` for the exact disposition. These are source-level mitigations only; function owner/ACL, extension namespace/permissions, SQL execution and RLS remain unverified live.
