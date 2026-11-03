# Keeper Phase 1A — Canonical Database Contract

**Date:** 2026-11-02
**Branch:** open_source_keeper
**Scope:** Read-only contract analysis for Supabase, standalone PostgreSQL, and MongoDB. No SQL was executed, no database was contacted, and no source/schema/configuration was changed.

## Executive decision

**BLOCKED for implementation pending explicit decisions and data checks.** The recommended contract is defined below, but current providers disagree on retries, open-source import limits, usage-ledger shape, identity fingerprints, status values, and workspace integrity. Supabase has the most complete SQL job lifecycle, but it is not a complete behavioral golden standard: its free import quota contradicts the open-source product policy, and provider semantics still require alignment.

Recommended policy: open-source imports are unlimited, matching current open-source routes and local import services. Keep usage accounting, subscription history, and billing tables. Do not delete or rewrite them in this phase. Before implementation, confirm the fingerprint normalization recommendation and inventory existing values/relationships before constraints are tightened.

## Evidence reviewed

- Prior schema parity audit: ai/audits/phase-1-postgres-schema-parity-2026-11-02.md.
- Persistence design and provider matrix: ai/PERSISTENCE_ARCHITECTURE.md and ai/DATABASE_PROVIDER_MATRIX.md.
- Standalone DDL: database/postgres/001_keeper.sql.
- All eight current migrations under supabase/migrations/.
- Provider code: src/lib/database/postgres-store.ts, src/lib/database/mongodb-store.ts, src/lib/database/backend-client.ts, and src/lib/database/provider.ts.
- Related behavior: src/services/ai-job-retry-policy.ts, src/app/api/ai/worker/route.ts, src/app/api/ingest/route.ts, src/app/api/usage/route.ts, src/services/bulk-import/import-job-service.ts, src/services/storage-service.ts, src/types/index.ts, and current billing/webhook routes.

Key source locations: retry policy is ai-job-retry-policy.ts:1-30; worker claim/failure transitions are src/app/api/ai/worker/route.ts:60-120; PostgreSQL import/claim is postgres-store.ts:128-174; Mongo import/claim is mongodb-store.ts:150-200; the final Supabase retry migration is 202610200001_ai_pipeline_recovery.sql.

## 1. AI job lifecycle

### Recommended canonical state contract

Keep job lifecycle and media processing outcome as related but distinct fields.

**AI job storage states**

- Queue/legacy queue: QUEUED, PENDING. PENDING remains accepted for older records; new writes use QUEUED.
- Active stages: EXTRACTING, MEDIA_FOUND, EXTRACTING_AUDIO, TRANSCRIBING, TRANSCRIPT_READY, ANALYZING, GENERATING_TAGS, MATCHING_COLLECTION, ORGANIZING, INDEXING.
- Terminal job states: COMPLETED, FAILED.

**Media processing_status values:** the queue and active values above, plus COMPLETED, FAILED, EXTRACTION_FAILED, TRANSCRIPTION_FAILED, ANALYSIS_FAILED, ORGANIZATION_FAILED, and INDEXING_FAILED. A failed job uses FAILED; the media row records the stage-specific failure. Current Supabase checks also allow stage-specific failure values on jobs. Preserve such existing values until their presence is inventoried, but new job writers should use FAILED plus failure_code.

The current AIProcessingState union in src/types/index.ts:104-108 omits MEDIA_FOUND, EXTRACTING_AUDIO, and TRANSCRIPT_READY, although the worker writes these to job/media status fields. Add them to the typed state contract before relying on type-driven validation. ContentProcessingStatus (FULL_CONTENT, PARTIAL_CONTENT, METADATA_ONLY, INSUFFICIENT_CONTENT) is an evidence classification, not a job status.

**Retry and lease policy**

1. Claim atomically increments attempts and grants a five-minute lease in locked_until.
2. Any recognized nonterminal queue/active state is eligible when available_at is due and the lease is absent or expired.
3. Retryable failures clear the lock, record bounded last_error and normalized failure_code, return the job to QUEUED, and set available_at. Preserve the existing shared policy: at most five total claims; delay is min(3600, 15 * 2^(attempts-1)) seconds. Permanent failures do not retry.
4. A crashed worker is reclaimed after lease expiry while attempts < 5. If its fifth lease expires, the next claim pass must atomically terminalize the job and corresponding media row instead of silently excluding it.
5. Reprocessing resets attempts, lock, error and failure code and requeues the job. It must continue checking ownership and immutable canonical URL.
6. Order jobs consistently by available_at, then created_at, then stable ID; current providers differ.

