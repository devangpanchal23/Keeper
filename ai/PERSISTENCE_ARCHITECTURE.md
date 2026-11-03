# Persistence Architecture — Phase 1 Corrective Pass

## Status boundary

- **Implemented and locally tested:** authenticated media reads now distinguish a successful empty library from authentication, configuration, and backend failures. `syncWorkspace` validates the server read before migrating legacy keys, uploading local records, reconciling, or replacing the cache. API failures use generic client messages. The deterministic tests cover response classification.
- **Implemented but not live-tested:** the route and client sync changes. No database provider or authenticated app server was available for end-to-end verification.
- **Documented design only:** durable outbox, tombstones, versioning, conflict resolution, resumable backfill, exports, and rollback. No schema or migration was applied.
- **Blocked:** end-to-end convergence and provider acceptance tests need disposable Supabase, PostgreSQL, and MongoDB environments.

## Current contract and flow

For authenticated users, a successful backend write is the cross-device record. Browser storage remains an immediate UI cache and offline/local-only store. A browser-only save is not guaranteed to exist on another device until accepted by the server. Server reads must be successful and authenticated before local state can be reconciled against them.

| Operation | Current behavior | Failure/recovery status |
|---|---|---|
| Create item | `ContentService.addItem` writes local state first; `RecallContext.addItem` asynchronously POSTs `/api/media`. The API returns saved rows and server IDs on success. | Failure sets sync error and shows a warning; no durable retry entry exists. A later sync may upload a record absent from the server, but cannot guarantee convergence of all fields. |
| Read/sync items and collections | `readWorkspaceMedia` classifies success (including empty), auth, configuration, and unavailable outcomes. `syncWorkspace` successfully preflights both media and collection GETs before legacy migration, upload, or cache replacement. Collection GET returns non-success on auth/configuration/query failures instead of default seeds. | On failed preflight read, local items and collections are retained and `syncStatus` becomes offline. A successful empty media read is valid and is followed by local-only backfill before cache replacement. |
| Legacy backfill | `MigrationService.migrateLegacyData` merges anonymous/legacy items into the user's local store, then `/api/media/sync` imports records not yet on server. | Starts only after successful media GET. Local values are retained on HTTP failure; the legacy source keys are cleared by the existing migration service after its local merge, so preservation relies on the user-scoped browser copy. This is not a durable migration ledger. |
| Update/notes/edit | `ContentService.updateItem` changes local state, then an async PATCH is sent to `/api/media/{id}`. Server route workspace-scopes lookup/write and uses `safeMerge`. Local UI message says “Updated on this device.” | Non-success/network failure sets sync error and shows a warning, but client does not persist a retry or await acknowledgment for ordinary edits. A subsequent matched-record sync does not reliably replay every local edit. |
| Favorite/archive/trash/restore | Local state changes first; PATCH is sent asynchronously. | Request failure is not durably queued. Next server reconciliation can overwrite or resurrect state; this is not guaranteed recovery. |
| Permanent delete/empty trash | Local record is removed first; server DELETE is sent asynchronously and workspace-scoped. | Without a tombstone, failed/offline delete can cause server copy to reappear on next successful sync. Do not treat the local delete as cross-device durable. |
| Collections | `CollectionService` updates local state before POST/DELETE to `/api/collections/sync`; `syncWorkspace` fetches and saves server collections. Mutation HTTP failures are surfaced by the client sync error/toast; the API no longer reports missing auth/backend/write failure as local-only success. | Calls are not durably queued; collection deletion followed by item unlink may partially commit and returns an explicit partial failure. A later manual correction may be required. |
| Item-to-collection membership | Local item/collection state updates, then media/collection endpoint requests are sent. Some flows send more than one independent request. | Partial success is possible; there is no transaction/outbox joining collection and item membership. |
| Reprocess | AI result is written locally, then PATCH/POST is sent asynchronously. | Failed server persistence is not durably retried. Generated output is locally retained; server convergence is not guaranteed. |

`GET /api/media` no longer asynchronously deletes duplicate database rows as a read side effect. It still deduplicates the response in memory. `/api/media/sync` no longer reports a backend exception as a successful local-only sync and checks key write/read errors. Individual APIs still need deeper transaction and concurrency verification.

### Mutation acknowledgment semantics

