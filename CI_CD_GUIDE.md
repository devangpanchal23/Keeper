# Recall CI/CD Pipeline & Production Operations Guide

This document describes the Continuous Integration (CI) and Continuous Deployment (CD) architecture for the Recall web application, designed to reliably support 1,000+ active users and future scale without infrastructure bloat.

---

## 1. Architecture Overview

- **Hosting & Deployment Target**: Vercel (Native Edge/Serverless Next.js platform)
- **CI/CD Orchestration**: GitHub Actions
- **Runtime & Tooling**: Node.js 20 LTS, npm (lockfile deterministic installation)
- **Quality Gates**: ESLint, TypeScript (`tsc --noEmit`), 60:30:10 Design Audit, Automated Unit/Integration Tests, Production Build Verification
- **Monitoring & Verification**: Dedicated `/api/health` endpoint and post-deployment smoke test suite

---

## 2. Pipeline Flow

```
[ Developer Branch ]
         │
         ▼  (Create Pull Request or Push to main)
┌────────────────────────────────────────────────────────┐
│               CI Quality Gate (ci.yml)                 │
├────────────────────────┬───────────────────────────────┤
│  Lint & Type Check     │  ESLint + tsc --noEmit        │
│  Design Audit          │  60:30:10 Palette Regression  │
│  Automated Tests       │  Core Crypto, Auth, Providers │
│  Security Audit        │  npm audit --audit-level=high │
│  Production Build      │  Next.js Static & SSR Build   │
└────────────────────────┴───────────────────────────────┘
         │
         ▼  (All checks PASS + PR Approved & Merged to main)
┌────────────────────────────────────────────────────────┐
│            CD Production Pipeline (deploy.yml)         │
├────────────────────────────────────────────────────────┤
│  1. CI Pre-Verification Gate                           │
│  2. Concurrency Lock (prevents overlapping deploys)   │
│  3. Production Deployment (Vercel CLI / Git Sync)      │
│  4. Post-Deployment Smoke Test (/api/health, /, Auth)  │
└────────────────────────────────────────────────────────┘
```

---

## 3. Workflow Triggers

| Workflow | File | Triggers | Behavior |
| :--- | :--- | :--- | :--- |
| **CI Quality Gate** | `.github/workflows/ci.yml` | Pull requests to `main`/`master`, pushes to `main`/`master`, manual dispatch | Runs all linters, type checks, design audits, unit tests, and production build. Blocks merge if any check fails. |
| **CD Production** | `.github/workflows/deploy.yml` | Pushes to `main` branch, manual dispatch | Deploys to production environment with concurrency protection (`cancel-in-progress: false`). |
| **Design Audit** | `.github/workflows/design-audit.yml` | Pull requests / pushes to `main`/`master` | Focused micro-check for 60:30:10 design tokens and color limits. |

---

## 4. Required Secrets & Environment Variables

> [!IMPORTANT]
> Configure these names in **GitHub Repository Settings $\rightarrow$ Secrets and variables $\rightarrow$ Actions**. Never commit values to Git.

### GitHub Repository Secrets (Deployment)

| Secret Name | Required For | Description |
| :--- | :--- | :--- |
| `VERCEL_TOKEN` | Production CD | Personal or Team Access Token generated in Vercel Account Settings. |
| `VERCEL_ORG_ID` | Production CD | Organization / Team ID (found in `.vercel/project.json` or team settings). |
| `VERCEL_PROJECT_ID` | Production CD | Project ID (found in project settings or `.vercel/project.json`). |
| `PRODUCTION_URL` | Smoke Tests | (Optional) Explicit production domain for smoke test targets (e.g. `https://recall.app`). |

### Application Environment Variables (`.env.local` / Vercel Environment Variables)

| Variable Name | Exposure | Description |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | Public / Client | Canonical URL of the application. |
| `NEXT_PUBLIC_SPLINE_HERO_URL` | Public / Client | (Optional) Spline 3D scene URL; has high-fidelity SVG fallback if empty. |

---

## 5. Failure Behavior & Safety Protections

1. **Broken Code Never Reaches Production**:
   - The production deployment job strictly depends on `ci-gate`. If a single test, lint rule, TypeScript type error, or build step fails, deployment immediately halts.
2. **Race Condition Prevention**:
   - Concurrency group `production-deploy` with `cancel-in-progress: false` ensures multiple rapid commits deploy in strict sequence without corrupting deployment state.
3. **Lockfile Enforcement**:
   - Workflows use `npm ci` rather than `npm install` to ensure bit-for-bit reproducible node_modules.
4. **Non-Destructive Execution**:
   - No destructive migrations or irreversible steps are performed during deployments.

---

## 6. Rollback & Recovery Process

If a critical issue is identified in production:

### Instant Rollback (Zero-Downtime via Vercel Dashboard / CLI)
1. Go to **Vercel Dashboard $\rightarrow$ [Project] $\rightarrow$ Deployments**.
2. Locate the previous healthy deployment.
3. Click the `...` menu and select **Instant Rollback (Promote to Production)**.
4. Traffic is immediately redirected to the previous immutable deployment artifact within seconds.

### Git Revert Rollback
1. Revert the problematic commit locally:
   ```bash
   git revert HEAD
   git push origin main
   ```
2. The `deploy.yml` workflow will automatically run the CI gate, rebuild, and promote the reverted state.

---

## 7. How Developers Verify Changes Locally Before Merging

Run these commands in order before opening a pull request:

```bash
# 1. Check code quality and style
npm run lint

# 2. Check TypeScript types
npm run type-check

# 3. Check design system and palette tokens
npm run audit:design

# 4. Run automated test suite
npm test

# 5. Verify production build succeeds
npm run build

# 6. (Optional) Run smoke test against local dev server
npm run smoke-test
```
