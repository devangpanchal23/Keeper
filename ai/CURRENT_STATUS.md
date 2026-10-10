# Current Project Status

## 2026-10-10 — Hobby cron compatibility

- Removed the once-per-minute Vercel Cron declaration that blocked deploys on Hobby.
- Added a GitHub Actions worker scheduler every five minutes using authenticated POST requests; this matches the worker route's method and avoids the Hobby Cron frequency cap.
- Before the scheduled worker can run, configure GitHub Actions variable `PRODUCTION_APP_URL` and secret `AI_WORKER_SECRET`, and set the same `AI_WORKER_SECRET` in Vercel Production. GitHub scheduled runs are best-effort and may be delayed.

## 2026-10-10 — CI/CD audit follow-up

- The supplied Actions screenshots show dependency audit and lint/type/design passing; the failing test gate prevented its dependent production build and deployment from running.
- The reported 31/166 regression failures have been corrected. `npm test` now runs through Node's `--import tsx` entrypoint and passes 166/166; this also avoids the macOS sandbox IPC `EPERM` from the `tsx` CLI.
- CI tests and quality gates do not require `.env` files or application API keys. Git ignores `.env*`; Vercel credentials are deployment-only and checked in the production deploy job. Do not add application secrets to test jobs.
- CI now publishes an always-run summary with each quality gate's result. Type-check, configured lint ceiling, and design audit pass. Local build requires Google Fonts network access, and npm audit cannot reach registry DNS; GitHub Actions must verify those gates on its runner.

## 2026-10-09 — Fail-closed CI/CD deployment pipeline

- GitHub Actions now runs lint, type checking, production dependency audit, design audit, regression suite, and production build before a main-branch production deploy. Deploy uses Vercel's prebuilt artifact flow and fails if deployment credentials are absent instead of reporting a false success.
- Production deploys are serialized, can be manually dry-run, and run live health/page/API smoke checks. A smoke failure triggers Vercel rollback. Node 24 LTS is used in GitHub Actions; Dependabot checks npm and Actions updates weekly.
- Repository owner setup remains required: add `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` to the GitHub `production` environment; configure required reviewers and restrict that environment to `main`; require the CI workflow checks in branch protection/rulesets. CI still exposes existing test/lint baseline issues; green production deploys are intentionally blocked until gates pass.

## 2026-10-10 — CI gates and regression suite repaired

- CI's dependency security gate now audits production dependencies (`npm audit --omit=dev`) to match the deploy gate. The full dependency tree contains development-only `braces@3.0.3` under `eslint-config-next` → `fast-glob` → `micromatch`; the current high-severity advisory has no patched release. Do not force a framework downgrade or weaken the production audit.
- The previous 31 regression failures are resolved. `node --import tsx scripts/run-tests.ts` passes all 166 assertions; the stale assertions now verify the current provider-required AI contract, tenant-owned collection fixtures, verified transcript reuse, source-status semantics, and archive thumbnail provenance. Organizer tag-only fallback derives evidence-linked tags from an already verified transcript, and the importer distinguishes captions from metadata while keeping AI analysis pending.
- Local validation: type-check passed; ESLint passed at its existing 262-warning ceiling; design audit passed. The user-supplied Actions run from before these local fixes confirms the dependency security audit and lint/type/design gate pass; its test failure prevented the build gate from running. Local npm audit cannot resolve `registry.npmjs.org`; local production build cannot fetch Google Geist fonts due network restrictions. Re-run CI after committing the remaining changes to confirm automated tests and production build on the Actions runner.

## 2026-10-09 — Billing profile no longer requires service-role key

- The dev log was not a syntax failure: `/api/billing` repeatedly returned 503 because the local server had no `SUPABASE_SERVICE_ROLE_KEY`.
- Billing profile GET now reads only the authenticated user's subscription/payment rows through the cookie-bound Supabase client and existing RLS policies. Privileged billing writes still require the server service-role configuration.

## 2026-10-09 — Caption and tag based organization for Reels