Current processingFailureCode() emits TIMEOUT, RATE_LIMITED, PROVIDER_NOT_CONFIGURED, UNSUPPORTED_MEDIA, SOURCE_ACCESS_DENIED, INVALID_MEDIA, PROVIDER_UNAVAILABLE, and PROCESSING_ERROR. Supabase recovery adds RETRY_EXHAUSTED. Keep the code vocabulary centrally mapped and string-compatible; historical unknown codes must remain readable. Worker stage-specific media failure statuses are selected at route.ts:68,159,313,317,323,413,609.

### Provider comparison

| Provider | Current behavior | Gap |
|---|---|---|
| Supabase | Final keeper_claim_ai_job recognizes MEDIA_FOUND, EXTRACTING_AUDIO, TRANSCRIPT_READY; uses FOR UPDATE SKIP LOCKED, five-minute lease, attempt cap 5, and terminalizes expired exhausted jobs with RETRY_EXHAUSTED. Claim state is EXTRACTING. | Closest current implementation. Still needs parity tests with worker retry helper, stable ordering, and legacy job failure-state handling. SQL job check permits media-only failure states. |
| Standalone PostgreSQL | PostgresStore.claimJob() uses a transaction and FOR UPDATE SKIP LOCKED, but omits those three stages and has no retry cap/exhaustion update. It transitions to EXTRACTING and leases for five minutes. | Omitted stages can remain nonterminal forever; other jobs can retry indefinitely. DDL has no status check. |
| MongoDB | Atomic findOneAndUpdate, five-minute lease and attempts < 5; omits those three stages, transitions to TRANSCRIBING, and returns no job once attempts reaches five. | Exhausted expired jobs are never terminalized and can remain stuck. Claim transition differs; no status validator. |

**Resolution:** implement one tested transition table across providers. Align Mongo claim transition to EXTRACTING; include every worker stage; add atomic exhausted-job terminalization to PostgreSQL and Mongo. Preserve Supabase RLS and service-role restrictions. Do not silently reset in-flight attempts.

## 2. Open-source import entitlements and usage

### Observed behavior

