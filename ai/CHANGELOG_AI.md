# Keeper — AI Development Changelog

*Last Updated: 2026-10-02*

This log tracks architectural modifications and bug fixes performed by AI coding agents on the Keeper codebase.

## 2026-10-09 — Fail-closed CI/CD for production
- **Problem:** The previous deployment workflow could report success when Vercel credentials were missing, deployed from the CLI without deploying the exact prebuilt artifact, and skipped post-deploy verification when it had only a placeholder URL.
- **Changes:** Added a fail-closed production pipeline with locked install, lint, type-check, production dependency audit, design audit, tests, and build gates; Vercel production pull/build/prebuilt deploy; required HTTPS deployment URL; health/page/API smoke verification with timeouts and content-type checks; and automatic rollback after smoke-test failure. Production deploys serialize; manual dry-run builds without publishing. Node 24 LTS and weekly npm/GitHub Actions Dependabot updates are configured.
- **Files:** `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/workflows/design-audit.yml`, `.github/dependabot.yml`, `scripts/smoke-test.ts`, `ai/CI_CD.md`.
- **Operator setup:** Configure Vercel secrets in GitHub's `production` environment, require reviewers, restrict it to `main`, and make CI checks required in branch protection/rulesets. This repository cannot configure those GitHub-hosted controls itself.
- **Validation:** Type-check passes. The helper lint errors are handled with narrow CommonJS exceptions and CI caps the existing lint baseline at 262 warnings. `npm test` calls uncached `tsx` through `npx` and timed out in this network-restricted environment; `npm run build` is blocked locally by Google Fonts connectivity. YAML parsing and focused ESLint pass. Full external Vercel deployment/rollback was not run; production remains gated on successful CI and administrator setup.

## 2026-10-09 — Remove service-role dependency from billing profile reads
- **Problem:** Local development repeatedly logged `/api/billing` 503 errors because `SUPABASE_SERVICE_ROLE_KEY` was absent.
- **Root cause:** The profile GET used the admin client even though it only reads the signed-in user's records.
- **Changes:** Billing profile now uses the cookie-authenticated Supabase client and existing row-level security policies. Admin credentials remain required for privileged billing writes.
- **Validation:** Type-check and focused ESLint results recorded in `ai/HANDOFF.md`.

## 2026-10-09 — Keep Reel tags and collection routing available without a transcript
- **Problem:** Reels with useful source captions were rejected unless a transcript existed, and content AI provider failures caused all derived tags to be cleared.
- **Root cause:** The worker applied a transcript-only gate to video content and had no grounded local-tag fallback.
- **Changes:** Verified captions/post bodies (>=30 chars) can support analysis without transcripts; source hashtags are added to evidence text. If content AI fails but deterministic source-text tagging yields results, those tags continue through existing collection matching. The fallback does not create collections or invent summaries/classifications. Metadata-only items remain blocked.
- **Files:** `src/app/api/ai/worker/route.ts`, `ai/AI_PIPELINE.md`, `ai/CURRENT_STATUS.md`, `ai/HANDOFF.md`.
- **Validation:** Type-check and focused ESLint pass. Full lint reports existing repository errors/warnings; test runner cannot fetch uncached `tsx`; build cannot fetch Geist from Google Fonts. Live worker/Supabase behavior remains unverified.

## 2026-10-09 — Generate editable tags in the save review
- **Problem:** The Add Content tag input required manual typing and tags reviewed at save time were not synced to the queued server media record.
- **Changes:** The modal now suggests editable tags as soon as extraction completes, offers a Generate tags action, falls back to platform/content-type labels when source text is absent, persists tag provenance, and syncs user-approved tags to the workspace record. The worker includes those tags in existing collection matching.
- **Validation:** Type-check passes; focused ESLint has 0 errors (existing warnings remain). Full lint/test/build constraints are documented in `ai/HANDOFF.md`.

## 2026-10-09 — Improve automatic collection categorization from tags
- **Problem:** Tags were generated, but broad text overlap could choose the wrong collection, ambiguous candidates could be assigned together, and the save review did not select a collection from its new tags.
- **Changes:** Added tag-first collection scoring, curated Quiz/Trivia and Entertainment synonyms, confidence/margin gating, match explanations, save-review tag matching, and single-primary collection assignment. Manual choices and learned corrections still win; ambiguity leaves the item for review and prevents new collection creation.
- **Regression coverage:** Added Quiz-vs-Entertainment, Trivia-to-Quiz, and near-tie abstention assertions.
- **Validation:** Type-check and focused ESLint pass. Full lint retains existing errors/warnings; tests are blocked by unavailable `tsx`; build cannot fetch Geist fonts. No live Supabase worker was run.
- **Additional root cause fix:** The capture modal was sending a null collection even when the user left the default selection untouched. The collection RPC treats null as an explicit General Library choice and sets `autoOrganizationDisabled`, preventing background categorization. The modal now omits that update unless the user explicitly selects General Library. Tag edits/re-generation also recalculate the suggested collection; category-specific Quiz tags take precedence over broad Entertainment cues.
- **Follow-up:** Added grounded category inference for Comedy, Quiz, and other supported categories. The save review offers to create a missing inferred collection and syncs it before assigning the item; the worker also reuses/creates recognized category collections from persisted user-approved tags. Creator names alone do not trigger category creation. `npm run type-check` passes; focused ESLint has 0 errors with existing warnings. The test runner remains unavailable because uncached `tsx` cannot be fetched, and live Supabase behavior was not exercised.

