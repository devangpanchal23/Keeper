# Phase 1 — PostgreSQL Schema Compatibility Audit

**Date:** 2026-11-02
**Branch:** `open_source_keeper`
**Scope:** Static, read-only comparison of `database/postgres/001_keeper.sql`, all checked-in `supabase/migrations/*.sql`, the PostgreSQL store/provider path, and current billing route references. No SQL was executed and no database was contacted.

## Verdict

**BLOCKED — do not apply this file yet as a provider-parity baseline.**

The file is a standalone PostgreSQL bootstrap schema, not a replay of the Supabase migrations. It has a mostly complete set of tables/columns for the current `PostgresStore`, but material behavioral differences remain: job retry policy, allowed job/media status values, fingerprint trigger semantics, and ownership enforcement. Its repeatability was inspected statically only; syntax, privileges, fresh-database application, and second-run behavior were not runtime-verified. Do not apply the Supabase migration chain to this standalone database; those migrations depend on Supabase Auth roles/functions and `auth.users`.

This is not a finding that applying it to the newly created disposable database would damage other data. It is a hold on calling the schema compatible or verified until the mismatches below are accepted or reconciled and a clean-database test is run explicitly.

## Evidence inspected

- Standalone schema: `database/postgres/001_keeper.sql` (121 lines).
- All eight current migrations: `202610060001_billing.sql`, `202610070001_ai_media_architect.sql`, `202610070002_keeper_collection_sync_grants.sql`, `202610070003_universal_ai_reprocessing.sql`, `202610070004_transcript_audio_metadata.sql`, `202610200001_ai_pipeline_recovery.sql`, `202610240001_ai_conversation_history.sql`, and `202610250001_razorpay_webhook_hardening.sql`.
- PostgreSQL provider implementation: `src/lib/database/postgres-store.ts`; provider selection/auth: `src/lib/database/provider.ts` and `src/lib/database/backend-client.ts`.
- Billing routes and references: `src/app/api/billing/{route,checkout/route,verify/route,cancel/route}.ts`, `src/app/api/webhooks/razorpay/route.ts`, and direct provider SQL in `postgres-store.ts` / `mongodb-store.ts`.

Key source locations: standalone extension/billing DDL is lines 3–33, media identity function/trigger lines 35–58, and the remaining Keeper tables/indexes lines 59–121. Migration object definitions and RLS begin at `202610060001_billing.sql:3`, `202610070001_ai_media_architect.sql:5`, `202610070003_universal_ai_reprocessing.sql:1`, `202610070004_transcript_audio_metadata.sql:2`, `202610200001_ai_pipeline_recovery.sql:1`, `202610240001_ai_conversation_history.sql:1`, and `202610250001_razorpay_webhook_hardening.sql:1`. Store table whitelist/pool are `postgres-store.ts:7-13`; import and quota transaction `:128-160`; claim query `:164-174`; other provider-side RPC implementations `:176-229`. Provider/Auth selection is `backend-client.ts:9-41`.

## Table and column parity

The standalone file defines 18 tables. Comparing the final migration state (including later `ALTER TABLE` additions) shows the following column-level result:

