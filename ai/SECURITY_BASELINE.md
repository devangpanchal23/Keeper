# Security Baseline — Phase 1

**Status:** Session marker hardening implemented and deterministically tested locally; live authentication/database behavior not deployed or verified.

## Session marker signing

- `AUTH_SESSION_SECRET` is the only accepted signing key. The code does not substitute Supabase URLs, publishable/anon keys, or service-role keys.
- Signing requires at least 32 UTF-8 bytes and rejects empty, known placeholder, repeated-character, and low-diversity values (Shannon entropy below 3.5 bits per character). No development fallback is used.
- HMAC-SHA256 marker format and seven-day expiration are unchanged. Verification uses the current configured secret; invalid configuration or markers return `false` without logging the secret or exception.
- Secret rotation invalidates existing Keeper expiry markers. Keep the same independently generated secret across app instances to allow mutual verification.
- Cookie flags remain `httpOnly`, `sameSite: lax`, path `/`, and `secure` in production.
- Missing configuration causes cookie creation to throw a generic configuration error; authentication route handlers are expected to return controlled failure responses. Production login was not exercised here.
- `POST /api/auth/login` and `/api/auth/signup` catch marker-creation/configuration failures and return generic 503 responses. Local tests verify the controlled route paths and cookie policy source; they do not invoke a live HTTP server or Supabase Auth.

Generate a secret with `openssl rand -base64 48`, store it only in `.env.local`/Compose `.env` or the deployment secret manager, and never commit it. The example environment file intentionally leaves it empty.

## Test safety

`npm test` does not load `.env.local` and does not run live DB integration tests. `npm run test:integration:supabase` opts into that path and requires dedicated `KEEPER_TEST_*` settings, an explicit disposable-project confirmation, the separately configured production project ref for comparison, two authenticated workspace tokens, two seeded media IDs, a project ref matching the Supabase hostname, and a project different from both the production ref and `NEXT_PUBLIC_SUPABASE_URL` when that app URL is set. Missing or inconsistent configuration is checked before the first request; only variable names are reported. No credential values are printed.

The live test includes an attempted cross-workspace delete against Workspace B's explicitly designated test media row. Use only a disposable isolated Supabase project and a sacrificial B fixture; do not use production credentials/data. It was not executed in this phase.

## Local provider-test safety

`docker-compose.local-test.yml` defines separate test-only PostgreSQL and MongoDB services, loopback-bound ports (`55432`, `27018`), and unmistakably named volumes. The file has static test-only credentials and no app service; it does not read developer configuration, initialize the schema, or delete data. Schema and Mongo replica-set initialization are explicit commands in `TESTING_GUIDE.md`. No service was started because Docker had no reachable daemon and the Compose plugin was unavailable. Never pass `.env.local` to provider tests or use an application/production database URI. No provider tests were run.

This checkout still has no local Supabase CLI configuration, so local Supabase Auth/RLS cannot be claimed as tested. Supabase Auth remains the identity provider even in the PostgreSQL and MongoDB modes; direct store tests alone do not cover authentication or RLS.

## Remaining security limitations

- Standalone PostgreSQL does not have checked-in row-level policies; isolation depends on private server credentials and explicit workspace predicates in routes/stores.
- MongoDB also relies on server-side query scoping; it has no DB-native workspace RLS.
- No live staging project was available to verify migration state, RLS, auth markers, API authorization, search, or worker access.
- The workspace has no centralized persistent outbox for offline item mutations; see `PERSISTENCE_ARCHITECTURE.md`.
