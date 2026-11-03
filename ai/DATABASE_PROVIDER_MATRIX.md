# Database Provider Capability Matrix — Phase 1

This is a source-level capability comparison. A checkmark means implementation was found in repository code/DDL, not that a live provider was exercised. The isolated local service definitions are in `docker-compose.local-test.yml`; no provider was connected in this pass.

| Capability | Supabase | Standalone PostgreSQL | MongoDB |
|---|---|---|---|
| CRUD adapter | Supabase client / PostgREST in routes | `PostgresStore` query builder and SQL | `MongoStore` query builder |
| Identity | Supabase Auth | Supabase Auth still supplies verified user | Supabase Auth still supplies verified user |
| Workspace isolation | RLS on core tables plus route filters; RPCs use `auth.uid()` | Route/store workspace filters; no checked-in RLS; parameterized SQL | Route/store workspace filters; no DB-native RLS |
| Import transaction | `keeper_import_media` SQL RPC | Explicit SQL transaction + advisory workspace lock | `withTransaction`; requires replica set/Atlas |
| AI job claim | SQL RPC using row locking/lease | Custom Postgres `SKIP LOCKED` claim | Atomic find/update claim logic |
| URL uniqueness | `(workspace_id, canonical_url)` | `(workspace_id, canonical_url)` | Compound unique index |
| Platform identity uniqueness | workspace/platform/identifier partial unique index | workspace/platform/identifier partial unique index | compound partial unique index |
| Fingerprint index | Workspace/fingerprint non-unique lookup | Workspace/fingerprint non-unique lookup | Workspace/fingerprint non-unique lookup |
| Conversation history | RLS tables and indexes via migration | Tables/indexes in standalone SQL | Runtime indexes |
| Schema management | Ordered `supabase/migrations/*.sql`; RLS/RPC/policies | One checked-in base DDL file; no versioned upgrade runner found | Runtime index creation; no migration framework found |
| Verification status (2026-11-02 local setup pass) | No local config/CLI; live RLS/provider behavior **not tested** | Compose service prepared; Docker daemon/Compose unavailable; schema and provider operations **not run** | Replica-set Compose service prepared; Docker daemon/Compose unavailable; initiation/indexes/transactions/provider operations **not run** |

## CRUD and workspace rules

- `createBackendServerClient()` authenticates with Supabase, selects a data provider, and adds workspace identity to RPC arguments in non-Supabase modes. Generic `.from()` queries still rely on route predicates; they do not automatically add a `workspace_id` filter.
- `createBackendAdminClient()` is privileged. Every route using it must first derive a verified user and include workspace predicates on every operation.
- Supabase policies generally permit users to read their workspace records and collections; writes are commonly performed through server/service-role paths or constrained RPCs. Check each new table/migration for matching RLS and policies.
- Postgres uses parameterized values and identifier quoting in the generic store, but the runtime DB credential can query other workspaces if application code omits predicates. Keep DB network private and use least privilege.
- MongoDB filters are assembled from route/store operations and indexes constrain uniqueness, not authorization. Use private server credentials and explicit workspace clauses.

## Important differences and limitations

1. Supabase migration history is incremental and includes RLS, SQL functions, and grants; standalone PostgreSQL has a separate schema snapshot, and MongoDB creates indexes at runtime. They are not schema-identical migration systems.
2. MongoDB's multi-document import invariant requires replica-set transactions. A standalone MongoDB server is unsupported for that operation.
3. Supabase relies on database RLS as an additional boundary; Postgres and Mongo rely on the application boundary. They are not equivalent defense-in-depth.
4. Core uniqueness is represented in all three code paths, but no live concurrent-write test was run against any configured provider.
5. Standalone DDL and Mongo runtime imports still include legacy billing/usage structures; this phase leaves paid-edition code and schema untouched.
6. The current database abstraction does not automatically scope generic queries by workspace. Workspace context for generic CRUD is enforced by authenticated route code; direct store use must be reviewed individually.

## Parity acceptance required before new AI storage

- **Supabase prerequisites:** current branch has migration SQL but no `supabase/config.toml` and no Supabase CLI. A hosted disposable project must be distinct from `KEEPER_PRODUCTION_SUPABASE_PROJECT_REF` and `NEXT_PUBLIC_SUPABASE_URL`, with `KEEPER_TEST_SUPABASE_IS_DISPOSABLE=true`, reviewed migrations, two test users, owned media fixtures (Workspace B is sacrificial for delete assertion), test-only anon key and access tokens. The harness refuses the configured application/production refs and checks required variables before network access. **No local or live Supabase test run.**
- **Standalone PostgreSQL prerequisites/status:** `docker-compose.local-test.yml` defines a loopback-only `keeper_test` service on `127.0.0.1:55432`, test credentials, named `keeper_local_verification_postgres_data` volume, healthcheck, and read-only schema mount. Schema apply is manual and explicit; no automatic init/reset. Docker daemon was unreachable and Compose plugin unavailable, so service/schema/CRUD/unique concurrency/import rollback/job retry/ownership/read-failure checks are all **not run**. No automated provider test runner currently exists. Do not infer Supabase Auth or RLS from direct store tests.
- **MongoDB prerequisites/status:** the same Compose file defines a separate MongoDB 8 replica set, loopback-only port `27018`, test-only credentials, dedicated named volume and healthcheck; replica set initiation is explicit. Docker/Compose were unavailable, so replica initiation, runtime indexes, CRUD, unique races, import rollback, job claim/retry, owner/delete and read-failure checks are **not run**. No automated provider test runner currently exists.
- **Authentication relationship:** `createBackendServerClient()` uses Supabase Auth to authenticate before selecting the configured data store. PostgreSQL/Mongo store-level checks would validate database behavior only, not route auth, controlled identities, Supabase RLS or session integration.
- Compare new tables, ownership constraints, unique indexes, deletion semantics, and retry state across all supported modes.
- Do not declare full provider parity from schema inspection alone.

## Corrective-pass implementation status

- **Implemented/local tests:** `/api/media` returns a successful empty or populated `{ items }` response only after an authenticated successful query. Collection GET likewise no longer substitutes default seeds after read/auth/config failure. Missing auth is 401; absent server/backend configuration and query/auth-service errors are non-success responses with safe codes/messages. Media/collection sync writes no longer convert backend exceptions into local-only success. `syncWorkspace` preflights media and collection reads before migration, upload, or cache reconciliation.
- **Not live-tested:** RLS/policy behavior, provider SQL/Mongo semantics, real two-account routes, transaction rollback, concurrent unique writes, or provider migration state.
- **Design only:** outbox, mutation idempotency ledger, record revisions/CAS, tombstones, and migration ledger. No schema changes were applied.