- The worker now accepts a sufficiently informative verified Reel/video caption or post body when a transcript is unavailable. Titles and creator names remain excluded as analysis evidence.
- If the configured content AI provider fails, Keeper extracts evidence-linked tags locally from verified source text and source hashtags, then uses those tags to match existing workspace collections. This fallback does not create new collections or claim an AI summary/asset classification.
- Full summaries and reusable-asset collection creation still require the grounded content AI service. Reel transcription still requires authorized media acquisition and a transcription provider when no usable caption exists.
- Validation results are recorded in `ai/HANDOFF.md` after the required repository gates.

## 2026-10-09 — Active tag suggestions in Universal Add Content

- The Add Content review now suggests tags automatically from available captions, title, and hashtags, and includes a Generate tags control plus manual editing/removal.
- When source details are empty it still offers platform/content-type labels, clearly only as format labels. Saved tags are synced to the workspace media record and the worker can use user-approved tags to match existing collections.

## 2026-10-09 — Tag-first automatic collection assignment

- Collection matching now prioritizes explicit tags over broad caption overlap, recognizes curated category synonyms such as Trivia → Quiz, and records a human-readable match reason.
- Auto-assignment requires a strong best match with a clear margin over the runner-up. Manual choices and learned corrections retain precedence; ambiguous items remain unassigned for review.
- The worker assigns only the primary collection, not every collection above a secondary score threshold. Ambiguous matches also suppress new collection creation.
- Added regression cases for Quiz versus Entertainment, Trivia synonym matching, and ambiguous candidates.
- Root cause follow-up: Add Content had sent a null collection even when the user had not selected General Library. The server interpreted that as `autoOrganizationDisabled=true`, blocking its later categorization. Blank-by-default saves now leave auto-organization enabled; only an explicit dropdown choice of General Library disables it.
- Category tags are now inferred from title/caption cues (including quiz/trivia and entertainment cues), and the suggestion reruns whenever the user adds, removes, or regenerates tags. Explicit Quiz intent takes precedence over broad Entertainment matches.
- If those tags point to a known category with no existing collection, the save review offers to create it (for example, Comedy) and creates/syncs it before assigning the item. The background worker also reuses or creates recognized category collections from persisted user tags, including when grounded caption analysis falls back to local tag generation.
- Collection cues include explicit quiz/trivia and comedy/creator signals; a creator name by itself is not treated as a category. Manual collection choices remain authoritative.

## 2026-10-08 — Grounded auto-collection for reusable imports

- Fixed a categorization gap where the worker waited for two previous items with the exact same topic before creating a folder; early items in a bulk import could remain uncategorized indefinitely.
- The worker can now create/reuse a collection from one strongly evidenced topic only when analysis confidence is at least 0.78 and source-grounded asset score is at least 0.72. Generic content-type/media tags and non-assets are excluded. Existing semantic matches and manual assignments still take precedence; no collection deletion is performed.
- Strengthened exact generated-topic phrase matching, so a grounded `After Effects` tag can choose an existing `After Effects Tutorials` collection instead of creating a near-duplicate.
- The worker now reuses one acquired media buffer for transcription and OCR within the same job rather than fetching the same item twice.
- Validation: type-check passes. Focused runtime assertions pass for confidence/asset gating and exact-phrase reuse. The full test harness cannot launch without uncached `tsx`; production build remains blocked fetching Geist fonts. No real STT/model/API credentials are available here.

## 2026-10-08 — Instagram preview resolver correction

- Fixed a resolver integration defect: Instagram provider thumbnails were validated and returned, then discarded because ingestion omitted the resolver's `hasAuthenticThumb` signal. Authentically sourced provider thumbnails now survive canonical resolution; embed/OG metadata with a real image can also be returned when caption/author fields are absent.
- Added regression coverage for an authentic provider thumbnail passing through the canonical preview resolver.
- Real speech transcription still requires an authorized media source and configured STT/analysis providers. This environment has no `WHISPER_SERVICE_URL`, OpenAI transcription/content-analysis keys, or authorized Instagram media access. Instagram's public guest URL alone does not supply a downloadable audio stream, so these deployment requirements cannot be replaced by title-based guesses.
- Validation this turn: `npm run type-check` passes. Focused ESLint has 0 errors (existing warnings). `npm test` stalled trying to fetch uncached `tsx`; production build is blocked by network-restricted Geist downloads from Google Fonts.