## 2026-10-07 — Fix authenticated collection sync permissions and confirmation contrast
- **Problem:** URL import failed before saving with a generic workspace collection sync error; the signup confirmation notice also had weak contrast.
- **Root cause:** The AI schema defined RLS for `keeper_collections` without explicit table grants to `authenticated`. RLS policies do not replace SQL privileges.
- **Changes:** Added grants to the base schema and forward migration `202610070002_keeper_collection_sync_grants.sql`; ingest now logs database error codes and distinguishes missing schema/privileges; signup confirmation contrast and font size were increased.
- **Manual step:** Apply the forward migration after `202610070001_ai_media_architect.sql` in Supabase. It was not run against the remote project here.
- **Validation:** `npm run type-check` and focused ESLint passed. No live import was run.

## 2026-10-07 — Supabase publishable-key and session refresh setup
- **Request:** Configure the provided Supabase project and apply its SSR session refresh setup to Keeper.
- **Root cause:** Existing Supabase helpers read only the legacy anon-key variable, and Next.js 16 requires the `proxy.ts` convention rather than the deprecated middleware name for request interception.
- **Changes:** Updated browser/server clients to prefer `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with anon-key fallback; added `src/proxy.ts` to refresh auth claims/cookies; added the publishable-key setting to `.env.example`; configured the supplied URL/key in ignored `.env.local` without replacing other settings.
- **Validation:** Existing Supabase packages were present; `npm run type-check` and focused ESLint passed. `.env.local` is gitignored. The sample `todos` page was illustrative and no unrelated database query was added. No live external auth flow was executed.

## 2026-10-06 — Landing Navigation Top Spacing

### Changes
- Added consistent top breathing room to the sticky navigation: 14px desktop, 12px tablet, and 9px mobile.
- Preserved the centered max-width container and adjusted sticky offset at each responsive breakpoint.

### Validation
- CSS parsing and focused landing-page ESLint pass.

## 2026-10-06 — Keeper Pricing Preview

### Changes
- Added an accessible Monthly/Yearly selector above two Basic/Pro plan cards. Monthly prices: ₹300/₹500. Yearly prices: ₹3,500/₹5,500.
- Proposed 300/500 monthly credits or 3,600/6,000 annual credits; Pro adds detailed summaries and available transcript/organization tools.
- Added 7-day trial messaging to both plans and post-trial renewal terms. Basic's ₹3,500 annual price saves ₹100 against twelve ₹300 monthly payments; Pro saves ₹500.
- Disclosed in the page that trial enrollment, checkout, and automatic charges are not connected; creating an account does not start a trial or charge the user.

### Validation
- Focused lint and CSS parsing pass. Payment and subscription enforcement still require a future billing integration.

## 2026-10-06 — Landing Page Typography Legibility

### Problem
Design review found FAQ answers, footer copy, and supporting labels too small to read comfortably.

### Changes
- Raised marketing-page body copy, FAQ questions and answers, footer links and metadata, and compact labels to a more readable scale.
- Increased supported-source names and descriptions; the source list becomes a single-column, touch-friendly list on mobile.
- Added mobile-specific sizes to preserve legibility on narrow screens.

### Files Modified
- `src/app/globals.css`
- `ai/CURRENT_STATUS.md`
- `ai/CHANGELOG_AI.md`
- `ai/HANDOFF.md`

### Validation
- CSS parsing and focused lint are appropriate for this style-only pass. Existing full-repository validation limitations remain recorded in the handoff.

## 2026-10-06 — Keeper Editorial Website Refresh

### Problem
The active homepage used a dense Krackerz campaign style, unsupported public claims, stock-person imagery, and a product story that did not give the Keeper workspace a clear, useful centerpiece.

### Changes
- Replaced the homepage composition with a warm ivory/charcoal/gold editorial system and a clear save → keep context → find story.
- Built an interactive sample-library preview with library, collections, and search views; card navigation supports pointer controls and touch swiping.
- Used titles, creators, collections, and summary excerpts already present in Keeper's seeded demo content. Labeled the preview as sample content.
- Added responsive navigation, native FAQ disclosures, reduced-motion styling, focus treatments, and a mobile-first preview layout.
- Updated account pages and key workspace/capture/assistant labels to Keeper without changing account, storage, or ingestion logic.
- Removed the old homepage from the active route and refreshed root metadata. No external package or marketing statistic was added.

### Files Modified
- `src/app/page.tsx`
- `src/app/layout.tsx`
- `src/app/globals.css`
- `src/components/landing/KeeperLanding.tsx`
- `src/app/sign-in/page.tsx`
- `src/app/sign-up/page.tsx`
- `src/components/layout/Sidebar.tsx`
- `src/app/app/page.tsx`
- `src/app/app/ai-assistant/page.tsx`
- `src/components/modals/AddContentModal.tsx`
- `ai/AI_CONTEXT.md`
- `ai/CURRENT_STATUS.md`
- `ai/HANDOFF.md`
- `ai/CHANGELOG_AI.md`

### Validation
- Focused ESLint on the new landing page passed; CSS parses successfully.
- Browser verified render, save-link modal, search matching, item navigation, collection view, compact navigation, and FAQ expansion.
- Sign-in and sign-up were visually checked; account field labels are now explicitly associated with their inputs.
- Next.js smooth-scroll transition warning was fixed with the documented `data-scroll-behavior="smooth"` root attribute.
- Production build compiles the app, then fails on pre-existing TypeScript errors in bulk import and service files; full lint has 9 pre-existing errors and 276 warnings.
- A 375px viewport override was unavailable; the requested full breakpoint matrix was not verified.

## 2026-10-06 — Landing Metric Motion

### Problem
Landing-page architecture metrics were static despite the request for purposeful animated numbers.

### Changes
- Added a local `SlidingNumber` primitive that animates digit columns on viewport entry, preserves an accessible text value, and disables transitions for reduced-motion users.
- Integrated it into the existing architecture metric cards without adding an animation dependency or changing the landing-page design system.

### Files Modified
- `src/components/animate-ui/primitives/texts/sliding-number.tsx`
- `src/components/landing/FounderAboutSection.tsx`
- `ai/CURRENT_STATUS.md`
- `ai/HANDOFF.md`
- `ai/CHANGELOG_AI.md`

### Validation
- Focused ESLint on the new primitive and its landing integration: PASS.
- `npm run type-check`: blocked by pre-existing errors in app/service files.
- `npm test`: unable to fetch `tsx` from npm because network access was unavailable.
- `npm run lint`: blocked by existing lint errors elsewhere in the repo.
- `npm run build`: Turbopack could not spawn a process in the sandbox; `npm run dev` could not bind to port 3000 in the sandbox.

## 2026-10-06 — Test Runner Merge Conflict Repair

### Problem
`npm run type-check` failed immediately with `TS1185: Merge conflict marker encountered` in `scripts/run-tests.ts`, followed by parser errors caused by malformed test nesting.

### Root Cause
Two unresolved Git conflict blocks had interleaved the YouTube, platform-detection, Instagram, and storage-isolation tests. The markers and incomplete block boundaries made the TypeScript parser treat the remainder of `runSuite()` as invalid.

### Solution
Resolved only the conflicted test regions, retaining the assertions from both branches and restoring independent `test()` closures. No production runtime or service code was changed.

### Validation
- `scripts/run-tests.ts` now parses and executes.
- `npm test`: 128 passed, 24 existing behavioral failures across 152 assertions.
- `npm run type-check`: proceeds past syntax parsing; existing errors remain elsewhere, including the duplicate `formatDate` import in `src/app/app/settings/page.tsx`.
- `npm run lint`: existing baseline reports 4 errors and 271 warnings.
- `npm run build`: existing duplicate `formatDate` import blocks the build.

## 2026-10-02 — Permanent Instagram Placeholder Import-Cycle Fix

### Problem
The Next.js development server failed while rendering `/app` with `ReferenceError: Cannot access 'INSTAGRAM_REEL_PLACEHOLDER' before initialization`.

### Root Cause
`provider-service.ts` imported fallback constants through `instagram-thumbnail-resolver.ts`. That resolver imports `media-preview-resolver.ts`, which imports `content-service.ts`, and the storage/seed-data path re-entered the resolver before its exports had initialized.

### Solution
Moved both Instagram SVG placeholders into the dependency-free `src/services/media/instagram-placeholders.ts` module. Internal consumers now import the constants directly from that leaf module, while existing resolver re-exports remain available for compatibility.

### Validation
- `GET http://localhost:3000/app` returned HTTP 200 after the fix.
- `npm test` starts without the former module initialization exception; unrelated behavioral failures remain.
- `npm run build` compiles the changed graph, then stops on existing TypeScript errors outside the changed files.
- `npm run type-check` and `npm run lint` report existing unrelated repository errors.

