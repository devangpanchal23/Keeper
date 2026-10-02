# Keeper — Known Issues & Bug Tracker

*Last Updated: 2026-10-02*

---

## ISSUE-001 — Imported Instagram Data Changes After Stored (P0)

- **Status**: **RESOLVED**
- **Severity**: P0 (Data Corruption / Loss)
- **Subsystem**: `IngestionService`, `ContentService`, `ReprocessingService`, `ExportFileParser`
- **Resolved Date**: 2026-10-02
- **Reference**: See [`ai/CHANGELOG_AI.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/CHANGELOG_AI.md) and [`ai/DECISIONS.md`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/ai/DECISIONS.md) (ADR-001)

### Problem
After importing Instagram posts from an official Meta export JSON/ZIP, items initially displayed accurate creators, captions, and saved timestamps. Later, background enrichment, reprocessing, or duplicate batch execution caused the displayed creator and caption to change to generic boilerplate (`"Instagram User"`, `"Instagram Reel • Watch on Instagram"`).

### Root Cause
1. `IngestionService.processUrl` Step 6 conditioned export preservation on `(sourceData.isRestricted || isGenericCreator)`. If network fetch succeeded with guest HTML, export creator and caption were discarded in favor of remote text.
2. `ContentService.updateItem` did raw `{ ...items[index], ...updates }`, allowing weaker updates to overwrite authoritative data.
3. `ReprocessingService.reprocessItem` did `{ ...refreshed, id: item.id, savedDate: item.savedDate }`, which wiped stored creator, caption, and thumbnail.
4. `ExportFileParser.parseJsonExport` dropped `caption`, `thumbnailUrl`, and `fbid`.

### Fix Applied
- Codified [`ContentService.safeMerge`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/content-service.ts#L150) enforcing source precedence: Meta export values always win over guest scrapes and AI outputs.
- Routed all update writers (`ContentService.updateItem`, `ReprocessingService.reprocessItem`, `AIService.reprocessItem`, and `IngestionService` Step 11) through `safeMerge`.
- Restored parser mapping in `ExportFileParser`.
- Added 4 dedicated regression tests in `scripts/run-tests.ts`.

---

## ISSUE-002 — Authentic Instagram Reel Thumbnail Acquisition (P1)

- **Status**: **RESOLVED VIA TIERED PREVIEW ARCHITECTURE & HONEST FALLBACK**
- **Severity**: P1 (Visual Fidelity & Social Preview Integrity)
- **Subsystem**: `MediaPreviewResolver`, `InstagramThumbnailResolver`, `StorageService`, `ReprocessingService`
- **Resolved Date**: 2026-10-02

### Problem
When users import Instagram Reels via JSON data exports without a full media archive or configured Meta API credentials, the item detail page previously displayed generic fallback placeholders or (historically) misleading Unsplash stock photos.

### Root Cause
- Meta's official JSON export for saved media contains only URLs, titles, and timestamps; it does NOT include binary media or signed CDN image URLs.
- In 2020, Meta deprecated unauthenticated public oEmbed. Unauthenticated guest HTTP requests to `instagram.com/reel/...` return HTTP 401/403 or redirect to login walls.
- Expiring CDN URLs or lack of durable caching previously caused thumbnail links to decay.
- Missing video-to-cover extraction meant raw Reel video files in export archives did not produce thumbnails.

### Solution Applied
1. **Canonical Identity**: Deterministic `preview:${platform}:${type}:${shortcode}:v1` prevents cache collision and unifies tracking URLs.
2. **Deterministic 5-Tier Priority**: Local ZIP media / Video Frame -> Durable Cache -> Authorized Provider -> Verified Embed -> Existing Provider -> Honest Branded Vector Card.
3. **Reel Video Frame Extraction**: Extracts an authentic representative frame from Reel video bytes when static thumbnails are absent.
4. **Durable Media Cache**: Caches verified media previews across browser and server sessions in `StorageService`.
5. **SafeMerge Downgrade Protection**: Once verified authentic, a thumbnail can never be replaced by a fallback placeholder.
6. **Controlled Reprocessing**: `ReprocessingService.repairMissingPreviews` safely enriches items lacking authentic previews without touching authoritative source metadata.
7. **SSRF & Security**: Enforces HTTPS, blocks private IP ranges, limits download sizes (15MB), and bans stock photography.

---

## ISSUE-003 — Media Accessibility Constraint for Audio Transcription

- **Status**: **RESOLVED VIA HONEST FALLBACK POLICY**
- **Severity**: Architectural Constraint (Media Resolution)
- **Subsystem**: `TranscriptionService`, `MediaAcquisitionService`, `CollectionOrganizerService`

### Problem
An Instagram Reel URL does not automatically grant Keeper direct access to the underlying video/audio binary stream. Without accessible media bytes, attempting transcription could cause failures or tempt fake placeholder text generation.

### Resolution & Policy
1. `TranscriptionService.transcribeItem` verifies media accessibility through `MediaAcquisitionService` (ZIP attachments, authorized provider cache, or test buffer).
2. If media is inaccessible, Keeper **never invents a fake transcript**. Instead, it marks `transcription.status = "unavailable"` with reason `"Media bytes inaccessible without local export archive or authorized session"`.
3. `CollectionOrganizerService` continues multimodal semantic analysis using available evidence (caption, title, creator, hashtags, metadata) without aborting or marking the record as failed.
4. If media becomes available later (e.g. user attaches export ZIP or reprocesses with credentials), the transcript is generated and safely merged.