Local mutation completion means only that the browser cache changed. It does **not** mean the server acknowledged the mutation. Creation has a response path that can attach `serverMediaId`; most update/delete/collection handlers do not await and reconcile server acknowledgment. The UI labels save/update as local and reports HTTP/network mutation failures through sync error state and a warning toast. Network failures can still leave the device cache newer than the server; this signal is not a durable retry mechanism.

No speculative last-write-wins policy is in effect. `ContentService.safeMerge` protects source fields and selected user fields in specific paths, but it is not a complete conflict resolver. The system cannot currently prove which same-field edit is newer across devices.

## Convergence design (not implemented)

### Client mutation/outbox state machine

Each user mutation must be committed atomically to the local cache and a durable local outbox entry before the UI reports it as locally saved. Each operation carries a stable client-generated UUID idempotency key, workspace ID from the authenticated session (never trusted from client payload), entity ID, operation kind, changed fields or tombstone, base server revision, local sequence, created time, and attempt/next-attempt metadata. Sensitive source tokens and credentials never enter the outbox.

Suggested states:

```text
local-only -> queued -> sending -> acknowledged
                    |      |
                    |      +-> retry-wait -> sending
                    +-> conflict -> user-review/resolution -> queued
                    +-> rejected (auth/validation) -> visible error; retain payload
```

Acknowledgment records the server revision and canonical ID, then removes or marks the outbox operation delivered in the same local transaction that updates the cache metadata. A failed transport or 5xx uses bounded exponential backoff with jitter and a maximum delay, but the operation remains durable. A 401 pauses the queue until reauthentication; a 4xx validation/authorization error is surfaced and is not blindly retried. The server stores idempotency keys under a unique `(workspace_id, operation_id)` constraint so retries return the original outcome rather than duplicate inserts/deletes.

### Server versions and conflict detection

Every persisted media record gets a monotonically increasing `revision` (or equivalent opaque version) and `updated_at`. An update includes `base_revision`; the backend performs compare-and-swap (`WHERE revision = base_revision`) and increments the revision transactionally. A stale base returns a typed conflict with the current server version. The client must not overwrite it silently.

Use field ownership to avoid treating the full JSON payload as one last-write-wins object:

- Immutable/source-owned fields (canonical URL, source identity, source provenance, captured source text) can only be changed by trusted ingestion/reprocessing paths with explicit provenance and a source version.
- User-owned fields (notes, favorite, archive/trash, collection membership) use per-field version/operation records or explicit conflict review. Independent fields can merge; concurrent edits to the same field are surfaced.
- Generated AI fields are separate derived data with model/prompt/source revision metadata and cannot overwrite source/user fields.

The first release should favor conflict reporting and explicit resolution over automatic merge of same-field user edits. Collection membership requires transactionally updating the item/collection relationship and the outbox acknowledgment.

### Delete tombstones

Permanent deletion first writes a local tombstone carrying entity ID, operation ID, workspace, base revision, and deletion time. The UI may hide the item, but the tombstone is retained until server acknowledgment. The server records a workspace-scoped soft-delete/tombstone and revision; retries are idempotent. Tombstone retention must exceed maximum client offline duration and export/restore policy. Hard purge is a later retention task after dependent analyses/jobs are handled and all supported clients have observed the deletion. Trash/restore remain ordinary versioned state changes, distinct from permanent deletion.

### Offline-to-online reconciliation and partial failures

1. Authenticate and read server records. If the read is 401/configuration/unavailable, retain cache and outbox unchanged; do no upload or deletion.
2. Pull changed server rows (eventually by cursor/revision), then overlay only locally acknowledged state and pending outbox operations. Never infer a delete from an absent row unless a complete, successful snapshot or explicit tombstone cursor proves absence.
3. Submit outbox operations in per-entity order with idempotency keys. A partial batch records each operation's result independently; successful operations are acknowledged, failed operations remain queued.
4. On version conflict, save the server version locally beside the pending version and mark the operation conflict. Do not advance its base revision automatically.
5. After uploads, pull server acknowledgments/canonical IDs and persist the merged cache plus outbox acknowledgments in one browser transaction. If this local transaction fails, server idempotency makes the replay safe.
6. Expose sync state (`synced`, `queued`, `offline`, `conflict`, `rejected`) and last successful server cursor. A transport failure must never clear the queue or report `synced`.