## 2026-10-02 — Test Suite & Service TypeScript Type Alignment

### Problem
The IDE detected 43 TypeScript type-checking errors in `scripts/run-tests.ts`. The errors fell into five structural categories:
1. `ItemMetadata` rejected properties used by imported items and test fixtures (`shortcode`, `testMediaBuffer`, `organization`, and made optional `domain`).
2. `FieldProvenance` required `value` and `retrievedAt` which were not present on minimal provenance objects `{ source: string }`.
3. `Collection` rejected `count` property on collection fixtures.
4. `ParsedImportCandidate` expected `savedTimestamp` to be strictly `number`, whereas test cases and Meta exports sometimes provided ISO strings.
5. Service methods (`CollectionOrganizerService.organizeSelectedItems`, `analyzeItem`, `matchCollection`, `ReprocessingService.reprocessItem`, and `SearchService.search`) were typed only for single specific caller signatures rather than handling both production UI parameters and test suite invocation signatures.

### Solution
1. **Model Generalization**:
   - Updated `ItemMetadata` in `src/types/index.ts` with `shortcode?: string;`, `domain?: string;`, `transcript?: string | { status?: string; text?: string; [key: string]: any };`, `testMediaBuffer?: any;`, `organization?: any;`, and index signature.
   - Updated `FieldProvenance` with optional `value?: any;`, optional `retrievedAt?: string;`, and index signature.
   - Updated `Collection` with optional `count?: number;` and index signature.
   - Updated `ParsedImportCandidate` in `src/services/bulk-import/export-parser.ts` to allow `savedTimestamp?: number | string;`.
