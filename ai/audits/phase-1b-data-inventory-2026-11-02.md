# Keeper Phase 1B — Read-Only Data Inventory & Compatibility Verification

**Date:** 2026-11-02
**Branch:** open_source_keeper
**Approved decisions:** unlimited open-source imports; separate future commercial entitlement adapter; versioned fingerprint v1 approved; provider-specific workspace cleanup with explicit ownership checks approved.
**Scope:** read-only local inventory. No SQL writes/DDL, schema application, environment-file reads, application-source changes, service lifecycle changes, Supabase access, or MongoDB connections.

## Executive result

**BLOCKED for implementation readiness.**

The dedicated PostgreSQL test container and database were identified and queried read-only. PostgreSQL 17.11 is running in the named test container, but the database has no non-system base tables and no Keeper schema/data to inventory. The schema was not applied.

No container named keeper-local-test-mongodb exists. No MongoDB connection was attempted and no service was started. Supabase was not accessed. Provider data mismatch counts are therefore unavailable; PostgreSQL Keeper-table counts are N/A because those tables do not exist, not observed zero-row results.

## 1. PostgreSQL inventory

### Database identity

Read-only container metadata command:

    docker inspect keeper-local-test-postgres --format='name={{.Name}} image={{.Config.Image}} state={{.State.Status}} health={{.State.Health.Status}} ports={{json .NetworkSettings.Ports}} mounts={{range .Mounts}}{{.Name}}:{{.Destination}};{{end}}'

Observed: name /keeper-local-test-postgres; image postgres:17-alpine; state running; health healthy; host mapping 127.0.0.1:55432 to container 5432; data volume keeper_local_verification_postgres_data mounted at /var/lib/postgresql/data.

Identity query executed inside that exact container over the local socket:

    docker exec keeper-local-test-postgres psql -X -v ON_ERROR_STOP=1 -U keeper_test_admin -d keeper_test -A -t -c "SELECT current_database(), current_user, COALESCE(inet_server_addr()::text, 'unix-socket'), current_setting('port'), current_setting('server_version');"

Observed result: keeper_test | keeper_test_admin | unix-socket | 5432 | 17.11.

### Schema/table inventory

Executed in BEGIN TRANSACTION READ ONLY:

    SELECT 'SCHEMA', schema_name
      FROM information_schema.schemata
     WHERE schema_name NOT IN ('pg_catalog','information_schema')
     ORDER BY schema_name;
    SELECT 'TABLE', table_schema, table_name
      FROM information_schema.tables
     WHERE table_type='BASE TABLE'
       AND table_schema NOT IN ('pg_catalog','information_schema')
     ORDER BY table_schema,table_name;

Result: public schema exists; no non-system base tables exist. The database is empty of user tables and database/postgres/001_keeper.sql has not been applied. pg_toast is PostgreSQL internal. Row counts, media/job statuses, fingerprints, workspace mismatches, orphans, usage-ledger rows, conversations/messages, and subscription references are N/A because the source tables are absent. No row-level inventory queries were run and the schema was not applied to create inventory data.

The metadata transaction was committed after SELECT statements only. No other SQL statement was executed against PostgreSQL.

## 2. MongoDB inventory

The optional Compose service exists only as configuration. The exact named container lookup was:

    docker inspect keeper-local-test-mongodb --format='name={{.Name}} image={{.Config.Image}} state={{.State.Status}} ports={{json .NetworkSettings.Ports}} mounts={{range .Mounts}}{{.Name}}:{{.Destination}};{{end}}'

Result: no such container. It was not started. No MongoDB URI was obtained from application configuration, no developer MongoDB was queried, and no replica set was initialized.

**MongoDB inventory: BLOCKED / unavailable.** Configuration alone cannot establish indexes, validator state, replica-set state, document counts, fingerprints, usage rows, or ownership/orphan counts.

### Future read-only MongoDB procedure