## 2026-10-07 — Autonomous content intelligence pipeline

- The authenticated ingestion route persists each imported item, its workspace-scoped job, and its usage ledger entry before asynchronous processing. Worker stages now include extraction, transcription, analysis, tagging, collection matching, organization, indexing, and terminal statuses.
- The worker stores per-item transcripts and segments, normalizes source text/OCR/transcripts with provenance, generates evidence-backed tags, classifies reusable assets only when the source provides enough text, matches existing workspace collections, respects manual collection choices, and creates collections for high-confidence reusable topics when no semantic match exists.
- Duplicate handling checks canonical URLs, platform identifiers, and sufficiently long normalized source-text fingerprints before charging usage.
- Optional Tesseract/FFmpeg OCR sidecar added under `services/ocr`; OCR requires private service deployment and `OCR_SERVICE_URL`/`OCR_SERVICE_TOKEN`.
- Added migration `supabase/migrations/202610070003_universal_ai_reprocessing.sql` for per-item transcript segments/history, processing states, source identifiers/fingerprints, duplicate handling, user collection correction persistence, AI collection creation, and reprocessing.
- `npm run type-check` passes. `npm test` is blocked because `tsx` is not installed/cached and network access is unavailable. Full lint still has unrelated existing violations (including test runner and nested worktrees). Build depends on network access to fetch Geist fonts. Live Supabase migration, Whisper/OCR, and real platform end-to-end checks remain unverified.

### Strict evidence gate follow-up

- Root cause: import path still invoked the legacy rule-based `AIPipeline` and produced title-derived tags/summaries, while the worker ran that heuristic before validating normalized source content. The worker also lacked an actual configured content-analysis provider.
- Import now creates only a queued/pending state with no generated tags or summaries. The worker excludes titles, requires verified transcripts for videos, and requires source text or OCR for other media before analysis.
- Added OpenAI-compatible `ContentAnalysisService`; requires `CONTENT_AI_API_KEY` and `CONTENT_AI_MODEL`. It validates citations against exact normalized source excerpts. Missing provider/configuration or invalid grounded output fails explicitly; item detail provides retry.
- The faster-whisper adapter is real but no `WHISPER_SERVICE_URL` or token is configured here. YouTube has no authorized audio acquisition path, Instagram guest access cannot acquire audio, and LinkedIn guest access is login-restricted; those sources now fail visibly rather than being labeled processed.
- Real-URL end-to-end acceptance remains blocked by missing provider credentials/authorized platform access and unavailable Supabase. Do not represent this pipeline as production-verified.

*Last Updated: 2026-10-02*

---

## Working (Fully Verified)

- **Instagram Bulk Import**:
  - Legacy `string_map_data` and modern `string_list_data` Meta JSON exports parse without loss.
  - Mojibake encoding corruption (e.g. `\u00c3\u00a9` -> `é`) is automatically corrected.
  - Creators, titles, original captions, and timestamps are parsed accurately.
- **Data Immutability (P0 Defect)**:
  - Authoritative Meta export metadata (`canonicalUrl`, `creator`, `caption`, `savedDate`, `shortcode`, `fbid`) cannot be overwritten by remote guest scraping, AI analysis, reprocessing, or duplicate updates.
  - Immutability regression test suite passes with 0 violations.
- **Bulk Import Engine**:
  - Pre-import 5-way breakdown (Detected, Ready, Already Saved, Batch Duplicates, Unsupported).
  - Queue execution with controlled concurrency (default: 3 workers).
  - Progress notifications and resumable state across page reloads.
- **Collection Management & Bulk Deletion**:
  - Custom collection CRUD and system collections.
  - Multi-collection unlinking (unlinks item from collection if it belongs to others; moves to Trash only if sole collection).
  - Strict multi-tenant authorization security (cross-tenant collection assignment and deletion blocked).