| Table | Column comparison | Important difference |
|---|---|---|
| `billing_subscriptions` | Same named columns | Supabase `user_id` references `auth.users(id) ON DELETE CASCADE`; standalone has no owner FK. |
| `billing_plan_catalog` | Same named columns | No material column difference found. |
| `billing_payments` | Same named columns | Supabase `user_id` references `auth.users(id) ON DELETE CASCADE`; standalone has no owner FK. Its subscription FK is retained. |
| `razorpay_webhook_events` | Same named columns in final migration state | `processed_at` is nullable with no default after migration `202610250001`; standalone matches that final state, though the original billing migration starts it `NOT NULL DEFAULT now()`. |
| `billing_payment_failures` | Same named columns | Event and subscription FKs match. Supabase additionally enables RLS and revokes client roles. |
| `keeper_media` | Standalone contains the final added identity columns | `source_platform`, `source_identifier`, and `content_fingerprint` are introduced by Supabase migration `202610070003`; standalone creates them directly. The Supabase status check is absent in standalone. |
| `keeper_media_transcripts` | Standalone contains final transcript columns | `segments` arrives in `202610070003`; `duration_seconds`, `confidence`, and `extraction_method` arrive in `202610070004`. No missing final migration column found. |
| `keeper_media_analyses` | Same named columns | No material column difference found. |
| `keeper_collections` | Same named columns | Supabase adds `workspace_id -> auth.users`; standalone omits the Auth FK. |
| `keeper_ai_jobs` | Standalone contains final `failure_code` column | `failure_code` arrives in `202610200001`; the final Supabase status check is absent in standalone. Supabase also attaches `workspace_id` to `auth.users`. |
| `keeper_workspace_memory` | Same named columns | Supabase adds Auth-owner FK; standalone omits it. |
| `keeper_organization_corrections` | Same named columns | Supabase adds Auth-owner FK; standalone omits it. Both link media with `ON DELETE CASCADE`. |
| `keeper_workspace_assignments` | Same named columns | Supabase adds Auth-owner FK; standalone omits it. Both use `(workspace_id, media_id)` PK, but the media FK is only on `media_id`, not the workspace pair. |
| `keeper_collection_profiles` | Same named columns | Both have a composite collection FK with `ON DELETE CASCADE`; Supabase also has Auth-owner FK. |
| `keeper_usage_ledger` | Same named columns | Supabase adds Auth-owner FK; standalone omits it. Both use unique `(workspace_id, media_id)`. |
| `keeper_media_transcript_history` | Same named columns | Added in `202610070003`; Supabase adds Auth-owner FK and RLS, standalone does not. |
| `keeper_ai_conversations` | Same named columns | Added in `202610240001`; Supabase adds Auth-owner FK and RLS, standalone does not. |
| `keeper_ai_messages` | Same named columns | Added in `202610240001`; Supabase adds Auth-owner FK and RLS. Its conversation FK is only `conversation_id`, not `(workspace_id, conversation_id)`. |

**Inventory result:** no final-migration column was found absent from the standalone file among these tables. That is column inventory parity only; it does not imply constraint, access-policy, or behavior parity. The standalone file also combines later migration additions into its initial table definitions.

## Constraints and indexes

### Constraint inventory by table

| Object | Standalone constraints | Supabase final migration constraints | Result |
|---|---|---|---|
| `billing_subscriptions` | PK `id`; unique `razorpay_subscription_id`; checks plan/basic-pro, cycle/monthly-yearly, amount >=100 | Same, plus `user_id` FK to Auth user with cascade | Missing owner FK is provider-specific but reduces DB integrity. |
| `billing_plan_catalog` | PK `plan_key`; allowed four plan keys; unique Razorpay plan ID; amount >=100 | Same | Equivalent. |
| `billing_payments` | PK `id`; unique Razorpay payment ID; amount >=0; plan/cycle checks; subscription FK `ON DELETE SET NULL` | Same, plus Auth user FK with cascade | Missing owner FK. |
| `razorpay_webhook_events` | PK `event_id` | Same; final `processed_at` is nullable/no default | Equivalent final shape. |
| `billing_payment_failures` | PK `id`; unique event ID; event FK cascade; subscription FK set null | Same plus RLS/revoked client access | Equivalent relational constraints; security policy differs. |
| `keeper_media` | PK `id`; unique `(workspace_id, canonical_url)` | Same plus Auth-owner FK and processing-status check | Status check / Auth FK missing. |
| `keeper_media_transcripts` | PK/FK `media_id` with media cascade | Same plus Auth-owner FK | Auth FK missing. Transcript `status` has no CHECK in either final schema. |
| `keeper_media_analyses` | PK/FK `media_id` with media cascade | Same plus Auth-owner FK | Auth FK missing. |
| `keeper_collections` | PK `(workspace_id,id)` | Same plus Auth-owner FK | Auth FK missing. |
| `keeper_ai_jobs` | PK `id`; unique `media_id`; unique `(workspace_id,idempotency_key)`; media FK cascade | Same plus Auth-owner FK and processing-status CHECK | Status check / Auth FK missing. |
| `keeper_workspace_memory` | PK `workspace_id` | Same plus Auth-owner FK | Auth FK missing. |
| `keeper_organization_corrections` | PK `id`; media FK cascade | Same plus Auth-owner FK | Auth FK missing. |
| `keeper_workspace_assignments` | PK `(workspace_id,media_id)`; media FK cascade | Same plus Auth-owner FK | No composite FK ensures the media belongs to this workspace. |
| `keeper_collection_profiles` | PK `(workspace_id,collection_id)`; composite collection FK cascade | Same plus Auth-owner FK | Collection integrity equivalent; Auth FK missing. |
| `keeper_usage_ledger` | PK `id`; event type in `IMPORT_CREDIT/FREE_IMPORT`; amount exactly 1; plan in `free/basic/pro`; unique `(workspace_id,media_id)`; media FK cascade | Same plus Auth-owner FK | Auth FK missing. |
| `keeper_media_transcript_history` | PK `id`; media FK cascade | Same plus Auth-owner FK | Auth FK missing. |
| `keeper_ai_conversations` | PK `id`; title length <=120 | Same plus Auth-owner FK | Auth FK missing. |
| `keeper_ai_messages` | PK `id`; role in `user/assistant`; content <=12000; status in `complete/failed`; conversation FK cascade | Same plus Auth-owner FK | Auth FK missing; no composite workspace/conversation FK. |