- Open-source billing endpoints declare the free edition and disable checkout, verification, cancellation, and Razorpay webhooks (src/app/api/billing/* and src/app/api/webhooks/razorpay/route.ts).
- /api/usage returns plan=open-source, total=null, remaining=null, unlimited=true; when authenticated it counts the workspace usage ledger (src/app/api/usage/route.ts:7-54).
- Browser StorageService.deductImportLimit() expands the local total and always succeeds (src/services/storage-service.ts:326-332). Bulk import explicitly declares unlimited in src/services/bulk-import/import-job-service.ts:447.
- Server imports contradict this: Supabase caps free at 30 per weekly cycle; Basic at 220/month or 2,640/year; Pro is unlimited in final migration 202610070003. PostgreSQL caps free at 30/week, Basic at 300/month or 3,600/year, Pro at 500/month or 6,000/year (postgres-store.ts:134-153). Mongo uses those PostgreSQL limits (mongodb-store.ts:165-177). OSS accounts can be advertised as unlimited but rejected after 30 imports.
- All providers use keeper_usage_ledger; all import paths query billing_subscriptions to determine limits. PostgreSQL/Supabase use event types FREE_IMPORT or IMPORT_CREDIT, plan and cycle values. Mongo currently writes event_type=import, may write an undefined plan, and omits amount; this does not match relational constraints/defaults.

### Recommended canonical policy

- Open-source users have no product import quota. Operational controls (request throttling, bounded workers, payload/file size limits, abuse controls) remain separate.
- Keep one usage-ledger row per successful new import for audit/analytics, not to block imports. OSS rows use plan=free, event_type=FREE_IMPORT, amount=1, and consistent cycle timestamps. Duplicates/no-op imports do not add ledger rows. Preserve unique workspace/media accounting.
- Do not infer OSS entitlements from historical billing_subscriptions rows. Stale subscriptions must not enable paid limits in this branch.
- Retain subscription, payment, plan catalog, webhook, and failure tables/fields unchanged. A later reviewed change may decouple OSS import policy from subscription rows; do not remove billing objects.
- Keep usage reporting accurate while returning unlimited=true and remaining=null.

**Unresolved U1:** whether a future paid/commercial edition shares these provider stores and subscription tables or uses a separate entitlement adapter. For this branch, the recommendation is unlimited OSS imports; commercial plan limits must not be imported into the OSS path.

## 3. Fingerprint behavior

### Recommended versioned v1 contract

Fingerprints are duplicate-detection hints, not authoritative identity or source content. Never change source payload/provenance to compute them.

1. In a fixed order, read title, description, metadata.caption, metadata.bodyText; ignore nonstrings and empty values.
2. Normalize each string with Unicode NFC, deterministic case normalization, collapse runs of Unicode whitespace to one ASCII space, then trim. Join remaining fields with a fixed newline separator.
3. Count Unicode scalar values in normalized joined text, not JavaScript UTF-16 code units. Empty text or fewer than 80 scalar values yields NULL; exactly 80 qualifies.
4. Hash UTF-8 normalized bytes with SHA-256, lowercase hex, plus explicit version marker (v1:) or a version column. TypeScript, SQL, and Mongo must share golden vectors.
5. Recompute on every insert and payload update. Clear fingerprint when updated text becomes short/empty; never retain a stale digest. Search remains workspace-scoped and fingerprint is only candidate evidence.

Current TypeScript uses toLowerCase().trim() and JS .length >=80; PostgreSQL uses lower(trim(...)) and SQL length; Mongo also uses JS length. PostgreSQL standalone clears short text; Supabase hashes any nonempty text and leaves prior fingerprint unchanged when new text is empty. Supabase import and both non-Supabase imports search fingerprints only at >=80, so stored fingerprints diverge.

**Unresolved U2:** approve exact Unicode normalization/case-folding/version encoding before implementation. Switching from bare hashes needs dual-read, compatibility matching, or controlled backfill; never rewrite payload text.

## 4. Workspace integrity and authorization

### Parent-child relationships to protect

| Parent/scope | Child objects | Existing relation and contract |
|---|---|---|
| Auth user/workspace | media, collections, workspace memory, jobs, transcripts, analyses, corrections, assignments, profiles, usage, transcript history, conversations, messages | Supabase generally has workspace_id to auth.users with cascade and table RLS. Standalone lacks Auth FK; Mongo has no FKs. Derive workspace only from verified auth; never trust client workspace. |
| keeper_media | transcripts, analyses, AI jobs, corrections, assignments, usage ledger, transcript history | Media FKs cascade, but usually reference media_id only even when child repeats workspace_id. Require same-workspace parent relation. In SQL add parent unique (workspace_id,id) and child composite FKs where compatible; Mongo must check parent and owner in the transaction. |
| keeper_collections | collection_profiles; JSON media collection membership | Profile has SQL composite FK (workspace_id,collection_id); payload membership has no FK. Validate all collection membership against authenticated workspace. |
| keeper_ai_conversations | keeper_ai_messages | Message references conversation_id and repeats workspace_id, but FK is conversation_id only. Add composite SQL relation where compatible; read/write must scope both workspace and conversation. Mongo verifies parent scope transactionally. |
| Auth user | billing_subscriptions, billing_payments | Supabase user_id FKs cascade; standalone lacks Auth FK; Mongo application-level. Preserve ownership semantics where Auth exists; standalone derives identity from verified Supabase Auth. |
| Subscription/event | billing_payments, billing_payment_failures | Payment subscription FK sets NULL; failure event FK cascades and subscription FK sets NULL. Preserve. |
| Global billing data | billing_plan_catalog, razorpay_webhook_events | Global objects; webhook event key unique. Keep service-only billing/event access. |

### Provider responsibilities

- **Supabase:** preserve Auth verification, RLS, policies, grants, auth.uid() security-definer checks, and service-role worker operations. Add composite FKs only after checking/repairing mismatched rows. Do not replace RLS with application checks.
- **Standalone PostgreSQL:** there is no auth schema or RLS. backend-client.ts authenticates through Supabase Auth first. RPC workspace IDs are injected from the verified user, but generic .from() queries are not scoped automatically. Every route/store read/update/delete must predicate by workspace_id=verified user.id. Worker/admin methods must scope child writes to the claimed job workspace. Fix/guard recordAssignment(), which upserts a workspace/media pair without first confirming that the media belongs to that workspace. Use composite FKs for row relationships; no fake Auth table. Use least-privilege runtime DB credentials.
- **MongoDB:** use replica-set transactions for multi-document import/reprocess/membership changes. Unique indexes do not enforce foreign keys/workspace pair ownership. Add validators for required types/enums where practical, and explicit parent checks for every relationship. Do not query by ID alone when workspace context exists.

makeStoreClient() injects workspace into RPC args, but generic .from() is a pass-through (backend-client.ts:14-26). Route authorization tests are therefore part of the provider contract.

## 5. Status constraints

### Canonical accepted media processing values

QUEUED, PENDING, EXTRACTING, MEDIA_FOUND, EXTRACTING_AUDIO, TRANSCRIBING, TRANSCRIPT_READY, ANALYZING, GENERATING_TAGS, MATCHING_COLLECTION, ORGANIZING, INDEXING, COMPLETED, FAILED, EXTRACTION_FAILED, TRANSCRIPTION_FAILED, ANALYSIS_FAILED, ORGANIZATION_FAILED, INDEXING_FAILED.

For new job rows use QUEUED/legacy PENDING, those active stages, then COMPLETED or FAILED. Keep stage-specific failures on keeper_media.processing_status. Current SQL check permits them on jobs too; inventory before tightening. failure_code stores diagnostics including RETRY_EXHAUSTED.

### Current compatibility

- Supabase media/job checks accept the listed superset (migrations 202610070003 and 202610070004); job check permits media failure states that current worker does not write to jobs.
- Standalone PostgreSQL has no media/job checks.
- MongoDB has no collection validators for status values.
- AIProcessingState lacks MEDIA_FOUND, EXTRACTING_AUDIO, TRANSCRIPT_READY, although worker writes them.
- Mongo claim moves the job to TRANSCRIBING, while Supabase/PostgreSQL use EXTRACTING.

**Resolution:** define shared typed constants. Keep legacy PENDING. Make job-state subset explicit. Add SQL checks/validators only after a read-only inventory of existing values and a migration plan. Unknown values block a constraint migration; do not delete or silently rewrite rows.

## 6. Billing residue

**Required now:** keeper_usage_ledger is used by all provider import/accounting paths and read by /api/usage; preserve workspace/media/event/plan/cycle fields. Normalize Mongo event_type, plan and amount. keeper_workspace_memory.free_cycle_anchor is used for non-subscription PostgreSQL/Mongo cycle calculations and the other memory fields support AI organization; preserve it. billing_subscriptions is still read by all three import paths today. The recommendation decouples OSS entitlement in later implementation but does not remove this table or any fields in Phase 1A.

**Retain, not demonstrated as active OSS request-path dependencies:** billing_plan_catalog, billing_payments, razorpay_webhook_events, billing_payment_failures remain in schemas/provider whitelists/indexes. Current payment/checkout/webhook routes are disabled; searched source showed no enabled OSS route CRUD on these. That does not prove safe removal because retained paid-edition code/data or external operations may depend on them. Preserve webhook uniqueness/processed state, failure-event cascade and subscription SET NULL relationships.

## 7. Recommended resolution and implementation work

### Application changes

1. Create a typed shared job-state/transition contract used by API, worker, stores, and tests. Add the three missing active states; distinguish job terminal state from media failure status.
2. Align providers on claim eligibility, atomic attempt increment, five-minute lease, five-attempt terminalization, failure codes, retry delays, and due-job ordering. Ensure crashed fifth attempts become visible terminal failures.
3. Remove subscription-derived blocking from the OSS import path; retain subscription records and usage reporting. A future paid build requires an explicit entitlement adapter and edition choice.
4. Normalize usage writes: OSS event FREE_IMPORT, plan free, amount 1, consistent cycle boundaries, one row per newly created media only. Mongo must not write import/undefined plan.
5. Centralize fingerprint v1 in provider writes; make SQL triggers and Mongo updates consistent, including clearing short/empty updated content. Dual-read/backfill old hashes.
6. Scope every generic CRUD/admin path. Add parent checks to assignment and conversation-message relationships; preserve Supabase RLS unchanged.

### SQL/schema changes (design only)

- **Supabase:** additive migration for composite keys/FKs after checking existing rows; retain Auth FKs/RLS/grants; align trigger fingerprint semantics; align separate status constraints only after legacy-value inventory; preserve billing/usage objects.
- **Standalone PostgreSQL:** update bootstrap for same provider-neutral statuses, fingerprint behavior and workspace-pair FKs; do not add auth schema/tables or Supabase policies. If already used, add versioned upgrade migration; CREATE TABLE IF NOT EXISTS is not an upgrade.
- **MongoDB:** add runtime validator/index migration in backward-compatible order; use transactional owner checks for relationships indexes cannot enforce; retain replica-set requirement.
- **Unlimited OSS quota requires policy logic, not table removal.** Keep billing and ledger schema.

## 8. Migration and compatibility risks

- Existing Supabase job rows may contain stage-specific failure statuses permitted by the current check. Inventory before narrowing constraints.
- Jobs already at five attempts may terminalize when logic is fixed. Preserve error details and expose them for review; do not silently reset attempts.
- Composite FKs fail on child/workspace mismatch. Count and report before constraints; do not delete parent/child to make migration pass.
- Fingerprint changes alter duplicate candidates. Use versioning/dual-read or controlled backfill, without changing payload. Index is non-unique, but dedupe behavior changes.
- Unlimited OSS imports expose caps hidden by UI optimism; test beyond 30 and keep separate abuse controls.
- Mongo validators can reject old documents; inspect first, then tighten.
- Supabase RLS and standalone/Mongo application boundaries are different; standalone tests do not prove Supabase RLS.
- Preserve historic billing subscriptions; do not infer OSS entitlement from them or remove them.

## 9. Required parity tests

**AI jobs:** table-driven state transition tests; claim all active stages after expired lease; concurrent claim gives one live owner; attempts increment once; retryable/permanent errors map consistently; delays for attempts 1–5 and one-hour cap; fifth expired lease becomes FAILED/RETRY_EXHAUSTED; all terminal paths clear lock; reprocess atomically resets and preserves transcript/canonical URL. Run equivalent disposable provider tests and Supabase two-user/RLS tests.

**Entitlements/ledger:** exceed 30 OSS imports in each provider; existing active/cancelled subscriptions do not alter OSS behavior; duplicate imports add no ledger row; each new record adds one equivalent valid event/amount/plan; usage remains accurate with unlimited=true, remaining=null; separate paid adapter tests only if that edition is confirmed.

**Fingerprints:** shared golden vectors for empty/short/79/80/81 Unicode scalar values, whitespace, case, composed/decomposed accents, emoji and multilingual text; insert and update yield identical hashes; long-to-short and nonempty-to-empty clear hashes; legacy hash dual-read; all fingerprint match queries workspace-scoped.

**Workspace:** two-user own/cross read/update/delete; collection membership; assistant retrieval; worker/job assignment; mismatched child/parent workspace rejected in SQL and Mongo service paths; transactional rollback; workspace/account deletion lifecycle; preserve Supabase RLS read/update/delete assertions.

## 10. Unresolved decisions

- **U1 — Commercial entitlement boundary:** recommended OSS behavior is unlimited and ignores subscription rows. Confirm whether paid builds share these stores; if yes, define separate entitlement adapter before implementation. Billing data stays intact.
- **U2 — Fingerprint v1:** approve NFC, case normalization, whitespace collapse, 80 Unicode scalar-value threshold and version encoding, or select an alternative before backfill.
- **U3 — Existing provider data:** no live provider catalog was inspected. Before status/FK tightening or rehash, run read-only inventories against explicitly designated disposable/test providers and prepare mismatch counts.
- **U4 — Workspace deletion:** Supabase Auth cascades owner rows; standalone/Mongo have no Auth FK. Decide between authenticated application cleanup and operator-controlled retention. Do not create fake Auth tables.

## Verification and status

- Static source/migration review on open_source_keeper: completed.
- Database connection, SQL/migration execution, runtime provider tests: not run, as required.
- Existing worktree changes preserved; this report is the only file added.
- **Final verdict: BLOCKED for implementation** until U1/U2 are approved and data inventories/backward-compatibility plans are prepared. After that, this contract gives an implementation/test sequence without replacing providers or removing paid-edition data.
