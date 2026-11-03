# Keeper Phase 1C-6B — Supabase Migration Hardening

**Date:** 2026-11-02
**Branch:** `open_source_keeper`
**Scope:** Hardening review findings in the unapplied Phase 1C-6 migration. Static-only; no database access or SQL execution.

## Result

**PASS for local migration hardening and static verification; NOT applied or live-verified.**

The migration now computes windows with fixed 604,800-second elapsed-time arithmetic, truncates the workspace anchor to milliseconds to match JavaScript `Date`, and avoids calendar-day arithmetic. Its `SECURITY DEFINER` search path is limited to `pg_catalog`. Because repository migrations use `CREATE EXTENSION IF NOT EXISTS pgcrypto` without an explicit schema, the migration discovers the installed extension namespace from PostgreSQL catalogs and calls a quoted, schema-qualified `digest` using bound values. It does not guess an extension schema.

## Phase 1C-6A findings disposition

| 6A finding | Phase 1C-6B disposition | Remaining verification |
|---|---|---|
| Calendar `interval '7 days'` could vary across DST/timezone settings. | **Addressed in source:** cycle boundaries use epoch seconds and add exactly 604,800 seconds; anchor is millisecond-truncated. | Execute boundary/DST tests on a disposable Supabase instance. Clock skew between DB and application hosts can still cause adjacent cycle assignment near a boundary. |
| `SECURITY DEFINER` used `search_path = public, auth`, and `digest` was unqualified. | **Hardened in source:** `search_path = pg_catalog`; tables and `auth.uid()` are qualified; actual `pgcrypto` namespace is resolved from `pg_extension` and interpolated only as `%I`, while hash inputs are bound parameters. | Confirm effective function owner, grants, extension namespace, and schema ACLs against a disposable project. |
| Function owner/effective grants could not be verified statically. | Migration continues to rely on `CREATE OR REPLACE` preserving owner/ACL, then reasserts `PUBLIC`/`anon` revocation and `authenticated` grant. | Catalog inspection after applying to a disposable project; do not infer deployed role state from repository SQL alone. |

## Exact changes

### Cycle arithmetic

- Captures `v_now` once with `clock_timestamp()` after acquiring the workspace anchor lock, avoiding stale transaction-start time after lock waits.
- Selects the workspace's `free_cycle_anchor` truncated to milliseconds.
- Calculates `cycle_start = anchor_epoch + floor((now_epoch - anchor_epoch) / 604800) * 604800` through `to_timestamp`.
- Calculates `cycle_end = cycle_start_epoch + 604800` through `to_timestamp`.
- Removes calendar interval arithmetic from cycle calculation. Epoch arithmetic is independent of session timezone/DST; persisted values remain `timestamptz`.

### Definer-function name resolution

- Changes the function search path to `pg_catalog` only.
- Keeps `auth.uid()` explicitly qualified and every application table under `public.`.
- The repository's historical extension declarations do not pin a schema. The function therefore joins `pg_catalog.pg_extension` to `pg_catalog.pg_namespace`, obtains the `pgcrypto` namespace, and uses `pg_catalog.format('%I.digest($1::text, $2::text)', schema)` with `EXECUTE ... USING` for values. Missing extension raises a controlled database exception before media/ledger writes.
- `pg_catalog` built-ins are either explicitly qualified where security-sensitive or resolved only through the catalog-only search path. `EXTRACT` remains SQL syntax, not an unqualified user-defined function call.
- No grants, RLS, authentication, workspace predicates, fingerprint inputs/algorithm, tables, or historical migration files changed.

## Tests

Expanded static contract coverage checks:

- Fixed 604,800-second start/end calculations and absence of calendar `7 days` arithmetic in cycle logic.
- Millisecond anchor truncation.
- Catalog-based extension namespace resolution, quoted `%I` qualification, bound digest arguments, and catalog-only function search path.
- Existing function signature, RPC result fields, workspace authorization, role grants, normalized ledger shape, and no destructive/unrelated SQL.

These tests read source text only. They do not parse PL/pgSQL, resolve extension catalog rows, or prove function execution, schema privileges, rollback, or RLS behavior.

## Verification

- `npm test` — **PASS**, 300/300; opt-in live Supabase RLS test skipped.
- `npm run type-check -- --incremental false` — **PASS**.
- `npx eslint scripts/run-tests.ts` — **PASS**, 0 errors and 24 warnings in pre-existing test-harness code outside the changed test block.
- `git diff --check` — **PASS**; the new migration and audit report also pass a trailing-whitespace check.
- SQL execution, database connections, Supabase, and Docker — **NOT RUN**.

## Remaining assumptions and live checks

1. A disposable project must confirm the extension catalog row and that the definer owner can execute `digest(text,text)` in the extension namespace. The implementation intentionally discovers, rather than assumes, the namespace.
2. Verify the effective owner and ACL after `CREATE OR REPLACE`, including no effective execute access for `PUBLIC`/`anon` and the intended `authenticated` permission.
3. Verify `auth.uid()` under `SECURITY DEFINER`, cross-workspace rejection, and table RLS/privilege behavior in the actual Supabase setup.
4. Exercise duplicate and concurrent imports, and force media/ledger/job failures to confirm runtime rollback.
5. Exercise exact cycle boundaries and dates around DST changes. The arithmetic is fixed-duration and timezone-independent by inspection; live timestamps are not verified.

No migration was applied. No historical data or working-tree changes outside this task were intentionally modified.

## Files changed for Phase 1C-6B

- `supabase/migrations/202611020001_phase_1c_6_oss_import_entitlements.sql`
- `scripts/run-tests.ts`
- `ai/audits/phase-1c-6b-supabase-migration-hardening-2026-11-02.md`
- `ai/audits/phase-1c-6-supabase-oss-entitlement-2026-11-02.md` (6A findings disposition)
- `ai/CURRENT_STATUS.md`
- `ai/CHANGELOG_AI.md`
- `ai/HANDOFF.md`