Standalone has no named `CHECK` constraint limiting media/job status, whereas Supabase migration chain drops/recreates those checks as the accepted pipeline states expand. The standalone file's unnamed inline checks for billing, usage, AI conversation, and AI message tables are materially the ones shown above.

### Index inventory

| Standalone index | Keys / predicate | Supabase counterpart | Result |
|---|---|---|---|
| `billing_subscriptions_user_status_idx` | `(user_id,status,current_period_end DESC)` | Same | Equivalent. |
| `billing_payments_user_created_idx` | `(user_id,created_at DESC)` | Same | Equivalent. |
| `billing_payment_failures_subscription_idx` | `(subscription_id,created_at DESC)` | Same, added in migration 250001 | Equivalent. |
| Unique constraint on `keeper_media` | `(workspace_id,canonical_url)` | Same | Equivalent. |
| `keeper_media_source_identity_unique` | Unique `(workspace_id,source_platform,source_identifier)`, partial both non-null | Same | Equivalent. |
| `keeper_media_fingerprint_idx` | `(workspace_id,content_fingerprint)`, partial non-null | `keeper_media_content_fingerprint_idx` with same logical keys/predicate | Equivalent keys; index name differs. |
| `keeper_ai_jobs_claim_idx` | `(status,available_at,locked_until)` | Same | Equivalent. |
| `keeper_ai_jobs_workspace_idx` | `(workspace_id,created_at DESC)` | Same | Equivalent. |
| `keeper_usage_ledger_cycle_idx` | `(workspace_id,cycle_start,cycle_end)` | Same | Equivalent. |
| `keeper_ai_conversations_workspace_updated_idx` | `(workspace_id,updated_at DESC)` | Same | Equivalent. |
| `keeper_ai_messages_conversation_created_idx` | `(workspace_id,conversation_id,created_at ASC)` | Same | Equivalent. |

Primary/unique constraints are listed in the preceding table; no additional explicit index statements were found in either migration chain or standalone DDL beyond those listed here.

### Present in both provider schemas (by logical key)

- `keeper_media`: primary key `id`; unique `(workspace_id, canonical_url)`; partial unique `(workspace_id, source_platform, source_identifier)` when both identity fields are non-null; non-unique partial workspace/fingerprint index.
- `keeper_ai_jobs`: primary key `id`; unique `media_id`; unique `(workspace_id, idempotency_key)`; claim and workspace/created indexes.
- `keeper_collections`: composite primary key `(workspace_id, id)`.
- `keeper_workspace_assignments`: composite primary key `(workspace_id, media_id)`.
- `keeper_collection_profiles`: composite primary key `(workspace_id, collection_id)` and composite FK to `keeper_collections` with cascade.
- `keeper_usage_ledger`: unique `(workspace_id, media_id)` plus cycle lookup index.
- Transcript and analysis tables use `media_id` primary keys; dependent media rows cascade on media deletion.
- Conversation messages cascade on conversation deletion. Billing payment/subscription and webhook/failure relationships match the delete actions in the migrations.

### Differences and gaps

1. Supabase final migrations constrain `keeper_media.processing_status` and `keeper_ai_jobs.status` to the full pipeline status set (`202610070003`, expanded in `202610070004`). The standalone file declares both as unconstrained `text`. This accepts invalid states and does not reject provider-incompatible values.
2. Supabase owner FKs (`workspace_id` or `user_id` to `auth.users`) and RLS are intentionally not reproduced in standalone PostgreSQL because it has no `auth` schema. This leaves all tenant protection dependent on authenticated application code, private DB credentials, and correct predicates.
3. Several child records have a workspace column plus an FK only on the globally unique parent ID. The DB does not prove that the child workspace matches the parent media/conversation workspace. Examples: transcripts, analyses, jobs, corrections, assignments, usage ledger, transcript history, and AI messages. `keeper_collection_profiles` is the exception with a composite FK.
4. The standalone fingerprint index is named `keeper_media_fingerprint_idx`; Supabase names the equivalent logical index `keeper_media_content_fingerprint_idx`. Their key columns and predicate are equivalent; the names differ.
5. There is no standalone index or constraint enforcing case-insensitive uniqueness for collection names. The store serializes AI collection creation with an advisory lock, then queries by lowercased name; ordinary collection writes can still create case variants.