Only after a disposable test instance is separately designated, use a test-only URI from a protected process environment variable named KEEPER_TEST_MONGODB_URI. Do not use .env.local or print the URI. Before inventory, assert:

- Expected database is keeper_test.
- Host/port and dedicated instance marker match the approved test environment.
- Replica-set name is keeperTestRs.
- Identity output includes only database, server version and replica-set name; never credentials or documents.

Using mongosh, read the URI from the process environment, verify db.getName() and hello.setName, then use countDocuments and aggregate groupings only. Count these collections if present: keeper_media, keeper_media_transcripts, keeper_media_analyses, keeper_ai_jobs, keeper_workspace_assignments, keeper_usage_ledger, keeper_organization_corrections, keeper_media_transcript_history, keeper_collections, keeper_collection_profiles, keeper_ai_conversations, keeper_ai_messages, keeper_workspace_memory, billing_subscriptions, billing_payments, razorpay_webhook_events, billing_payment_failures. Group by status, fingerprint class/length, event type, plan and missing amount. Do not print IDs, payloads, transcripts, message text, payment identifiers, or full documents. This procedure has not been run.

## 3. Fingerprint migration readiness

### Static legacy formats

No live PostgreSQL fingerprint data exists in keeper_test; MongoDB and Supabase data were not inspected.

Static source review shows legacy writes use bare lowercase SHA-256 hex without a version prefix:

- PostgreSQL PostgresStore.importMedia computes a bare digest for text length at least 80; the standalone trigger also derives identity fields.
- Supabase migration trigger keeper_set_media_identity stores a bare digest for nonempty normalized text; the import RPC searches fingerprints only at length at least 80.
- Mongo import computes a bare digest for JavaScript string length at least 80. Generic payload updates do not consistently recompute identity fields.
- The standalone trigger clears short text. The Supabase trigger hashes any nonempty text and can retain an old hash when updated text becomes empty.

These are source-derived classes, not observed counts. Actual legacy data may include NULL, bare 64-hex hashes, short-text Supabase hashes, and stale hashes. Prevalence is unknown.

### Approved v1 coexistence plan

Use the approved v1:<64 lowercase hex> encoding in the existing text field. Preserve payload/provenance.

1. New writes compute v1 from the fixed fields title, description, metadata.caption, metadata.bodyText; use NFC, deterministic lowercase normalization, collapsed whitespace, fixed field separator, 80 Unicode scalar-value threshold, and UTF-8 SHA-256.
2. During compatibility, compute both v1 and the exact legacy candidate for incoming content. Search both forms, always workspace-scoped.
3. New writes store v1. A legacy bare hash remains readable until the backfill is complete. Fingerprints are duplicate hints, not unique identity; never merge records automatically on fingerprint alone.
4. Backfill is resumable and idempotent, recomputes only approved source fields, records outcomes/conflicts, and never rewrites source payload. Do not run before counts and export/recovery review.
5. Reprocessing must preserve source fields. Updates recompute; empty/short results clear to NULL. AI summaries/tags are excluded.
6. Stop legacy dual-read only after aggregate counts show no unresolved legacy rows.

### Required cross-provider golden vectors

TypeScript, SQL, and Mongo implementations must have identical expected results for:

- Empty and whitespace-only input -> NULL.
- 79 normalized Unicode scalar values -> NULL; exactly 80 and 81 -> v1 digest.
- 78 ASCII letters plus one supplementary emoji is 79 scalar values and must not hash, despite JavaScript UTF-16 length 80. 79 letters plus one emoji is 80 scalar values and must hash.
- Case/repeated whitespace equivalence; NFC composed/decomposed “café” equivalence.
- Multilingual/emoji preservation and UTF-8 digest bytes.
- Field-boundary distinction: title “ab” + description “c” differs from title “a” + description “bc”.
- Long-to-short and nonempty-to-empty updates clear a prior hash.
- Legacy and v1 candidates both match during dual-read; identical text in different workspaces never cross-matches.

No stored fingerprint was read, calculated into storage, or updated.

