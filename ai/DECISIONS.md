# Keeper — Architecture Decision Records (ADRs)

*Last Updated: 2026-10-02*

This document records key architectural decisions made in Keeper, the rationale behind them, and their consequences.

---

## ADR-001 — Centralized Safe Merge Policy & Field Precedence

- **Date**: 2026-10-02
- **Status**: **ACCEPTED**

### Context
When content was imported from official Meta exports, subsequent background processes (AI summarization, thumbnail acquisition, scheduled reprocessing, duplicate batch ingestion) performed raw object spread merges (`{ ...existing, ...updates }`). Because remote guest scraping returns generic boilerplate (`"Instagram User"`, `"Instagram Reel • Watch on Instagram"`), authoritative export data was being overwritten.

### Decision
Implement [`ContentService.safeMerge(existing: SavedItem, updates: Partial<SavedItem>)`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/content-service.ts#L150) as the mandatory single bottleneck for all updates:
1. **Source Precedence**: Export metadata and user edits unconditionally supersede remote guest scraping.
2. **URL Immutability**: Prohibits mutating canonical content identity (e.g. changing shortcodes).
3. **Saved Date Immutability**: Preserves original export timestamps.
4. **Authentic Media Protection**: Forbids overwriting authentic thumbnails with fallback vector graphics.

### Why
Centralizing field ownership into a single pure function guarantees that no service, background job, or UI mutation can violate data integrity invariants.

### Alternatives Considered
- *Per-service checks*: Requiring each service (`AIService`, `ReprocessingService`, etc.) to remember which fields to keep. Rejected due to high risk of regressions.
- *Database triggers / schema locking*: Not applicable in a client-side / serverless Next.js architecture.

### Consequences
- All writers must route through `ContentService.safeMerge`.
- Authoritative export data remains 100% durable across unlimited enrichment passes.

---

## ADR-002 — Banning Stock Photos & Enforcing Honest Vector Fallbacks

- **Date**: 2026-10-01
- **Status**: **ACCEPTED**

### Context
When authentic Instagram media could not be acquired (due to Meta's login restrictions on unauthenticated guest requests), previous versions of Keeper displayed randomized stock photography from Unsplash (Matrix code, generic office desks, laptops). Users reported this as confusing and misleading because the images had zero connection to the saved posts.

### Decision
1. Permanently ban all stock photography via `BANNED_STOCK_THUMBNAILS` in [`InstagramThumbnailResolver`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/media/instagram-thumbnail-resolver.ts).
2. When authentic media is absent, render an honest branded SVG vector card (`INSTAGRAM_REEL_PLACEHOLDER` / `INSTAGRAM_POST_PLACEHOLDER`) clearly marked `"Authentic Preview Unavailable"`.
3. Set `metadata.thumbnailSource = "fallback"` and `status = "unavailable"`.

### Why
Integrity and honesty in the UI are paramount. A user should never wonder if a generic office photo was part of a Reel they saved.

### Alternatives Considered
- *Silently failing the import*: Rejected. Users want their bookmarks saved even if the cover image is temporarily inaccessible.
- *Displaying a broken image icon*: Rejected. Poor aesthetic user experience.

### Consequences
- UI clearly distinguishes between authentic acquired media and vector placeholders.
- If authentic media is later acquired, `safeMerge` seamlessly upgrades the placeholder.

---

## ADR-003 — Multi-Collection Unlinking Semantics in Collection Deletion

- **Date**: 2026-10-01
- **Status**: **ACCEPTED**

### Context
Keeper supports assigning a single item to multiple collections (`item.collectionId` primary + `item.collections` array). When a user deletes a collection, deleting all items in that collection would destroy items that also belong to other user collections.

### Decision
In [`ContentService.deleteCollectionItems`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/content-service.ts#L470):
1. If an item belongs to multiple collections (`item.collections.length > 1`), **unlink** it by removing the deleted collection ID from `item.collections`. The item remains active in the library.
2. If the deleted collection was the item's sole collection, move the item to Trash (`trashed = true`).

### Why
Prevents unintended collateral data loss while ensuring that items unique to the deleted collection do not become orphaned.

### Consequences
- Deletion operations return `{ deleted: number, removedFromCollection: number, skipped: number }`.
- Multi-collection items are preserved.

---

## ADR-004 — Dual-Mode Storage Adapter (localStorage + in-memory Map)

- **Date**: 2026-10-02
- **Status**: **ACCEPTED**

### Context
[`StorageService`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/storage-service.ts) previously relied on `window.localStorage`. When running server-side rendering (SSR), API routes, or standalone Node.js test scripts (`npm test`), the absence of `window` caused crashes or required crude global mocks that polluted developer test states.

### Decision
Implement a dual-mode storage adapter in `StorageService`:
- If `typeof window !== "undefined"`: Use native `window.localStorage`.
- Otherwise: Use an isolated in-memory `Map<string, string>` (`memoryStore`).
- Provide `clearUserData(userId)` to allow tests to reset state cleanly.

### Why
Enables 100% test isolation, zero SSR crashes, and zero leakage between test runs without adding external mock libraries.

### Consequences
- Node.js test runs execute with complete fidelity in sub-second times.

---

## ADR-005 — Multimodal Evidence Fusion & Bounded Worker Concurrency for AI Organization

- **Date**: 2026-10-02
- **Status**: **ACCEPTED**

### Context
Bulk-imported Instagram Reels often lack explicit text descriptions or contain fragmented hashtags. Relying solely on audio transcripts or solely on captions produces brittle categorization. Furthermore, unconstrained batch organization could overwhelm client-side resources.

### Decision
1. Implement `CollectionOrganizerService` using a 6-stage pipeline: Media Acquisition -> Transcription -> Evidence Fusion -> Semantic Analysis -> Collection Routing -> Safe Persistence.
2. Structure analysis into `{ intent, primaryCluster, secondaryClusters, confidence, evidenceKeywords }` and resource triggers `{ action, trigger, confidence }`.
3. Prioritize existing user collections hierarchically before creating new ones.
4. Execute batch operations using a bounded worker pool (3 workers) with per-item isolation.

---

## ADR-006 — Canonical Social Content Identity & 5-Tier Media Preview Architecture

- **Date**: 2026-10-02
- **Status**: **ACCEPTED**

### Context
Social media URLs often include transient query strings (`?igsh=...`, `?utm_source=...`). Without canonical content identity, different URLs pointing to the same Instagram Reel or Post would generate multiple cache misses or separate thumbnail requests. In addition, social CDN URLs frequently expire, unauthenticated guest scraping is blocked by Meta, and prior implementations lacked video-to-cover extraction.

### Decision
1. **Canonical Content Identity**: Format all media identities as `preview:${platform}:${type}:${shortcode}:v1` after stripping tracking parameters. Two distinct shortcodes must never share a cache key.
2. **Deterministic 5-Tier Source Priority**:
   - Priority 1: Local Meta Export Media (ZIP file or Reel video frame).
   - Priority 2: Verified Durable Cache.
   - Priority 3: Authorized / Official Provider (oEmbed / Graph API with shortcode validation).
   - Priority 4: Supported Embed / Public Metadata.
   - Priority 5: Existing Compliant Provider Abstraction.
   - Final Fallback: Honest branded vector cards (`INSTAGRAM_REEL_PLACEHOLDER` / `INSTAGRAM_POST_PLACEHOLDER`).
3. **Reel Video Frame Extraction**: Generate authentic representative preview frames from raw video bytes (`source = "export_archive_video_frame"`).
4. **Carousel Determinism**: Always select the primary (first) media item across all renders.
5. **Durable Media Cache**: Store resolved media previews in `StorageService` across sessions.
6. **SSRF & Security**: Enforce HTTPS, block private IP ranges (`127.0.0.1`, `169.254.169.254`, RFC 1918), limit downloads to 15MB with 8-second timeouts.
7. **SafeMerge Downgrade Protection**: Forbid replacing verified authentic media with fallback vector cards.
8. **Controlled Item Repair**: Provide `repairMissingPreviews` to enrich items lacking authentic previews without mutating source-authoritative metadata.