## Function, trigger, and SQL behavior parity

The standalone schema creates one function and one trigger: `keeper_set_media_identity()` and `keeper_media_identity_before_write`. The Supabase migration chain additionally defines RPC functions: `keeper_import_media`, `keeper_claim_ai_job`, `keeper_update_media_collection`, `keeper_record_ai_assignment`, `keeper_get_or_create_ai_collection`, `keeper_reprocess_media`, and `keeper_update_media_tags`. Standalone `PostgresStore.rpc()` implements these as application-side SQL methods; it does not depend on the Supabase RPC definitions being present.

### Material function differences

- **Fingerprint semantics:** Supabase `keeper_set_media_identity` in `202610070003` hashes any non-empty normalized text and leaves the old value unchanged when the new text becomes empty. Standalone hashes only at length >=80 and assigns `NULL` for shorter text. `PostgresStore.importMedia` and Mongo import also use the >=80 threshold, so standalone aligns with those stores but not the Supabase trigger. An update that shortens text can therefore retain a stale Supabase fingerprint but clear the PostgreSQL fingerprint.
- **AI-job claim/retry:** final Supabase `keeper_claim_ai_job` in `202610200001` marks expired jobs failed at five attempts and sets `failure_code=RETRY_EXHAUSTED`; it includes `MEDIA_FOUND`, `EXTRACTING_AUDIO`, and `TRANSCRIPT_READY` among claimable stages. `PostgresStore.claimJob()` claims the other listed stages but omits those three and has neither the five-attempt terminal policy nor a failure-code update. PostgreSQL can leave jobs in omitted stages stuck and can retry other stages indefinitely.
- **Import entitlements:** Supabase `keeper_import_media` final logic uses Basic limits of 220/month and 2,640/year and treats Pro as unlimited in `202610070003`. `PostgresStore.importMedia()` uses 300/3,600 for Basic and 500/6,000 for Pro. Mongo uses the latter limits as well. This is behavioral parity drift; billing tables are still queried even though the open-source billing endpoints return disabled/free responses.
- **Workspace assignment:** Supabase `keeper_record_ai_assignment` checks that `(media_id, workspace_id)` belongs together before inserting. `PostgresStore.recordAssignment()` performs an upsert but does not perform the equivalent ownership check. The standalone DDL’s media FK checks only that `media_id` exists, so a mismatched workspace pair is not rejected at the database boundary.
- **Transactions:** `PostgresStore.importMedia()` uses one transaction plus a workspace advisory lock for duplicate/quota checks, media/ledger/job insertion, and rollback. `claimJob()` uses a transaction and `FOR UPDATE SKIP LOCKED`. Collection changes and reprocessing use transactions. `updateTags()` is a SELECT followed by UPDATE without a transaction/row lock; assignment is a single upsert. These are operation-level semantics, not guarantees supplied by the schema.

## Billing and Razorpay residue

The billing/payment tables cannot be classified as wholly unused:

- `src/app/api/billing/route.ts`, `/checkout`, `/verify`, `/cancel`, and `src/app/api/webhooks/razorpay/route.ts` currently return open-source/disabled responses. They do not perform billing writes in this branch.
- `PostgresStore.importMedia()` still queries `billing_subscriptions` to determine plan and quota. Mongo import does the same. `keeper_usage_ledger` is still written by import, and `/api/usage` reads it.
- `PostgresStore` and `MongoStore` whitelist the billing/payment tables; Mongo creates indexes for subscriptions, payments, and webhook events. Provider schema/API residue therefore remains.
- The active code search did not find current route calls that read/write `billing_plan_catalog`, `billing_payments`, `razorpay_webhook_events`, or `billing_payment_failures`; the payment/webhook route handlers are disabled. This is evidence of no direct active route usage in the searched source, **not proof that the objects are safe to remove**: direct provider adapters, retained paid-edition code, old data, external scripts, or future edition builds may depend on them.

