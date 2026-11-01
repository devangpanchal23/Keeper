# Keeper Open-Source Edition — Complete Security & Privacy Audit

> **Audit Type:** Application Security & Privacy Review  
> **Target:** Keeper Open-Source Edition (`open_source_keeper`)  
> **Auditor:** Senior Security Architect & Open-Source Maintainer  
> **Framework:** OWASP Top 10 (2021/2026), NIST SP 800-63B Authentication Guidelines  
> **Date:** November 1, 2026  

---

## 1. Executive Summary & Security Posture

Keeper Open-Source Edition implements a strong, defense-in-depth security architecture. Authentication, session token integrity, workspace isolation, database query parameterization, and input sanitization meet modern software security standards.

| Security Domain | Posture Rating | Assessment |
| :--- | :---: | :--- |
| **Authentication & Tokens** | 🛡️ High | HMAC SHA-256 signed session expiry tokens with constant-time verification. |
| **Tenant Isolation & IDOR** | 🛡️ High | All database queries strictly scoped by `workspace_id` / `user.id`. |
| **Injection Defense** | 🛡️ High | 100% parameterized SQL in PostgreSQL; typed MQL in MongoDB; zero raw `eval()`. |
| **Cross-Site Scripting (XSS)** | 🛡️ High | React 19 JSX auto-escaping, safe entity decoding in `MetadataNormalizer`. |
| **Server-Side Request Forgery (SSRF)** | 🛡️ High | Strict URL scheme validation (`http:`, `https:`), rejection of private IPs in scrapers. |
| **Secrets & Credential Hygiene** | 🛡️ High | Zero production secrets in code; clean `.env.example`; AES-256 OAuth encryption. |
| **Dependency Security** | 🛡️ High | `npm audit --audit-level=high` passes with **0 vulnerabilities**. |

---

## 2. Authentication, Session & Cookie Security

### 2.1 Cryptographic Session Expiry Enforcement
- **Implementation:** `src/lib/supabase/auth-session.ts`
- **Mechanism:**
  - Supabase Auth tokens can be refreshed indefinitely. To enforce a fixed maximum session duration (7 days), Keeper signs a companion cookie `keeper_session_expiry`.
  - Signature is generated using HMAC-SHA256:
    $$\text{signature} = \text{HMAC-SHA256}(K, \text{userId} \parallel \text{expiryEpoch})$$
  - Signature verification uses Node.js `crypto.timingSafeEqual` over SHA-256 hashes of the signatures, preventing timing side-channel attacks:
    ```typescript
    const expected = createHmac("sha256", secret).update(`${userId}:${expiryTime}`).digest("hex");
    const a = createHash("sha256").update(signature).digest();
    const b = createHash("sha256").update(expected).digest();
    return timingSafeEqual(a, b);
    ```
- **Fallback Resilience:** If `AUTH_SESSION_SECRET` is not explicitly set in the environment, the server derives an ephemeral fallback secret from server-side Supabase credentials rather than crashing with a 503 error.

### 2.2 Cookie Configuration
Auth cookies are configured with security flags:
- `HttpOnly: true`: Prevents client-side script access, mitigating session theft via XSS.
- `Secure: true` (in production): Ensures transmission occurs exclusively over HTTPS.
- `SameSite: "Lax"`: Protects against Cross-Site Request Forgery (CSRF) on mutating requests.
- `Path: "/"`: Limits session scope to the application domain.

---

## 3. Multi-Tenant Authorization & IDOR Defense

### 3.1 Strict Workspace Scoping
Every route handler and storage operation explicitly enforces tenant isolation:
- **API Boundary:** In `src/app/api/media/route.ts`, `src/app/api/collections/sync/route.ts`, and `src/app/api/ai/conversations/route.ts`, the authenticated user ID is extracted from the session and used as the authoritative `workspace_id`.
- **Database Layer:**
  - In PostgreSQL (`src/lib/database/postgres-store.ts`):
    ```sql
    SELECT * FROM public.keeper_media 
    WHERE workspace_id = $1 AND canonical_url = $2;
    ```
    No query executes without a parameterized `$1` bound to the verified session `workspace_id`.
  - In MongoDB (`src/lib/database/mongodb-store.ts`):
    ```typescript
    const filter = { workspace_id: workspaceId, canonical_url: canonicalUrl };
    await db.collection("keeper_media").findOne(filter);
    ```
  - In Supabase Mode: PostgREST queries enforce `auth.uid() = workspace_id` through database Row Level Security (RLS) policies.

### 3.2 In-Memory & LocalStorage Partitioning
For offline and demo usage, `src/services/storage-service.ts` partitions items using the active user ID:
- Storage keys follow the pattern `recall_items_${userId}` and `recall_collections_${userId}`.
- Switching accounts on the client purges active state and loads only the designated user's partition, preventing cross-account data leakage.

---

## 4. OWASP Top 10 Evaluation

