# Keeper Phase 1C-2 — Workspace Assignment Integrity

**Date:** 2026-11-02  
**Branch:** `open_source_keeper`  
**Scope:** Assignment parent ownership checks for standalone PostgreSQL and MongoDB. No schema, migration, index, Supabase policy, quota, fingerprint, or billing changes were made.

## Verdict

**PASS for the local workspace-integrity implementation and deterministic mock tests. Live PostgreSQL, MongoDB, and Supabase provider verification remains BLOCKED / NOT RUN.** Both standalone assignment writers now validate workspace ownership of media and optional collection parents before writing, inside their provider transaction.

## Assignment paths inspected

- `src/lib/database/postgres-store.ts` handles RPC `keeper_record_ai_assignment` through `PostgresStore.recordAssignment()`.
- `src/lib/database/mongodb-store.ts` handles the same RPC through `MongoStore.recordAssignment()`.
- The only application call to `keeper_record_ai_assignment` found is `src/app/api/ai/worker/route.ts`, after a worker has claimed a job and loaded its media under the claimed `workspace_id`. The worker supplies `job.workspace_id` and `job.media_id` from that server-side claim.
- Authenticated server clients for standalone stores derive the workspace from verified Supabase Auth in `createBackendServerClient()` and overwrite caller-supplied RPC `p_workspace_id` in `src/lib/database/backend-client.ts`. The privileged worker uses the trusted claimed job context.
- `keeper_update_media_collection` and `/api/media/[id]/collection` update the selected collection in the media payload; they are not writers of `keeper_workspace_assignments`. Their parent checks are separate and unchanged.

## Changes implemented

- Added `src/services/workspace-assignment-contract.ts`, a provider-neutral persistence orchestration contract. It checks required identifiers, reads parent owners, rejects a missing/mismatched media parent with generic `MEDIA_NOT_FOUND`, rejects a missing/mismatched collection with generic `COLLECTION_NOT_FOUND`, and invokes the assignment write only after all checks pass.
- PostgreSQL now starts a transaction, reads media ownership by ID with `FOR KEY SHARE`, reads the optional collection scoped to the requested workspace with `FOR KEY SHARE`, validates both parents, then performs the existing assignment upsert. Success commits; validation or write failure rolls back and propagates the generic error.
- MongoDB now wraps both parent lookups and the existing assignment upsert in `session.withTransaction()`. The media lookup checks its owner; the collection lookup is scoped by both workspace and collection ID. The session is ended in `finally`. Existing document shape and indexes are unchanged.
- Malformed/missing workspace or media IDs and non-string/empty collection IDs are rejected before parent queries. Errors do not include foreign workspace identifiers or record data.

## Tests

Added isolated mock coverage to `scripts/run-tests.ts` using the same `persistWorkspaceAssignment()` orchestration called by both providers:

1. Same-workspace media and collection succeeds.
2. Media from another workspace is rejected.
3. Collection from another workspace is rejected.
4. Missing media is rejected.
5. Missing collection is rejected.
6. Updating an assignment with an invalid parent is rejected without changing existing rows.
7. Mock transaction rolls back after failed validation and does not commit the invalid write.
8. Workspace B's pre-existing assignment remains unchanged; Workspace A receives only generic not-found errors.

Provider-wiring assertions also confirm PostgreSQL parent row locks/rollback and MongoDB transaction use. These are local unit/mock and source-wiring checks, not live database integration tests.

## Verification results

- `npm test` — **PASS**, 297/297 assertions. The opt-in live Supabase RLS check was skipped.
- `npm run type-check -- --incremental false` — **PASS**.
- Focused ESLint on the two stores, shared contract and test runner — **PASS**, 0 errors; 25 warnings remain in pre-existing code (24 in the large test runner and one existing Mongo store unused binding).
- `git diff --check` — **PASS**.
- No provider database, Supabase, or Docker service was accessed.

## Modified files for this pass

- `src/lib/database/postgres-store.ts`
- `src/lib/database/mongodb-store.ts`
- `src/services/workspace-assignment-contract.ts` (new)
- `scripts/run-tests.ts`
- `ai/audits/phase-1c-2-workspace-integrity-2026-11-02.md` (new)

## Remaining provider limitations

- PostgreSQL locking and rollback behavior have not been exercised against the isolated test database. The mock verifies the shared ordering and rollback contract; it cannot prove SQL compatibility or actual driver behavior.
- MongoDB's transaction path requires a replica set. No MongoDB test service was started, initialized, or contacted, so actual transaction semantics remain unverified.
- Supabase RPC/RLS behavior was not changed and was not live-tested. This standalone-provider fix does not establish Supabase policy correctness.
- MongoDB has no foreign keys; parent validation inside a transaction reduces dangling references, but provider-level behavior under concurrent parent deletion still needs dedicated replica-set integration tests.

