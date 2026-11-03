# Testing Guide — Security and Persistence Baseline

## Local provider services (isolated)

`docker-compose.local-test.yml` is a separate, opt-in test-only stack. It binds only to loopback, uses ports `55432`/`27018`, dedicated volumes named `keeper_local_verification_*`, and test-only credentials defined in that file. It does not include the Keeper app, read `.env.local`, initialize schemas automatically, or delete volumes. Do not change those values to a developer or hosted database URI.

Docker Engine and the Compose plugin must be installed and running. This environment had Docker CLI 29.9.2, but no reachable daemon and no Compose plugin, so neither service was started and the commands below were not executed here.

### PostgreSQL

Start only the dedicated PostgreSQL container and wait for its health check:

```bash
docker compose -f docker-compose.local-test.yml up -d keeper-test-postgres
docker compose -f docker-compose.local-test.yml ps
```

Schema installation is an explicit operation against the named disposable test database; inspect the SQL before first use. It must not be pointed at any other host or database:

```bash
docker compose -f docker-compose.local-test.yml exec -T keeper-test-postgres \
  psql -U keeper_test_admin -d keeper_test -v ON_ERROR_STOP=1 \
  -f /test-schema/001_keeper.sql
```

The provider store needs `DATABASE_PROVIDER=postgres` and a dedicated URI of the form `postgresql://keeper_test_admin:<test-only-password>@127.0.0.1:55432/keeper_test`. Never pass an application `.env.local` file to the test process. The current repository has no automated standalone PostgreSQL provider-test command, so schema installation alone is not a provider verification result. Provider CRUD, URL uniqueness races, transaction rollback, job claim/retry, owner/deletion behavior, and read failures remain **not run** until a safe integration runner is available and executed.

Stop without deleting data:

```bash
docker compose -f docker-compose.local-test.yml stop keeper-test-postgres
```

### MongoDB replica set

Start the separate replica-set service:

```bash
docker compose -f docker-compose.local-test.yml --profile mongodb up -d keeper-test-mongodb
docker compose -f docker-compose.local-test.yml ps
```

After it is healthy, initiate its single-node test replica set explicitly. This advertises the dedicated host-mapped endpoint to clients running on the host:

```bash
docker compose -f docker-compose.local-test.yml exec keeper-test-mongodb \
  mongosh --quiet --host 127.0.0.1 --port 27017 \
  --username keeper_test_admin --password keeper_test_only_password \
  --authenticationDatabase admin --eval \
  'rs.initiate({_id:"keeperTestRs",members:[{_id:0,host:"host.docker.internal:27018"}]})'
```

Use only `mongodb://keeper_test_admin:<test-only-password>@127.0.0.1:27018/keeper_test?authSource=admin&replicaSet=keeperTestRs` for an explicitly authorized local runner. The repository has no automated Mongo provider-test command; runtime index creation, workspace CRUD, unique races, import rollback, AI job claim/retry and read failures are therefore **not run**. Mongo is not supported for the transactional import path without a replica set.

Stop without deleting data:

```bash
docker compose -f docker-compose.local-test.yml --profile mongodb stop keeper-test-mongodb
```

The named volumes are persistent. Do not use `down -v` in routine operation. If an operator intentionally needs to reset only these disposable fixtures, first stop the test-only project and verify the exact two volume names, then remove only `keeper_local_verification_postgres_data` and/or `keeper_local_verification_mongodb_data` explicitly with the Docker volume CLI. No reset or volume deletion was performed for this task.

### Local Supabase

**Not supported by current checkout configuration.** `supabase/config.toml` and the Supabase CLI are absent; only SQL migrations exist under `supabase/migrations/`. No local Supabase services were added or started. A future local Supabase setup requires an explicit reviewed CLI project configuration, Docker/Compose services, local Auth settings, migration application to a fresh local volume, two local identities and fixtures, and RLS tests. This is separate from standalone PostgreSQL and cannot be inferred from its tests.

## Default isolated checks

Normal `npm test` runs deterministic local suites only. It does not read `.env.local` or connect to Supabase. The live Supabase test is skipped with a clear message unless `npm run test:integration:supabase` and dedicated configuration below are supplied.

```bash
npm test
npm run type-check -- --incremental false
npm run lint
git diff --check
```

The suite covers local persistence, duplicate/canonical URL behavior, source immutability, per-user storage isolation, import retry and report reconciliation, assistant retrieval over supplied workspace items, and source-level checks that assistant/worker database access includes workspace predicates. The corrective-pass tests also exercise empty/populated media reads, authentication/configuration/backend failure classification, safe transport error text, media/collection read-before-migration ordering, collection route failure statuses, session cookie attributes, expiry, tampering, rotation, and secret failure. These deterministic tests are not substitutes for live route/provider integration tests.

## Opt-in Supabase integration

Use only a disposable Supabase test project with migrations applied, two test users, and two seeded `keeper_media` rows. The Workspace B row is a sacrificial canary for the cross-workspace DELETE authorization check. Never use production credentials, production users, or production data. Do not place tokens on command lines or print them in logs.

Provide these variables via a secret manager or protected environment (values are never printed):

- `KEEPER_TEST_SUPABASE_URL` — HTTPS project URL.
- `KEEPER_TEST_SUPABASE_PROJECT_REF` — URL hostname project ref; must be `<ref>.supabase.co`.
- `KEEPER_TEST_SUPABASE_IS_DISPOSABLE=true` — explicit operator assertion that this project is disposable and safe for the sacrificial delete check.
- `KEEPER_PRODUCTION_SUPABASE_PROJECT_REF` — known production ref; the test refuses a matching ref even if the app URL is unset.
- `KEEPER_TEST_SUPABASE_ANON_KEY` — test project public anon/publishable key.
- `KEEPER_TEST_WORKSPACE_A_ACCESS_TOKEN`, `KEEPER_TEST_WORKSPACE_B_ACCESS_TOKEN` — authenticated access tokens for distinct test users.
- `KEEPER_TEST_WORKSPACE_A_MEDIA_ID`, `KEEPER_TEST_WORKSPACE_B_MEDIA_ID` — one existing media row owned by each user; B's row is sacrificial.

Then run `npm run test:integration:supabase`. The opt-in test verifies each identity can read its own fixture, A cannot read B, and A cannot update/delete B. It requires explicit disposable confirmation, refuses the separately configured production ref, and also refuses `NEXT_PUBLIC_SUPABASE_URL` when configured. Missing/inconsistent variables fail before any database request; the failure lists variable names only. It does not seed or clean up fixtures. This test remains unexecuted because no disposable project was supplied.

## Provider tests

No automated live integration runner is currently provided for standalone PostgreSQL or MongoDB. Do not claim that starting the local services verifies provider behavior. Keep provider-specific tests gated on explicit dedicated local configuration and never load `.env.local`. MongoDB must be a replica set because import uses transactions. See `DATABASE_PROVIDER_MATRIX.md` for exact status and prerequisites.

## Current limitations

- The live Supabase RLS integration test was not executed in this phase because no isolated project and test identities were supplied.
- Search/assistant workspace scoping is covered by local service tests plus route-source checks; no end-to-end authenticated app server was started.
- Worker ownership is covered by deterministic source-level route checks; no database-backed job was claimed.
- The read-response helper is tested with successful empty/populated responses, 401, configuration 503, backend 503, and rejected transport. Route/database behavior is not integration-tested here.
- No database operations, migrations, builds, external provider calls, Docker service startup, or volume deletion were run in the local-only provider setup pass. The explicit schema/replica-set initialization commands above have not been executed.