## 4. Workspace integrity inventory

### Available mismatch counts

PostgreSQL Keeper tables do not exist; all relationship counts are N/A, not zero. Supabase and MongoDB counts are unavailable. No private content or record identifiers were retrieved.

### Read-only relationship checks for a future PostgreSQL fixture

After schema and fixtures exist in a separately prepared test DB, run aggregate counts only inside BEGIN TRANSACTION READ ONLY / ROLLBACK. For each child, count parent workspace mismatch and orphan separately. Example:

    SELECT 'media_transcript_workspace_mismatch', count(*)
      FROM public.keeper_media_transcripts c
      JOIN public.keeper_media p ON p.id=c.media_id
     WHERE c.workspace_id IS DISTINCT FROM p.workspace_id;
    SELECT 'media_transcript_orphan', count(*)
      FROM public.keeper_media_transcripts c
      LEFT JOIN public.keeper_media p ON p.id=c.media_id
     WHERE p.id IS NULL;

Repeat for keeper_media_analyses, keeper_ai_jobs, keeper_workspace_assignments, keeper_usage_ledger, keeper_organization_corrections, and keeper_media_transcript_history joined to keeper_media by media_id. For keeper_ai_messages, join keeper_ai_conversations by conversation_id and count workspace mismatch and missing parent. For keeper_collection_profiles, join keeper_collections by both workspace_id and collection_id; count missing parent/mismatched key. Also return only counts grouped by media/job status, fingerprint class/length, ledger event/plan/null amount, and billing-subscription to media workspace match. Do not select payloads, transcripts, message bodies, workspace IDs, or subscription/payment identifiers.

Workspace IDs cannot be compared to Auth users in standalone PostgreSQL because the standalone schema intentionally has no fake Auth table. Supabase owner integrity is through existing Auth FKs; a separate read-only Supabase inventory would be required.

### Static ownership relationships

Media children are transcripts, analyses, jobs, organization corrections, assignments, usage ledger, and transcript history. Collections own collection profiles through a composite workspace/key FK. Conversations own messages through conversation ID, but the current SQL relation omits workspace ID. Billing payments reference user and subscription; payment failures reference global webhook events and subscriptions.

SQL media-child and conversation-message cascades exist, but several FKs use only the globally unique parent ID, not the workspace pair. Standalone PostgreSQL has no Auth owner FK; MongoDB has no FK enforcement. These are static findings, not measured mismatches.

## 5. Workspace deletion design (not executed)

### Supabase

Existing Auth-owner FKs cascade deletion for workspace-owned Keeper data; media, collection-profile and conversation/message FKs add cascades. Billing payments cascade from Auth user. Subscription deletion sets payment/failure subscription references to NULL. Webhook events are global and are not user-cascaded; failure rows attached to those events may remain. Define retention for payment-failure/webhook metadata separately. Preserve RLS and existing Auth deletion behavior.

### Standalone PostgreSQL

There is no Auth FK or RLS. An authenticated application cleanup service must verify the caller owns the requested workspace, fence writes/worker claims, and perform an idempotent transaction: delete/terminalize scoped jobs; remove workspace media and dependent records; remove conversations/messages, collections/profiles, workspace memory, usage rows, and subscriptions/payments according to approved retention; record cleanup completion. Every delete predicate must include verified workspace ownership. Do not expose admin deletion by client-supplied workspace ID.

### MongoDB

Use a replica-set transaction for bounded multi-collection cleanup. Verify owner, fence new writes/workers, delete only documents with the verified workspace_id, and record completion atomically. Mongo has no cascades. For libraries too large for a single transaction, use a resumable cleanup state machine with export, checkpoints, retries, and a tombstone preventing resync/recreation; never leave a partial purge untracked.

### Shared safeguards