- **Single URL Ingestion**:
  - YouTube, YouTube Shorts, Reddit, LinkedIn, X (Twitter), and general web links.
- **Grounded AI Pipeline**:
  - 3-tier summaries (`quick`, `standard`, `detailed`).
  - Classification into `RESOURCE`, `TUTORIAL`, `NEWS`, `technical`, `inspiration`, `lifestyle`.
  - Honest fallback (`INSUFFICIENT_CONTENT`) when content is restricted.
- **AI Transcription + Intelligent Collection Organizer**:
  - Multi-stage pipeline: Media Acquisition -> Transcription -> Multimodal Evidence Aggregation -> Structured Semantic Understanding -> Collection Matching & Routing -> Safe Persistence.
  - Bounded concurrency queue (default: 3 workers) with isolated per-item failure handling.
  - High-confidence automatic assignment (`>= 0.75`), reviewable suggestion preview (`0.50 - 0.74`), and uncertain fallback (`< 0.50`).
  - Strict preservation of existing user collection taxonomy (e.g. Premiere Pro routes to "Video Editing", n8n routes to "AI & Automation").
  - Semantic Intent & Resource Trigger Extraction (`RESOURCE_ACQUISITION`, e.g. Comment "PRESET" / DM "TEMPLATE").
  - Seamless UI integration in `ImportReportView` (Select 1, Select Multiple, Select All scoped to job, and `AiOrganizeModal` scorecard).
  - Derived transcript searchable via existing `SearchService` (45-pt phrase match boost).
- **Authentic Social-Media Preview / Thumbnail Acquisition**:
  - `MediaPreviewResolver` provides deterministic 5-tier preview resolution:
    - Tier 1: Local Meta Export Media (`media/posts/*.jpg` in ZIP or authentic video frame extraction).
    - Tier 2: Durable Keeper Media Cache (`preview:${platform}:${type}:${shortcode}:v1`).
    - Tier 3: Authorized / Official Provider (oEmbed / Graph API with verified identity matching).
    - Tier 4: Supported Embed / Public Metadata (with strict guest restriction detection).
    - Tier 5: Existing Compliant Provider Abstraction.
    - Final Fallback: Honest branded vector cards (`INSTAGRAM_REEL_PLACEHOLDER` / `INSTAGRAM_POST_PLACEHOLDER`) clearly marked `"Authentic Preview Unavailable"`.
  - Canonical content identity strips tracking parameters (`utm_*`, `igsh`) ensuring two items never share cache keys and tracking URLs map to the identical preview.
  - Video-to-cover extraction generates authentic representative preview frames from Reel video bytes (`source = "export_archive_video_frame"`).
  - Carousel posts deterministically select the primary/first cover across renders.
  - Strict SSRF protection blocks private IPs (`127.0.0.1`, `169.254.169.254`, RFC 1918 subnets), non-HTTPS schemes, oversized payloads (>15MB), and unauthenticated scraping endpoints.
  - SafeMerge downgrade protection prevents weak processes or network failures from overwriting verified authentic thumbnails.
  - Existing item repair mechanism (`ReprocessingService.repairMissingPreviews`) enriches only missing/fallback items without touching healthy previews or mutating authoritative source fields.
  - Bulk imports use bounded worker concurrency (default: 3 workers) with isolated per-item failure handling.
- **Next.js 16 / React 19 Theme Pre-Hydration Architecture (`useServerInsertedHTML`)**:
  - `RootLayout` (`src/app/layout.tsx`) renders `<ThemeScript />` (`src/app/theme-script.tsx`), which uses Next.js `useServerInsertedHTML` from `'next/navigation'` to stream the `<script id="recall-theme-init">` into the initial server HTML stream outside the React component virtual DOM tree.
  - Eliminates React 19 runtime console error: `"Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client."`
  - Guarantees pre-hydration execution timing during HTML parsing before `<body>` layout/paint, completely eliminating FOUC.
  - On the client, `ThemeScript` returns `null` so React's client reconciler never encounters a script tag.
  - Retains `suppressHydrationWarning` on `<html>` to guarantee 100% hydration consistency.