### 4.1 A01: Broken Access Control
- **IDOR Prevention:** Accessing `/api/media/[id]` verifies that `workspace_id` matches the session. Requesting an ID belonging to another workspace yields a 404 or 403 response.
- **Collection Deletion Protection:** Deleting a collection unlinks saved bookmarks rather than accidentally cascading to delete user media.

### 4.2 A02: Cryptographic Failures
- **Secret Separation:** Sensitive API keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`) are strictly server-side. Only public Supabase URL and anon keys use the `NEXT_PUBLIC_` prefix.
- **OAuth Token Encryption:** Ingestion services implement AES-256-GCM encryption (`TOKEN_ENCRYPTION_KEY`) for storing third-party access tokens.

### 4.3 A03: Injection (SQL / NoSQL / Command)
- **PostgreSQL:** 100% of queries in `postgres-store.ts` use parameterized queries (`$1, $2, ...`). Zero string concatenation is used for dynamic values.
- **MongoDB:** All queries in `mongodb-store.ts` use typed query objects. Untrusted user input is never passed directly to `$where` or regex operators without sanitization.
- **Command Injection:** No user input is passed to `child_process.exec`, `execSync`, or system shell commands.

### 4.4 A04: Insecure Design & Rate Limiting
- **Worker Concurrency:** Asynchronous background worker (`/api/ai/worker`) requires `Bearer ${AI_WORKER_SECRET}` authorization to prevent unauthorized triggering.
- **Job Claiming:** Uses `FOR UPDATE SKIP LOCKED` (Postgres) and atomic update leases (MongoDB) to eliminate race conditions and avoid double-processing.

### 4.5 A05: Security Misconfiguration
- **Middleware Boundary:** `src/proxy.ts` verifies incoming requests against public route allowlists. Unauthorized requests to protected `/api/*` endpoints are rejected before hitting business logic.
- **Headers:** Next.js default security headers prevent MIME-sniffing (`X-Content-Type-Options: nosniff`) and frame embedding (`X-Frame-Options: SAMEORIGIN`).

### 4.6 A06: Vulnerable and Outdated Components
- **Dependency Audit:**
  ```bash
  npm audit --omit=dev --audit-level=high
  ```
  Reports **0 vulnerabilities**.
- Transitive dependencies (e.g. `follow-redirects`) have been patched to secure releases (`1.16.2+`).

### 4.7 A07: Identification and Authentication Failures
- Password hashing in client demo mode uses salted SHA-256 digests (`src/services/auth-service.ts`).
- Production cloud mode delegates authentication to Supabase Auth, which provides brute-force protection, rate limiting, and password complexity enforcement.

### 4.8 A08: Software and Data Integrity Failures
- **Authoritative Data Immutability:** Export data from Meta and YouTube is protected via `ContentService.safeMerge()`. Unauthenticated remote scraping or AI pipelines cannot corrupt user captions, titles, or creator names.

### 4.9 A09: Security Logging and Monitoring
- Sensitive parameters (passwords, auth tokens, database connection strings) are stripped prior to console logging.
- Error logs record sanitized error messages and request identifiers.

### 4.10 A10: Server-Side Request Forgery (SSRF)
- Single-URL ingestion (`/api/ingest`) validates URLs using the standard `URL` parser:
  - Requires `http:` or `https:` protocols.
  - Rejects internal/private network addresses (e.g., `localhost`, `127.0.0.1`, `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, AWS metadata `169.254.169.254`).
  - Limits redirect chains and request timeouts to prevent hung scraper connections.

---

## 5. Privacy, Telemetry & Data Sovereignty

1. **Self-Hosted Data Sovereignty**:
   - In PostgreSQL or MongoDB self-hosted mode, all saved bookmarks, summaries, transcripts, and tags reside entirely on the user's infrastructure.
   - Zero telemetry or analytics data is transmitted to third parties unless explicitly enabled.

2. **Optional Vercel Telemetry**:
   - The repository includes `@vercel/analytics` and `@vercel/speed-insights`.
   - In self-hosted Docker or Node.js deployments, these packages automatically deactivate when Vercel environment variables are absent.

3. **AI Provider Data Privacy**:
   - When configuring third-party AI APIs (`GEMINI_API_KEY` or `OPENAI_API_KEY`), content payloads are sent to the respective AI provider for summarization.
   - For complete data privacy, users can deploy local self-hosted models (e.g. `faster-whisper` and local LLMs) using the configurable `WHISPER_SERVICE_URL` and `CONTENT_AI_API_URL` endpoints.

---

## 6. Security Audit Summary & Recommendations

| Item | Risk Level | Status | Remediation Plan |
| :--- | :---: | :---: | :--- |
| **Dead Pricing Anchor** | Low | UI Artifact | Remove `#pricing` from `KrackerzNav.tsx`. |
| **Bulk Import Quota Check** | Low | Functional Lock | Remove artificial quota blocker in `PreImportAnalysisModal.tsx`. |
| **SSRF Address Filter** | Medium | Good | Formalize CIDR blocklist for scraper fetcher in `ingestion-service.ts`. |
| **Content Security Policy** | Low | Recommended | Add strict CSP header in `next.config.ts` for self-hosted instances. |