**Do not remove billing/Razorpay objects in this audit.** In particular, keep `billing_subscriptions` while current import code uses it, and retain/assess usage/payment history before any later removal proposal.

## Foreign keys, workspace isolation, and deletion

- Supabase binds workspace/user IDs to Auth users with cascading FKs and applies table-specific RLS in migrations. Standalone DDL has no user/workspace FK and no RLS/grants/policies.
- The standalone PostgreSQL adapter uses a server-side pool (`DATABASE_URL`), parameterizes values, and emits workspace filters only when calling code supplies them. `makeStoreClient()` injects authenticated `p_workspace_id` into RPC args, but generic `.from()` queries do not add workspace filters automatically (`backend-client.ts`). The worker/admin store is privileged and must be treated as application-authorized.
- Media deletion cascades transcripts, analyses, jobs, correction history, assignments, usage entries, and transcript history. Deleting a conversation cascades messages. Deleting a workspace/user does **not** cascade standalone records because no workspace-owner relation exists; the application has no DB-enforced workspace deletion cleanup in this schema.
- Child workspace ownership inconsistencies are possible at the DB layer as detailed above. The `recordAssignment` adapter gap is a concrete route to a mismatched assignment row if its arguments are wrong.
- Database-level tenant isolation is not equivalent across providers. The standalone test admin configured by Compose is the schema owner/superuser-style initializer; it is not an example least-privilege runtime role.

## Extensions and statements with effects

- `CREATE EXTENSION IF NOT EXISTS pgcrypto` is required for `digest()`; it may install an extension and requires sufficient database privileges. UUID generation uses `gen_random_uuid()` as well. Both Supabase schema branches also request `pgcrypto`.
- `CREATE TABLE/INDEX IF NOT EXISTS` creates missing objects but does not reconcile an existing object’s columns, checks, or index definition. A same-named but wrong index is left in place.
- `CREATE OR REPLACE FUNCTION` replaces the current function body on each run.
- `DROP TRIGGER IF EXISTS` followed by `CREATE TRIGGER` explicitly drops and recreates an existing trigger of that name on every application.
- No data backfill/update or destructive table/index deletion is present in this standalone file. No explicit `BEGIN`/`COMMIT` surrounds the file; the documented `psql -f` invocation normally executes statements in autocommit mode, so an error can leave a partially created schema.

## Repeated-application assessment

On a clean database with `pgcrypto` installation privileges, the DDL is **designed to tolerate many second-run object-exists cases** through `IF NOT EXISTS`, `CREATE OR REPLACE`, and drop/recreate of the trigger. That is not a tested guarantee. Repeating the file will replace the function and trigger; it is not a no-op. Applying to an existing/partially initialized database is unsafe as an upgrade mechanism because `CREATE TABLE IF NOT EXISTS` does not add missing columns/checks and `CREATE INDEX IF NOT EXISTS` does not validate index shape. Static inspection cannot confirm parser acceptance, extension placement, role privileges, or runtime repeatability.

## Recommended safe application order

1. Keep this audit read-only until the standalone-vs-Supabase policy choices are reviewed. Do not apply Supabase migrations to a plain PostgreSQL database; they reference `auth.users`, `auth.uid()`, and Supabase roles.
2. Use only a newly created, explicitly disposable local database with the dedicated test endpoint/database/user. Confirm it is empty and not sourced from `.env.local` before any future schema operation.
3. Reconcile/explicitly accept the job-stage/retry and quota divergences; define whether status checks and workspace-pair integrity are required in standalone mode; align fingerprint semantics or document provider-specific behavior.
4. Review whether a least-privilege standalone app role and explicit workspace cleanup/integrity constraints are required. Do not treat schema-owner credentials as runtime isolation.
5. When separately authorized, run the schema in one transaction with stop-on-error against only that clean test DB, then inspect resulting columns, constraints, indexes, function and trigger definitions. Run the standalone provider integration suite and second-application check there. Do not use a `down -v` reset or point at any existing developer DB.

## Verification record

- **Static source/migration comparison:** completed for all eight migration files and all 18 table definitions in the standalone schema.
- **Billing source-reference audit:** completed for current `src/app`, `src/lib`, and `src/services` references described above.
- **SQL execution / database catalog comparison / repeat-run test:** **not run by instruction**; actual DDL validity and runtime idempotence remain unverified.
- **Working tree:** no source, migration, or schema file was edited. This report is the only file added for this audit.