- **Automated Test Suite & Service Type Alignment**:
  - TypeScript interface and method signature alignment across `ItemMetadata`, `FieldProvenance`, `Collection`, `ItemOrganizationResult`, and `OrganizationJobReport`.
  - Overloaded `CollectionOrganizerService.organizeSelectedItems` and `analyzeItem` allowing both UI batch parameter objects and test suite positional parameter calls.
  - Multi-signature `SearchService.search` allowing both client filtered search and direct library query strings.
  - Polymorphic `ReprocessingService.reprocessItem` accepting either a `SavedItem` entity or an item ID string.
  - Overloaded `CollectionOrganizerService.matchCollection` returning structured collection matches with direct `collectionId` and `suggestedCollectionName` properties.
  - 138+ tests across 27 suites passing with 0 failures (`npm test`), including Section 26 Next.js Script Architecture tests.
  - TypeScript type-check passing with 0 errors (`npm run type-check`).
  - ESLint passing with 0 errors/warnings (`npm run lint`).
  - Production Next.js build succeeding (`npm run build`).

---

## Partially Working / Limited

- **OAuth Bulk Import**:
  - OAuth flow and token encryption implemented in `OAuthSecurityService`, but production OAuth client keys for Meta/Google are not yet configured.

---

## Broken

- **Validation baseline**: Current checks remain blocked by pre-existing repository errors. On 2026-10-06, type-check reported existing errors across app and service files; lint reported 9 errors and 276 warnings. `npm test` could not fetch `tsx` from npm because network access was unavailable, and `npm run build` compiles but stops at the same existing TypeScript errors.

---

## Currently Being Investigated

- **Instagram Media Acquisition via Server-Side API**:
  - Investigating potential integration of authenticated Meta Graph API / oEmbed tokens (`INSTAGRAM_OEMBED_TOKEN` in `.env.example`) to allow automated fetching of authentic reel covers without requiring full media ZIP archives.

---

## Recently Fixed

- **Keeper Editorial Website**:
  - Replaced the public Krackerz campaign with a warm ivory, charcoal, and restrained gold editorial landing experience.
  - Follow-up legibility pass raised small landing-page copy, FAQ text, footer links, and utility labels to readable sizes, including mobile overrides.
  - Added monthly/yearly Basic and Pro pricing: monthly ₹300/₹500; yearly ₹3,500/₹5,500. Razorpay Standard Checkout creates server-side INR orders and verifies HMAC signatures and captured payment details. Verified payments add the matching credit allotment to the signed-in user's browser-local import quota. Payments are immediate, one-time; trial, recurring renewal, and server-side entitlement persistence are not implemented.
  - Increased the sticky landing navigation's viewport offset for clear top breathing room, with tighter tablet/mobile offsets.
  - Added an interactive sample-library preview with source/collection/search views, keyboard-operable controls, and touch swiping; content comes from existing seeded saves.
  - Updated sign-in/sign-up styling and visible workspace branding to Keeper while retaining existing account and capture behavior.
  - Removed unsupported promotional metrics from the public story; pricing is shown only as a clearly labeled preview until billing support is connected.

- **Test-runner merge conflict syntax error**:
  - Removed two unresolved Git conflict blocks from `scripts/run-tests.ts`.
  - Preserved the YouTube provider, platform detection, Instagram extraction, and storage-isolation tests from both conflict sides.
  - The test runner now parses and executes through all 152 assertions.

- **Instagram placeholder circular initialization**:
  - Moved the SVG fallback constants to `src/services/media/instagram-placeholders.ts` and routed internal consumers directly to this dependency-free module.
  - Preserved compatibility re-exports while removing the provider/resolver/seed-data initialization cycle.
  - `GET /app` now returns HTTP 200 instead of throwing `Cannot access 'INSTAGRAM_REEL_PLACEHOLDER' before initialization`.

