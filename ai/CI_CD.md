# CI/CD Operations

Keeper uses GitHub Actions for validation and Vercel for production deployment.

## Pull request and continuous integration

`.github/workflows/ci.yml` runs on pull requests and pushes to `main` or `master`. Its gates are locked dependency installation, ESLint, TypeScript, production dependency audit, design audit, the regression harness, and a Next.js production build. Keep PR workflows secret-free so forked contributions cannot access production credentials.

## Production release

`.github/workflows/deploy.yml` runs on pushes to `main` and manual dispatches from `main`. It repeats all quality gates, pulls the Vercel production settings, builds a Vercel prebuilt artifact, deploys that artifact, and checks the deployed URL's health endpoint, landing page, sign-in/sign-up pages, and import capabilities endpoint. The deployment is serialized so concurrent main pushes cannot race. A failed post-deploy smoke test requests rollback to the previous Vercel production deployment. Manual dry-run executes the production-settings build and does not publish.

The workflow intentionally fails when Vercel credentials are missing. Add these secrets to GitHub Settings → Environments → `production`:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

Configure the `production` environment to allow deployments only from `main` and require a human reviewer. Configure a ruleset/branch protection policy for `main` to require pull requests, review approval, resolved conversations, and the CI checks **Lint, Type Check & Design Audit**, **Automated Tests**, **Dependency Security Audit**, and **Production Build Verification**. Do not allow force pushes or deletion of `main`.

The workflow files cannot configure GitHub repository settings, environment reviewers, Vercel environment variables, or branch rules; a repository administrator must set these up. Vercel production runtime secrets (Supabase, billing/webhooks, AI/transcription, cron) must be configured in Vercel separately and are not copied into GitHub Actions. Keep production and preview credentials separate.

## Dependency updates and current gate status

Dependabot opens weekly npm and GitHub Actions update PRs. Review and merge updates through the same CI gates.

The existing lint baseline has 262 warnings. Two Node helper scripts intentionally use CommonJS in this non-ESM package; their file-level ESLint exceptions resolve the 4 hard lint errors. CI enforces the current warning ceiling (`--max-warnings=262`) so warning debt cannot grow unnoticed. The test script still relies on `npx tsx` instead of a locked project dependency; the production workflow fails closed if it cannot fetch or execute. Pin `tsx` in the project lockfile and reduce lint warnings as follow-up maintenance; do not disable or mark these jobs successful to force a release.

## Operational limitations

- Smoke tests verify basic HTTP availability and response shape, not Supabase database readiness, authenticated user journeys, payment processing, or AI worker completion. Add deeper synthetic checks only with dedicated non-production test accounts and secrets.
- Automatic rollback uses Vercel's rollback-to-previous-production behavior. Confirm the Vercel plan/project supports the desired rollback history and configure runtime observability and alerting in Vercel.
- Production secrets and deployment controls were not available from the development workspace, so live deployment, rollback, and external service readiness have not been verified.