Representative failure outcomes:

| Failure | Required behavior |
|---|---|
| Server read times out before upload | Keep local cache and outbox unchanged; show offline/error. |
| Server commits write but response is lost | Retry same operation ID; server returns prior acknowledgment without duplicate. |
| Two devices edit different fields | Merge only fields with independent ownership/version; preserve source fields. |
| Two devices edit same user field from same base revision | Return conflict and retain both values for resolution. |
| Client goes offline after local delete | Hide locally with tombstone; never let a pull resurrect it; retry later. |
| Batch partially commits then process stops | Acknowledge known operations individually; retry unknown operations idempotently. |
| Cache write fails after server acknowledgment | Replay acknowledgment by operation ID and repair local cache; do not discard outbox until local durable acknowledgment. |

### Legacy backfill, export, and rollback

Backfill is a resumable, idempotent job per workspace. It snapshots legacy records into a migration ledger before sending, uses canonical identity plus an explicit collision report, and never overwrites non-empty user notes/favorites/collection links without an explainable field-level conflict. Each batch has a checkpoint and operation IDs; failed/conflicted rows remain in the ledger. Legacy browser keys are not removed until the user-scoped copy, server acknowledgment, and an export/restore checkpoint are verified. Users can download a versioned JSON export of records, collections, source provenance, and pending/conflicted operations before migration.

Rollback is forward-safe: stop new writes, export server plus pending local operations, retain legacy data, and replay acknowledged operations into the prior representation only through a reviewed conversion. Do not reverse destructive deletes. Keep a migration audit ledger with counts/checksums, conflict dispositions, and per-workspace checkpoint. Restore test must prove a sample export can recreate the pre-migration logical library.

### Minimum schema delta (design only)

| Logical structure | Supabase | Standalone PostgreSQL | MongoDB |
|---|---|---|---|
| Record version | `keeper_media.revision BIGINT NOT NULL DEFAULT 1`; update trigger/function or CAS SQL; index `(workspace_id, updated_at, id)` | Same column/CAS semantics in `database/postgres` DDL; workspace/change cursor index | `revision` field; atomic conditional update on `{workspace_id,id,revision}`; compound cursor index |
| Server idempotency | `keeper_mutations` with `workspace_id`, `operation_id`, result/revision; unique pair; RLS and grants | Equivalent table, unique pair, workspace FK/constraints, transactional insertion+media mutation | Dedicated mutations collection or embedded per-record bounded operation ledger; unique `(workspace_id,operation_id)` index; transactions required for cross-document result |
| Delete tombstone | Soft-delete/tombstone columns or `keeper_tombstones`; owner RLS, unique operation ID, retention index | Equivalent soft-delete/tombstone relation and indexes; transaction with mutation ledger | Tombstone document/fields with unique operation identity; transaction for ledger+record where cross-document |
| Field conflict evidence | Optional `keeper_field_revisions` for user-owned fields, FK/RLS/indexes | Equivalent relation and CAS constraints | Per-field revision map or conflict collection; schema validation and indexes |
| Backfill ledger | `keeper_migration_runs` / `keeper_migration_items`; workspace RLS, unique source identity/checkpoint | Equivalent tables and transaction semantics | Migration-run and item collections with unique workspace/source keys and checkpoint indexes |

Avoid duplicating the full payload into the outbox table: store a validated patch/tombstone and operation metadata; encrypt sensitive fields at rest according to the deployment model. All three providers must agree on idempotency, CAS, transaction, tombstone, and retention semantics before rollout. Supabase requires migration/RLS/RPC updates; PostgreSQL requires a versioned upgrade path (not currently present); MongoDB requires runtime index migration with replica-set transactions. None of these changes are applied.

## Verification limits and prerequisites

Locally tested response parsing and source behavior do not establish live database correctness. Before implementing convergence, add authenticated route tests for the read-before-write invariant, per-operation mutation acknowledgments, idempotency, concurrent updates, tombstone replay, partial batch recovery, and cache crash recovery. Then run two-user isolation and provider parity suites on disposable Supabase, PostgreSQL, and MongoDB replica-set fixtures. Do not claim provider parity until each has passed.