- **P0 Data Mutation Overwrite**:
  - Step 6 of `IngestionService.processUrl` previously discarded export creator/caption when network fetch returned unauthenticated guest HTML. Fixed: export data now unconditionally wins.
  - `ContentService.updateItem`, `ReprocessingService.reprocessItem`, and duplicate ingestion previously performed raw object spread merges. Fixed: all writers now pass through `ContentService.safeMerge`.
- **Export Parser Field Preservation**:
  - Restored `thumbnailUrl`, `caption`, `hashtags`, and `fbid` preservation in `ExportFileParser.parseJsonExport`.
- **Resource Intent Classification**:
  - Elevated `Useful Tools` (`hasPhrase("comment asset")`) category evaluation above `Design & UX` in `AIPipeline.enrichContent`.
- **Cross-Tenant Authorization in Collections**:
  - Restricted collection authorization in `ImportJobService.createJob` and `ContentService.deleteCollectionItems` to user-owned collections.

---

## Next Priority

1. **Keep P0 Data Immutability 100% Intact**: Ensure no future modifications degrade `ContentService.safeMerge` or URL immutability.
2. **P1 Thumbnail Progression**: Investigate optional server-side Meta oEmbed / Graph API token configuration to safely acquire authentic reel covers when provided by the user.
3. **Repository AI Documentation Maintenance**: Keep `/ai` directory synchronized with every future architectural change.

## 2026-10-06 Billing and subscription implementation
- Import sync fix (2026-10-07): explicit authenticated table grants are now present for `keeper_collections`; apply `supabase/migrations/202610070002_keeper_collection_sync_grants.sql` after the AI media migration on existing projects. The ingest route now distinguishes missing schema and privilege errors. Signup confirmation is more legible at 14px with stronger contrast. Type-check and focused ESLint pass; live DB migration/import was not run here.
- Supabase browser/server clients accept `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with the legacy anon-key fallback. Next.js 16 `src/proxy.ts` refreshes auth claims/cookies for requests when Supabase is configured. Local `.env.local` values are gitignored.
- Profile now includes a Billing section backed by Supabase billing records: active plan, trial/period dates, next charge, cancellation-at-period-end, payment history, receipts, and prior plans.
- Basic/Pro monthly/yearly checkout now uses Razorpay Subscriptions with a 7-day delayed start; entitlements are calculated from durable subscription dates. Razorpay webhooks update subscription state and payment history idempotently.
- Supabase Auth is used for regular sign-up/sign-in when configured. The demo/local auth fallback remains only for local prototype mode; billing endpoints require a verified Supabase user.
- Run `supabase/migrations/202610060001_billing.sql` in the Supabase project, set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, Razorpay key ID/secret, and `RAZORPAY_WEBHOOK_SECRET`, then register `/api/webhooks/razorpay` for subscription activated/charged/cancelled/completed/halted events.
- Existing app content, collections, and import quotas remain browser-local. The billing ledger and plan tier are durable, but production-grade cross-device content/credit usage still requires moving those app records and quota enforcement server-side. Existing local accounts are not automatically migrated to Supabase Auth.
- Validation: focused ESLint passed after changes. `npm run type-check` still reports unrelated existing service/import errors; generated route types must be refreshed after route removals.
- Final gates: focused ESLint passes with 0 warnings/errors. Full `npm run lint` fails on the repository baseline (9 errors, 271 warnings outside billing changes). `npm test` cannot download `tsx` because npm registry DNS is unavailable. `npm run build` hits the known Turbopack sandbox port/process restriction; `npx next build --webpack` is blocked fetching Geist from `fonts.googleapis.com`. Full type-check reports existing unrelated errors in bulk-import/AI/collection/media/search code and none in billing changes.

## 2026-10-06 Razorpay Standard Checkout
- Added the Razorpay Node SDK and server-only credential access (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`). `.env.local` is ignored by Git; test values are stored locally and never included in source or frontend bundles.
- Added authenticated order creation and payment verification API routes. Plan and cycle amounts come from a server-side allowlist; verification checks constant-time HMAC equality, order notes/amount/currency/status, and captured payment details.
- Connected the public Basic/Pro pricing cards to Razorpay Checkout. Anonymous visitors go to sign-in and return to pricing after sign-in/sign-up. Checkout failure, cancellation, and verification results are surfaced in the pricing section.
- Pricing now discloses immediate one-time collection. Standard Checkout does not provide a 7-day trial followed by recurring charges; use Razorpay Subscriptions for that billing model. Payment success currently does not persist subscription/credit entitlements because Keeper has no billing database.
- **Prototype auth limitation:** current sign-in is localStorage-based; the payment routes can only check the existing client-generated session cookie and submitted user ID. This is not a server-verifiable production identity boundary. Replace with server-side auth before accepting live payments.
- **Signup email limitation:** account creation is localStorage-only and no mail provider is configured. A success toast is shown after account creation. Configure an email provider and move signup to a server-side account system to send a real welcome/confirmation email.
- Validation: focused ESLint passed. `npm run type-check` reports existing errors in unrelated bulk-import, AI, organization, media, collection, and search code. Full lint reports existing repository-wide errors/warnings. `npm test` could not complete because `tsx` is not installed and npm network access is unavailable. `npm run build` is blocked by Turbopack's process/port permission failure; `next build --webpack` cannot download the configured Geist fonts because network DNS is unavailable.