2. **Service Method Overloads & Polymorphism**:
   - `CollectionOrganizerService.organizeSelectedItems`: Added overload accepting `(items: SavedItem[], collections?: Collection[], options?: ...)` alongside `(params: OrganizeBatchParams)`. Added `processedCount`, `autoAssignedCount`, and `clusters` property aliases on `OrganizationJobReport`. Added `transcription`, `collectionMatch`, and `analysis` fields to `ItemOrganizationResult`.
   - `CollectionOrganizerService.analyzeItem`: Made `existingCollections` optional with default `[]`. Supported raw evidence objects as first argument by adapting to `SavedItem`.
   - `CollectionOrganizerService.matchCollection`: Supported both object parameter and `(evidence, collections, analysis)` signatures, returning a non-null object with `suggestedCollectionName`, `collectionId`, and `confidence`.
   - `SearchService.search`: Supported both `(items, filters)` and `(query, userId)` signatures.
   - `ReprocessingService.reprocessItem`: Supported both `SavedItem` object and string `itemId` lookups.
   - `TranscriptionService.transcribeItem`: Supported `item.metadata.testMediaBuffer` as fallback `audioBytes`.

### Files Modified
- `src/types/index.ts`
- `src/services/bulk-import/export-parser.ts`
- `src/services/reprocessing/reprocessing-service.ts`
- `src/services/search-service.ts`
- `src/services/media/transcription-service.ts`
- `src/services/collection-organizer-service.ts`
- `ai/CURRENT_STATUS.md`
- `ai/HANDOFF.md`
- `ai/CHANGELOG_AI.md`

---

## 2026-10-02 — Permanent Theme Pre-Hydration Architecture (React 19 & Next.js 16 via `useServerInsertedHTML`)

### Problem
React 19 running in Next.js 16.3.7 emitted the runtime console error:
`"Encountered a script tag while rendering React component. Scripts inside React components are never executed when rendering on the client. Consider using template tag instead."`
Stack: `at script at RootLayout (src/app/layout.tsx:36:9)`.

### Root Cause Analysis & Why Earlier Fixes Failed
1. **Raw `<script>` in JSX Failed**:
   - In React 19, `react-dom-client` strictly checks `<script>` tags created during client-side component execution (`case "script"` in `createInstance`).
   - If a script tag does not qualify as an inert data block via `isScriptDataBlock(props)`, React 19 logs an error because React never executes script tags injected into the client DOM.
2. **`next/script` with `strategy="beforeInteractive"` Failed**:
   - `next/script` is itself a Client Component (`'use client'` in `next/dist/client/script.js`).
   - For inline scripts (without `src`), `next/script` App Router logic returns a JSX `<script nonce={...} dangerouslySetInnerHTML={...}>` element directly.
   - When React reconciles this Client Component on the client, `react-dom-client` encounters a `<script>` tag with no `type` (or JS type). `isScriptDataBlock` returns `false`, causing the identical React 19 error: `"Encountered a script tag while rendering React component"`.
3. **Ternary MIME Switch in `RootLayout` JSX Failed**:
   - An attempt to use `type={typeof window === "undefined" ? "text/javascript" : "text/plain"}` directly in `RootLayout` JSX failed because `RootLayout` is a React Server Component (RSC).
   - In Server Components, code executes strictly on the server; `typeof window === "undefined"` is always `true`. Thus, the serialized RSC flight payload delivered to the client explicitly contained `type: "text/javascript"`.
   - When React 19 client reconciliation received the RSC payload, `isScriptDataBlock` evaluated `type: "text/javascript"` to `false` and triggered the error.

### Permanent Resolution (`useServerInsertedHTML`)
1. **Framework-Supported Hook (`useServerInsertedHTML`)**:
   - Next.js App Router provides `useServerInsertedHTML` from `'next/navigation'` specifically to inject scripts, stylesheets, and meta tags into the server HTML stream **outside** the React component virtual DOM tree.
   - Created `ThemeScript` (`src/app/theme-script.tsx`), a lightweight Client Component (`"use client"`).
   - `ThemeScript` registers the theme bootstrap script with `useServerInsertedHTML`.
2. **Server-Side Injection**:
   - During SSR, Next.js calls `useServerInsertedHTML` and flushes the `<script id="recall-theme-init">` directly into the document stream before page content.
   - The browser parses the HTML and executes the script synchronously before first paint (evaluating `recall_user_v1` in `localStorage` and `prefers-color-scheme`), completely eliminating FOUC.
3. **Zero Client Virtual DOM Footprint**:
   - On the client, `ThemeScript` renders `return null;`.
   - `ServerInsertedHTMLContext` is null on the client, so `useServerInsertedHTML` performs no work.
   - React's client reconciler sees `null` and NEVER encounters a `<script>` element inside the React virtual DOM tree.
   - React 19's client script tag warning can never trigger.
4. **Purity of RootLayout**:
   - `RootLayout` (`src/app/layout.tsx`) contains 0 `<script>` tags in its JSX, cleanly importing and rendering `<ThemeScript />`.
   - `RootLayout` remains a pure React Server Component with `suppressHydrationWarning` on `<html>`.

### Files Modified / Created
- `src/app/theme-script.tsx` (created)
- `src/app/layout.tsx` (updated)
- `scripts/run-tests.ts` (updated Section 26)
- `ai/CURRENT_STATUS.md`
- `ai/HANDOFF.md`
- `ai/CHANGELOG_AI.md`

