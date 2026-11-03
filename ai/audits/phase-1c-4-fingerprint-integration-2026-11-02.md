# Keeper Phase 1C-4 — Fingerprint v1 Provider Integration

**Date:** 2026-11-02  
**Branch:** `open_source_keeper`  
**Scope:** Shared fingerprint v1 integrated into standalone PostgreSQL and MongoDB application persistence, with candidate-only compatibility reads for historical bare hashes. No schema, Supabase migration, stored-record backfill, or database operation was performed.

## Verdict

**PASS for local implementation and deterministic contract/source-wiring tests; live provider verification remains NOT RUN.** New standalone application writes calculate v1 fingerprints and clear stale values on short/empty text. Duplicate detection searches v1 and the appropriate historical candidates within the requested workspace. Fingerprint matches report a duplicate; they do not merge records.

## Fingerprint reads and writes inspected/covered

| Path | New writes / update behavior | Duplicate reads |
|---|---|---|
| PostgreSQL `PostgresStore.importMedia()` | Calculates v1 from the shared helper. Since the existing `BEFORE INSERT OR UPDATE OF payload` trigger overwrites the insert value with the historical bare hash, import performs a follow-up update of only `content_fingerprint`, inside the existing import transaction. A `null` v1 clears the trigger value for short/empty source text. | Workspace-scoped canonical URL/source identity plus `content_fingerprint = ANY(candidates)`. Candidates include v1, the historical TypeScript algorithm, and a legacy SQL-trigger candidate computed by the same PostgreSQL expression/collation. A match returns the existing record as duplicate with no merge write. |
| PostgreSQL generic media `insert` / `upsert` / payload `update` (`PostgresQuery`) | Payload writes run in a transaction. After the old trigger fires, each returned media row gets a fingerprint-only update based on its returned payload. This applies to the existing media API/sync and worker paths routed through the standalone provider. | These generic paths do not perform fingerprint deduplication; their existing URL/source identity behavior is unchanged. |
| PostgreSQL custom `updateCollection`, `updateTags`, and `reprocess` RPCs | Each payload update recomputes v1 and then writes only the fingerprint column. `updateTags` now makes its read/payload/fingerprint update atomic in a transaction. Source fields and payload JSON are passed through unchanged except for the existing operation's edits. | No fingerprint lookup in these update RPCs. |
| MongoDB `importMedia()` | Calculates and stores v1 in the existing import transaction. The value is `null` for short/empty content, replacing any prior value on an updated payload path. | Workspace-scoped canonical URL/source identity plus v1 and historical standalone JS candidates. A match returns duplicate metadata without updating/merging the existing media. |
| MongoDB generic media `insert` / `upsert` / payload `update` (`MongoQuery`) | Calculates v1 for media documents containing a payload. Short/empty values are explicitly set to `null`. Other collections are not given a fingerprint field. | Generic query writes do not perform fingerprint deduplication; existing behavior is unchanged. |
| MongoDB custom `updateCollection`, `updateTags`, and `reprocess` methods | Each payload update calculates v1 in the same document update, including null clearing. | No fingerprint lookup in these update methods. |
| Supabase-backed app paths | Inspected only. They continue to use Supabase RPCs/native client and the existing SQL trigger; this phase does not switch them to the TypeScript utility. | Existing Supabase import RPC performs workspace-scoped lookup using the legacy SQL hash. Migration work is still required for v1 plus dual-read parity. |

Repository search found no other application-level `content_fingerprint` calculation or lookup outside the two standalone stores and the existing Supabase/standalone SQL trigger and migrations. No migration or trigger definition was changed.

## Legacy compatibility

- **Historical standalone TypeScript/Mongo variant:** string fields in the approved order, joined with one ASCII space, trimmed, lowercased with JavaScript `toLowerCase()`, threshold checked with JavaScript UTF-16 `.length >= 80`, then unversioned lowercase SHA-256. `createLegacyContentFingerprint()` reproduces this behavior exactly for candidate generation only.
- **Historical PostgreSQL trigger variant:** PostgreSQL `lower(trim(concat_ws(' ', payload fields)))`, database `length() >= 80`, then `digest(...,'sha256')`. Import asks the same database to calculate this candidate from the JSON payload, preserving that database's lower/collation behavior. It also searches the former standalone JS candidate for rows created where the trigger was absent or bypassed.
- **Dual-read:** candidates are not written back. New insert/update writes set v1 only. No existing row is scanned, rewritten, or backfilled.
- **Not safely reproducible in every case:** values written by manual/external writers, custom triggers, or a prior database with different collation/locale rules may not be reconstructible from current source payload. Historical rows with unknown hash algorithms are left untouched; no automatic merge occurs if their digest does not match a recognized candidate.
- **Supabase:** the current SQL import procedure and trigger need a reviewed migration that calculates the same v1 bytes/normalization, dual-reads both SQL legacy and v1 candidates, and avoids stale trigger output on payload update. That migration must follow inventory and cross-provider golden-vector testing; it is not part of this pass.

## Tests

Added deterministic tests cover:

- Existing fingerprint golden vectors for empty/whitespace, 79/80/81 scalar values, supplementary emoji, multilingual text, NFC equivalence, case, whitespace, and field boundaries.
- Historical bare digest golden vector and v1/legacy candidate coexistence.
- Insert/update consistency for unchanged source fields; clearing after long-to-short and nonempty-to-empty updates.
- Exclusion of AI summaries, generated tags, and transcript fields from fingerprint inputs.
- Payload/provenance immutability during pure fingerprint calculation.
- Provider source-wiring checks for PG trigger override, payload writes, dual-read candidates, workspace-scoped lookups, Mongo writes, and duplicate-without-merge behavior.

These are unit/source-wiring tests. They do not invoke PostgreSQL/Mongo drivers against provider mocks or live services; therefore actual trigger order, SQL compatibility, and provider query execution are unverified.

## Verification

- `npm test` — **PASS**, 299/299 assertions. Opt-in Supabase RLS test skipped.
- `npm run type-check -- --incremental false` — **PASS**.
- Focused ESLint (`content-fingerprint.ts`, both stores, and test runner) — **PASS**, 0 errors; 25 existing warnings (24 in the test runner and one existing unused Mongo `_id` binding).
- `git diff --check` — **PASS**.
- No PostgreSQL, MongoDB, Supabase, or Docker service was accessed. No schema, migration, or stored fingerprint was modified.

## Exact files modified for this pass

- `src/services/content-fingerprint.ts`
- `src/lib/database/postgres-store.ts`
- `src/lib/database/mongodb-store.ts`
- `scripts/run-tests.ts`
- `ai/audits/phase-1c-4-fingerprint-integration-2026-11-02.md` (new)

## Remaining limitations

- PostgreSQL's existing trigger remains legacy code. Standalone application writes override its value after each payload mutation, but SQL writes performed outside the application can still write legacy fingerprints until a reviewed schema migration.
- Supabase does not yet use the shared TypeScript v1 contract; the needed SQL migration and its RLS/provider verification remain outstanding.
- Provider concurrency, trigger execution order, Mongo update semantics, and live duplicate compatibility were not tested against an isolated database. No backfill has occurred, so old records retain their existing fingerprint format until a future update or migration.