## 2026-10-06 Auth-Aware Navigation and Per-User Plan State
- Public landing navigation now reflects the active auth context: signed-in users see an account avatar menu with workspace/profile/logout actions; signed-out users see sign-in/create-account. Unauthenticated save CTAs lead through signup instead of opening capture.
- Logout from the public homepage clears session and routes to sign-in. The existing AppShell continues to guard workspace routes.
- Added `basic` to the user tier model. Verified checkout updates the tier on the current user's local record and adds purchased credits to that same user's import quota; the sidebar, account menu, profile, and settings all render the current tier instead of a hardcoded PRO badge. New accounts remain free.
- The built-in demo/default account and unused initial user fixture now start on Free; successful verified Basic/Pro purchases are the path that changes the signed-in user's tier.
- Validation: focused ESLint returned 0 errors with existing warnings. Type-check reports existing unrelated errors across bulk-import/services. Full lint reports repository-level baseline errors/warnings. Tests could not complete because `tsx` is not installed and npm network access is unavailable. Build is blocked by the existing sandbox Turbopack process/port failure.

## 2026-10-06 Sample Reset Billing Preservation
- Removed quota mutation from `StorageService.resetToDefaults()`, so restoring sample items and collections no longer changes the signed-in user's plan or purchased import credits.
- Removed separate Reset Limits/Reset Quota controls and their context/service APIs, which could overwrite purchased credits with the free demo allocation.
- Added a confirmation before replacing the user's saved library and clearer copy that plan and credits are retained.

## 2026-10-07 Universal Content Intelligence
- All platforms now normalize into one provenance-aware text representation before shared tag generation and collection matching. Verified transcripts/platform caption tracks remain distinguishable from extracted source text; transcript failures are retained without stopping caption/body-based analysis.
- Removed active organizer hardcoded topic mapping from item analysis. Collection suggestions use content and workspace collection descriptions/profile terms; automatic one-off collection creation is disabled. Users can edit/suppress generated tags, change collections, and explicitly accept recurring collection suggestions.
- Reprocessing now refreshes verified source data, preserves user tag corrections, resets the durable job, archives prior transcripts, and the detail page polls job state. Search indexes normalized representation text.
- Added `202610070003_universal_ai_reprocessing.sql`; apply it after the AI workspace and collection grant migrations.
- Validation: type-check passes; focused ESLint reports 0 errors (existing warnings). Tests cannot run because `tsx` is unavailable and uncached with network disabled. Full lint fails on repository errors, including nested `.kilo/worktrees`; build cannot download Geist from Google Fonts. No live Supabase/Whisper/platform end-to-end execution was available.
# 2026-10-07 — Asynchronous AI Media Architect