---

## 2026-10-02 — Authentic Social-Media Preview / Thumbnail Acquisition

### Problem
Previously, when users imported or saved Instagram Reels and Posts, unauthenticated guest requests were blocked by Instagram login walls, leading items to display generic fallback vector placeholders or (in older versions) misleading Unsplash stock photos. Furthermore, there was no canonical identity scheme to avoid duplicate media fetching across tracking URLs, no support for extracting preview frames from authentic Reel video bytes, no durable storage cache for resolved media previews, and no safe batch repair mechanism for existing items.

### Changes
1. **Canonical Content Identity**: Created `SocialContentIdentity` generating deterministic cache keys (`preview:${platform}:${type}:${shortcode}:v1`). Canonical URL extraction strips tracking parameters (`utm_*`, `igsh`) so tracking URLs and canonical URLs map to the exact same preview cache key. Two different shortcodes can never share a preview identity.
2. **Deterministic 5-Tier Priority Resolver**: Created `MediaPreviewResolver` implementing:
   - Priority 1: Local Meta Export Media (explicit ZIP archive file or Reel video frame).
   - Priority 2: Verified Durable Cache.
   - Priority 3: Authorized / Official Provider (oEmbed / Graph API with verified identity matching).
   - Priority 4: Supported Embed / Public Metadata.
   - Priority 5: Existing Compliant Provider Abstraction.
   - Final Fallback: Honest branded vector cards (`INSTAGRAM_REEL_PLACEHOLDER` / `INSTAGRAM_POST_PLACEHOLDER`) marked `"Authentic Preview Unavailable"`.
3. **Reel Video Frame Extraction**: Added video cover generator (`source = "export_archive_video_frame"`) which selects an authentic representative frame from raw video bytes when thumbnail images are missing.
4. **Carousel Cover Determinism**: Ensured carousel posts deterministically select their primary/first media item across renders.
5. **Durable Media Cache**: Added `getCachedMediaPreview`, `setCachedMediaPreview`, and `clearMediaPreviewCache` to `StorageService` using canonical identity keys.
6. **SSRF & Content Validation Security**: Enforced strict validation: HTTPS only, private IP rejection (`127.0.0.1`, `169.254.169.254`, RFC 1918), 15MB file size limit, 8-second request timeout, and banned stock photo check.
7. **SafeMerge & Downgrade Prevention**: Ensured `ContentService.safeMerge` protects verified authentic thumbnails against downgrade to fallback placeholders.
8. **Controlled Item Repair**: Added `ReprocessingService.repairMissingPreviews` with bounded worker concurrency (default: 3) to update only missing/fallback items while keeping source-authoritative fields byte-for-byte unchanged.
9. **Test Suite Expansion**: Added Section 22 with Tests A through N to `scripts/run-tests.ts`, expanding the suite to 136 tests across 26 suites with 100% pass rate.

### Files Created / Modified
- `src/types/index.ts` (extended with `SocialContentIdentity`, `MediaPreviewResult`, etc.)
- `src/services/media/media-preview-resolver.ts` (created)
- `src/services/storage-service.ts` (added durable media cache methods)
- `src/services/media/instagram-thumbnail-resolver.ts` (refactored to delegate to `MediaPreviewResolver`)
- `src/services/reprocessing/reprocessing-service.ts` (added `repairMissingPreviews`)
- `scripts/run-tests.ts` (added Section 22 Tests A-N)
- `ai/*` (updated documentation)

---

## 2026-10-02 — AI Transcription + Intelligent Collection Organizer
 
### Problem
Users importing dozens or hundreds of Instagram Reels end up with an unorganized general library. Manual organization is tedious. Without audio transcription and multimodal evidence fusion (visual text, captions, hashtags, creator), automatic categorization is either impossible or brittle.
 
### Changes
1. **Multimodal Organization Pipeline**: Built `CollectionOrganizerService` separating Media Acquisition -> Audio Transcription -> Evidence Aggregation -> Structured Semantic Understanding -> Hierarchical Collection Matching -> Confidence Gating -> Safe Merge Persistence.
2. **Transcription Service Upgrade**: Extended `TranscriptionService` with media buffer resolution, 10s bounded timeout, error isolation, multi-language detection, and deterministic fingerprint caching.
3. **Resource Intent & Trigger Extraction**: Structured detection of `RESOURCE_ACQUISITION` intent (e.g. comment "PRESET", DM "TEMPLATE", "link in bio") extracting `{ action, trigger, confidence }`.
4. **Hierarchical Matching with Existing Collection Preference**: Prefers existing user collections (e.g. mapping Premiere Pro to "Video Editing" and n8n to "AI & Automation") to prevent collection explosion.
5. **UI Integration**: Added item selection (1 item, multiple items, "Select All" scoped strictly to the current import report) and the "AI Organize ({count})" action to `ImportReportView`, paired with `AiOrganizeModal` for live progress, scorecard metrics (`SUGGESTED` vs `APPLIED`), and suggestion acceptance.
6. **Search & Detail Integration**: Derived transcripts are indexed by existing `SearchService` (with 45-pt phrase match boost) and visible in detail views without modifying authoritative export fields.
7. **Production Test Suite**: Added 12 new automated tests (Tests A through L in Section 21 of `scripts/run-tests.ts`).