1. Confirm authenticated deletion intent and export/retention policy; create a versioned export and verify checksum before deletion.
2. Fence writes and workers. A worker must re-check job/media/workspace ownership before each write; a pre-delete claim must not recreate child data.
3. Produce dry-run counts by table/collection and assign a resumable operation ID.
4. Clean atomically or with durable checkpoints/tombstone; preserve audit data subject to approved retention.
5. Verify post-cleanup counts and retain authorized export/recovery material for the approved window. Do not automatically restore data after a deletion request.

No export, cleanup, deletion, or rollback action was performed. Retention requirements and operational transaction limits remain unverified.

## 6. Migration readiness matrix

| Change | Existing data risk | Inventory result | Remediation | Ready? |
|---|---|---|---|---|
| Job status constraints | Legacy/stage failure values may exist; missing claim stages can strand jobs. | PostgreSQL Keeper schema absent; Supabase/Mongo unavailable; counts unavailable. | Inventory all statuses; map legacy states without data loss; align lifecycle then constrain. | No |
| Media status constraints | Worker writes MEDIA_FOUND, EXTRACTING_AUDIO, TRANSCRIPT_READY; app union omits them. Unknown historical text may exist. | PostgreSQL schema absent; Supabase/Mongo counts unavailable. | Add typed stages; inventory; add compatible constraint/validator. | No |
| Composite workspace FKs | Child workspace mismatches would block composite FKs; current relations often key only on parent ID. | No PostgreSQL rows; Supabase/Mongo not inspected. | Count mismatches/orphans; disposition each before additive composite constraints. | No |
| Fingerprint v1 | Current writes are bare hashes; Supabase may contain short/stale values; dedupe behavior changes. | No PostgreSQL rows; Supabase/Mongo unavailable. | Dual-read legacy/v1; golden vectors; resumable source-only backfill; no automatic merging. | No |
| Usage-ledger normalization | Mongo writes event_type=import, omits amount and may omit plan; OSS UI and server caps disagree. | No PostgreSQL rows; Mongo/Supabase rows unavailable. Static mismatch confirmed. | Unlimited OSS independent of subscription; normalize FREE_IMPORT/free/amount=1; inventory Mongo legacy docs before validation. | No |
| Workspace cleanup | Cascades differ; standalone/Mongo need application cleanup; worker races and global billing retention matter. | No live tenant data; Supabase/Mongo not inspected. | Owner verification, worker fencing, export, idempotent transaction/checkpoint, retention and post-delete checks. | No |

No means not ready from this inventory; it does not mean the databases have zero mismatches.

## 7. Recommended next implementation order

1. Confirm remaining operational decisions: choose v1: prefix, and define retention for global webhook/payment-failure records. OSS unlimited policy is approved.
2. Add shared state/fingerprint/usage contract tests; fix type-state and provider transition divergence.
3. Prepare explicitly disposable fixtures for each provider. Schema application is a separately authorized setup action; the empty PostgreSQL database is not populated compatibility evidence.
4. Run aggregate-only inventories before constraints/backfills; retain redacted counts and remediation decisions.
5. Add SQL composite FKs/status checks only after preflight passes. Add Mongo validators/index changes in compatibility mode before tightening.
6. Implement unlimited OSS import and normalized usage audit; test beyond 30, duplicate idempotency and all providers.
7. Implement workspace cleanup after export, worker-fencing, retention and rollback review.
8. Run provider parity plus tenant-isolation suites. Supabase RLS requires two authenticated identities and is distinct from PostgreSQL/Mongo store tests.

## Verification record

- Branch/worktree inspected: open_source_keeper; pre-existing modifications preserved.
- PostgreSQL identity: verified as keeper-local-test-postgres / keeper_test.
- PostgreSQL inventory: read-only; public schema has no user tables; Keeper schema not applied.
- MongoDB: dedicated container absent; no connection/start/init.
- Supabase: not accessed.
- SQL writes/DDL, migrations, fingerprint updates, cleanup, Docker lifecycle changes: not performed.
- **Phase 1B implementation verdict: BLOCKED** pending disposable provider inventories and remediation of migration-readiness items above.