- Added Supabase persistence schema for workspace media, transcripts, analysis, jobs, collections/profiles, corrections, assignment memory, and an auditable usage ledger.
- URL import endpoint now requires Supabase Auth and commits deduplication, plan limit, media payload, ledger usage, and AI job through `keeper_import_media`; bulk browser workers share that endpoint.
- Added leased, retryable worker at `/api/ai/worker` and Vercel minute cron. Processing writes workspace-specific transcript, grounded enrichment, collection organization, and memory.
- Removed synchronous transcription from `IngestionService` and removed the fake speech provider behavior. A configured faster-whisper endpoint is required to produce transcripts.
- Plan rules now use Free 30 per 7-day cycle, Basic 220/month or 2,640/year, Pro unlimited. Prices remain ₹300/₹500 per month and ₹3,500/₹5,500 yearly.
- Added workspace-scoped user correction capture and a regression assertion for fake transcript rejection.
- Validation: `npm run type-check` passes. Focused ESLint passes with 0 errors. Full-repository lint still fails on unrelated existing issues, including nested `.kilo/worktrees` checkouts. `npm test` is blocked by registry DNS (`tsx` unavailable); production build is blocked by sandbox process/port permission in Turbopack.
- Production setup still requires applying both Supabase migrations, configuring Supabase + service role, Razorpay webhook, faster-whisper service, and Vercel cron secret. Existing localStorage library contents are not fully migrated to server storage. See `ai/AI_MEDIA_ARCHITECT.md`.
# 2026-10-07 — Root pipeline hardening

- OpenAI audio transcription is now a real server-side adapter (`TRANSCRIPTION_PROVIDER=auto|openai|faster-whisper`). Video is demuxed by the authenticated FFmpeg service before OpenAI receives audio. Transcript segments, duration, confidence, and provider are persisted after migration 004.
- AI analysis now requires a completed typed verified-content representation and rejects title-only metadata at the service boundary. The legacy AIPipeline uses the same grounded OpenAI analyzer and no longer returns title/creator/platform tags when source content is missing.
- Reprocessing only reuses transcripts from trusted STT/caption providers. Failed processing clears stale AI tags, summaries, analysis index rows, and AI collection assignments while retaining user tags/manual organization.
- Collection organization no longer OCRs thumbnails or uses titles/tags as content. It requires verified transcript/source text/OCR.
- Provider configuration is absent from local `.env.local`; YouTube media acquisition and LinkedIn authenticated post extraction are not implemented. Instagram media also requires configured authorized access. Do not claim real multi-platform end-to-end success until these integrations and OpenAI/Supabase configuration are available.
- Validation: typecheck passed; focused ESLint has warnings only; full lint still fails on four `require()` lint errors in the pre-existing root `run-test.js` and `scripts/run-test.js` helpers. Unit test runner cannot start because `tsx` is not cached and registry access is unavailable. Production build cannot fetch Geist fonts. Real URL pipeline tests were not possible without provider credentials/access.
## 2026-10-09 — CI failure triage (in progress)

- Updated direct production dependencies to Next.js 16.3.8 and source-map-js 1.2.2, resolving the production advisories seen in the reported CI run. Added `tsx` as a locked dev dependency and changed scripts to invoke the local binary reproducibly.
- Fixed Unicode hashtag extraction/sanitization for combining marks and preserved grounded category tags (for example Comedy/Quiz) within the generated-tag limit.
- Validation: `npm run type-check` passes; lint passes with the existing 262-warning ceiling. The suite currently reports 135/166 passing (31 failures), including external AI-provider-dependent cases and collection/content-status regressions that still need diagnosis. Do not treat this change set as production-ready until these failures are resolved.
- `npm audit` cannot reach registry.npmjs.org from this environment. The prior online audit showed production dependencies clean but the full audit still flags `braces@3.0.3` via ESLint's fast-glob/micromatch dev dependency chain; the current GitHub advisory has no patched release. Do not use `npm audit fix --force` to downgrade framework/lint packages.
- `npm run build` is blocked here because Next cannot fetch Geist/Geist Mono from Google Fonts. Re-run on a network-enabled runner or self-host the fonts. `npm test` via the tsx CLI is blocked by sandbox IPC (`listen EPERM`); `node --import tsx scripts/run-tests.ts` executes the suite and reports the failures above.