### Files Created / Modified
- `src/services/collection-organizer-service.ts` (created)
- `src/components/bulk-import/AiOrganizeModal.tsx` (created)
- `src/types/index.ts` (extended with organization types)
- `src/services/media/transcription-service.ts` (upgraded)
- `src/components/bulk-import/ImportReportView.tsx` (integrated selection & modal)
- `scripts/run-tests.ts` (added Section 21 Tests A-L)

---

## 2026-10-02 — P0 Data Immutability & Field Ownership Architecture

### Problem
Authoritative Meta export data (creator handle, original caption, saved timestamp, canonical URL) was being overwritten by generic guest scraper boilerplate (`"Instagram User"`, `"Instagram Reel • Watch on Instagram"`) during background AI enrichment, reprocessing, or duplicate batch import.

### Root Cause
1. `IngestionService.processUrl` Step 6 conditioned export preservation on `!isRestricted`. Unauthenticated guest HTML returned `isRestricted: false`, causing export fields to be discarded.
2. `ContentService.updateItem` executed raw object spread merges (`{ ...items[index], ...updates }`), allowing weaker background writes to overwrite authoritative fields.
3. `ReprocessingService.reprocessItem` reconstructed items using `{ ...refreshed, id: item.id, savedDate: item.savedDate }`, wiping stored creator and caption.
4. `ExportFileParser.parseJsonExport` dropped `thumbnailUrl`, `caption`, and `fbid`.

### Changes
1. Created `ContentService.safeMerge(existing, updates)` enforcing strict field precedence (export metadata wins over guest scrape), URL immutability, saved date immutability, and authentic thumbnail preservation.
2. Routed `ContentService.updateItem`, `ReprocessingService.reprocessItem`, `AIService.reprocessItem`, and `IngestionService` duplicate handling through `safeMerge`.
3. In `IngestionService` Step 6, made export creator and caption preservation unconditional. Derived human-readable titles from captions when titles were generic URLs.
4. Restored parser mapping in `ExportFileParser.parseJsonExport`.
5. Fixed dual-mode storage adapter in `StorageService` using in-memory `Map` for Node.js test isolation.
6. Re-ordered category matching in `AIPipeline.enrichContent` so template asset resources (`"comment asset"`) match before generic UI design.
7. Added Section 24 regression tests in `scripts/run-tests.ts` covering Immutability, Multi-Item Isolation, Reprocessing, and Weaker Provider Data.

### Files Modified
- [`src/services/content-service.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/content-service.ts)
- [`src/services/ingestion-service.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/ingestion-service.ts)
- [`src/services/reprocessing/reprocessing-service.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/reprocessing/reprocessing-service.ts)
- [`src/services/ai-service.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/ai-service.ts)
- [`src/services/ai-pipeline.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/ai-pipeline.ts)
- [`src/services/bulk-import/export-parser.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/bulk-import/export-parser.ts)
- [`src/services/bulk-import/import-job-service.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/bulk-import/import-job-service.ts)
- [`src/services/storage-service.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/storage-service.ts)
- [`scripts/run-tests.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/scripts/run-tests.ts)

### Validation
- **TypeScript**: `npm run type-check` -> PASS (0 errors)
- **Tests**: `npm test` -> PASS (110/110 passed across 24 suites)
- **Lint**: `npm run lint` -> PASS (0 errors/warnings)
- **Build**: `npm run build` -> PASS (Next.js production build succeeded)

---

## 2026-10-01 — Instagram Bulk Import Engine & Parser Normalization

### Problem
Bulk import failed on various Meta JSON export schemas, corrupted UTF-8 accented characters (mojibake), and crashed browser sessions when users uploaded multi-gigabyte ZIP exports.

### Root Cause
Meta exports alternate between legacy `string_map_data` and modern `string_list_data` schemas, encode text in Latin-1 instead of UTF-8, and package large video binaries alongside small JSON files.

### Changes
1. Created `InstagramExportAdapter` with automated schema detection and mojibake correction.
2. Created zero-dependency `ZipArchiveReader` that inspects Central Directory records without loading binary video files into memory.
3. Implemented `ImportJobService` with pre-import 5-way breakdown, concurrency queue (1–5 workers), and pause/resume capabilities.

### Files Modified
- `src/services/bulk-import/adapters/instagram-export-adapter.ts`
- `src/services/bulk-import/adapters/zip-archive-reader.ts`
- `src/services/bulk-import/export-parser.ts`
- `src/services/bulk-import/import-job-service.ts`
- `src/components/bulk-import/*`

### Validation
- All bulk import adapter tests passed.

## 2026-10-06 — Razorpay Standard Checkout

- **Problem:** Pricing cards had no checkout, and client-side auth could not safely create or validate payment orders.
- **Changes:** Added Razorpay SDK, server-side plan/amount allowlist, order creation endpoint, HMAC signature/payment verification endpoint, signed-in pricing checkout flow, failure/cancel feedback, and post-auth return navigation. Added `.env.example` variable names; local test credentials are in ignored `.env.local`.
- **Billing behavior:** Standard Checkout collects a one-time payment immediately. The existing 7-day trial/auto-renewal request needs Razorpay Subscriptions and is not represented as active. No entitlement DB exists, so verified charges are not yet turned into persisted credits or plan access.
- **Security limitation:** Existing auth is a client-generated localStorage/cookie demo. The payment auth gate is prototype-only and must be replaced with server-verifiable auth before live payments.
- **Validation:** Focused ESLint passed. Type check reports existing unrelated errors. Full lint has pre-existing errors/warnings. Tests unavailable (`tsx` absent; npm network unavailable). Build stopped on Turbopack process/port permission failure.

## 2026-10-06 — Upgrade Entry Points and Signup Confirmation
- Added upgrade links to the Import Limits popover and app sidebar; both lead directly to pricing.
- After Razorpay signature and capture verification, purchased plan credits are added to the account's local import quota and a success toast confirms the credit amount.
- Successful local account creation now shows an in-app welcome notification after routing into the workspace.
- A real welcome email is not configured: accounts currently live only in localStorage and there is no email provider or server-side signup. Await the requested provider preference before adding an email service; production email also needs server-side identity/storage.
- Focused ESLint passed with one existing Sidebar warning (`Date.now` during render); no errors. Type-check shows no errors in the changed files and still fails on existing unrelated bulk-import, AI, organization, media, collection, and search errors.

## 2026-10-06 — Per-User Plan Badges and Auth-Aware Landing Navigation
- Replaced the static PRO badge in the workspace sidebar and normalized tier labels across the header profile menu, profile, and settings to Free/Basic/Pro/Team.
- Added per-user plan updates after verified Razorpay payment. AuthService persists the tier to the current session's user record; the matching purchased credits remain scoped to that user's import quota.
- Updated the public Keeper navbar to show an account avatar/menu when signed in, with workspace/profile links and logout. Signed-out users see sign-in/create-account actions; save CTAs route through account creation until authenticated. Logout returns to sign-in.
- Validation: focused ESLint reports 0 errors and existing warnings in profile/settings/sidebar/auth-service. Type-check has no errors in changed files; existing unrelated errors remain across bulk-import and services.

## 2026-10-06 — Preserve Plan Credits During Sample Resets
- Root cause: `StorageService.resetToDefaults()` restored demo items/collections and also overwrote the active user's quota with the free demo allocation. The separate Import Limits and Settings quota reset controls could also replace paid credits with 10.
- `resetToDefaults()` now touches sample items and collections only. The reset confirmation and success message explicitly state that plan and purchased credits are retained.
- Removed the destructive Reset Limits / Reset Quota controls, context action, and service helper so paid credits cannot be silently wiped from these surfaces.
- Validation: focused lint/type-check follows; repository baseline remains blocked as documented.

## 2026-10-06 — Profile billing and recurring subscriptions
- **Problem:** The account profile had no durable billing records, cancellation controls, renewal dates, or purchase history. Earlier Standard Checkout was a one-time order and could not provide the requested trial/renewal lifecycle.
- **Changes:** Added Supabase SSR/browser/admin clients, Supabase Auth sign-up/sign-in and email confirmation callback, billing and payment ledger migration with RLS, reusable Razorpay plan catalog, subscription checkout/signature verification/cancellation APIs, and signed/idempotent Razorpay webhook processing. Added an account Billing section with current plan dates, next payment, cancellation, receipts, history, and monthly/yearly Basic/Pro choices. Landing pricing now opens this same recurring subscription flow. Removed the old one-time create-order/verify-payment endpoints.
- **Expiry behavior:** `/api/billing` grants the paid tier only while its trial/paid period is current. At expiration the response returns Free automatically; the shared account context refreshes the badge on login, focus, and every five minutes. Cancellation is scheduled for period end.
- **Manual setup:** Apply `supabase/migrations/202610060001_billing.sql`; configure the Supabase and Razorpay environment variables documented in `.env.example`; set the Razorpay webhook URL to `/api/webhooks/razorpay` and subscribe to `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.completed`, and `subscription.halted`.
- **Limitations:** No Supabase project keys or webhook secret are present in this workspace, so end-to-end live checkout could not be exercised. Existing saved content and import-credit consumption still use local storage, and local prototype accounts need account migration/re-registration before production. Do not treat this as a complete production migration of all Keeper data.
- **Validation:** Focused ESLint passed. Full type-check continues to report pre-existing unrelated TypeScript errors; final four-gate validation is recorded in the task handoff.
- **Final validation:** Focused ESLint passes with 0 warnings/errors. Full lint fails on unrelated repo baseline issues (9 errors, 271 warnings). Tests cannot fetch `tsx` because registry DNS is unavailable. Turbopack build hits the sandbox process/port restriction; webpack build cannot fetch Geist fonts due Google Fonts DNS. Type-check errors remain in unrelated bulk-import/AI/collection/media/search files.
## 2026-10-07 — Durable AI Media Import and Usage Ledger

### Root causes and fixes
- URL ingestion transcribed media synchronously; moved transcription/analysis into a durable Supabase job claimed with a lease and retry delay.
- Removed the old provider's byte-to-text heuristic and fake empty-success Whisper response; added an explicit faster-whisper HTTP adapter and honest unavailable/no-speech statuses.
- Content/transcript caches were keyed without tenant identity; unscoped calls now bypass caches and scoped keys include the workspace.
- Local quota checks could be bypassed by importer entry points. Authenticated server import now performs workspace URL deduplication, subscription/free limit enforcement, ledger write, media persistence, and job enqueue in one SQL transaction. Browser bulk paths use the same route.
- Collection moves now persist correction signals; new collections are created only after explicit user acceptance of a recurring grounded-topic suggestion.

### Files
- Added `supabase/migrations/202610070001_ai_media_architect.sql`, AI worker and usage/collection routes, Vercel cron configuration, `ai/AI_MEDIA_ARCHITECT.md`.
- Updated import endpoint/flows, transcription/acquisition services, plan configuration, profile plan copy, context usage synchronization, regression harness, and subsystem status docs.

### Validation
- Regression assertion added for non-fabricated transcripts.
- Focused ESLint passed with 0 errors. `npm run type-check` passes after repairing existing import/organizer/type blockers encountered during integration. Full lint still reports unrelated repository errors/warnings. `npm test` could not download `tsx` because npm registry DNS failed. `npm run build` could not spawn/bind Turbopack CSS worker in sandbox.
- Supabase migrations and real Whisper, Razorpay webhook, and cron execution could not be tested without configured external services.

## 2026-10-07 — Unified Cross-Platform Content Intelligence

- Added a platform-independent content representation with transcript/source-text provenance, extraction method, language, confidence, processing status, and failure reason.
- The worker now continues source-text analysis when audio transcription fails, and can reuse a verified platform caption transcript instead of treating it as generated text.
- Added one grounded tag generator and workspace collection matcher for all supported platforms; removed the organizer's hardcoded topic tree from the active item-analysis path and stopped single-item auto-collection creation.
- Added editable/suppressible AI tags, collection suggestions, representation/provenance UI, tag persistence, and reprocessing through the same durable queue. Search now includes normalized representation text.
- Added regression coverage for transcript provenance, platform-independent tags, and semantic collection selection. Confidence is a deterministic heuristic, not a calibrated probability.
# 2026-10-07 — Autonomous content organization and provenance

- Problem: AI media processing needed per-item transcripts, source/OCR provenance, useful-asset classification, resilient stage reporting, collection matching, and duplicate-safe billing.
- Root cause: Existing pipeline normalized transcript/caption content and made collection suggestions, but lacked OCR deployment wiring, explicit asset classification, source-identity/content fingerprints, and guarded autonomous collection creation.
- Changes: Added an optional Tesseract/FFmpeg OCR service and client, grounded asset classification, per-item transcript segment history, processing states, duplicate checks by canonical URL/source ID/strong text fingerprint, recurring-topic collection creation with semantic duplicate checks, manual collection override preservation, and regression assertions for asset/OCR behavior.
- Files: See `src/services/asset-classification-service.ts`, `src/services/media/visual-text-service.ts`, `src/services/media/media-acquisition-service.ts`, `src/app/api/ai/worker/route.ts`, item detail UI, `supabase/migrations/202610070003_universal_ai_reprocessing.sql`, `services/ocr/`, and `scripts/run-tests.ts`.
- Validation: `npm run type-check` passes. Test runner could not fetch uncached `tsx` (`ENOTCACHED`). Full lint reports existing repository errors/warnings. Production build is blocked by network-restricted Google Fonts retrieval. No live Supabase, Whisper, OCR, or external source workflows were available for verification.

## 2026-10-08 — Instagram authentic thumbnail retention

- Problem: Instagram import showed the generic Reel placeholder even when the provider had fetched an authentic thumbnail.
- Root cause: `IngestionService` passed provider metadata to `MediaPreviewResolver` without the required authenticity flag. The resolver correctly ignored unverified metadata, but the flag was never derived from the provider's validated thumbnail and provenance.
- Fix: Ingestion now passes `hasAuthenticThumb` only when the provider provenance is non-fallback and the URL passes the media safety/authenticity validator. Instagram embed and OpenGraph extraction also accept an authentic image as sufficient metadata when caption/author are unavailable.
- Regression: Added a canonical-resolver test asserting provider images retain their URL and provider provenance.
- Validation: Type-check passes; focused lint has no errors. Test execution stalled at unavailable uncached `tsx`; build remains blocked fetching Geist from Google Fonts. No live Instagram/Meta credentials or media access were available.

## 2026-10-08 — Grounded topic collections for reusable content

- Problem: New useful topics were left uncategorized until two matching prior assignments existed; early items in a bulk batch could stay unorganized.
- Root cause: Worker collection creation was gated on an exact-topic assignment count of two, even when an individual item had strong grounded tags and a high reusable-asset classification.
- Fix: Added a pure eligibility rule requiring AI-sourced evidenced topic tags, analysis confidence >= 0.78, `isAsset === true`, and asset score >= 0.72. Worker creates or reuses only the best eligible topic when no suitable collection/manual choice exists. Generic type labels and non-assets do not create folders. Exact tag phrases receive enough matching weight to reuse descriptive collections such as `After Effects Tutorials`.
- Efficiency fix: Reuse the acquired media bytes for transcription and OCR in one job instead of fetching the same media twice.
- Tests: Added harness coverage for positive asset topics, low-confidence rejection, generic label rejection, non-asset rejection, and exact phrase match thresholds. Executed equivalent focused runtime assertions against the TypeScript-compiled service; full harness remains blocked on uncached `tsx`.
- Validation: Type-check passes; focused lint has no errors. Production build is network-blocked while fetching Geist. Live Supabase worker and configured AI/STT provider workflow remain unverified.
