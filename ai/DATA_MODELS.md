# Keeper — Data Models & Field Ownership

*Last Updated: 2026-10-02*

This document defines the core TypeScript interfaces from [`src/types/index.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/types/index.ts) and specifies the **Field Ownership Model** governing data mutation.

---

## Field Ownership & Precedence Model

The central invariant enforced by [`ContentService.safeMerge`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/content-service.ts#L150) separates fields into three tiers:

| Field Tier | Fields | Owner | Mutability Rule |
| :--- | :--- | :--- | :--- |
| **Source Authoritative** | `url`, `canonicalUrl`, `creator.name`, `description` (original caption), `savedDate`, `metadata.shortcode`, `metadata.fbid` | Meta / YouTube / Platform Export or User Edit | **IMMUTABLE against remote scraping and AI.** Once imported, weaker evidence (guest scrapes, empty strings, boilerplate text) CANNOT overwrite these values. Only user edits or stronger official export data can update them. |
| **Derived & Enrichment** | `aiSummary` (quick, standard, detailed), `topics`, `tags`, `keyPoints`, `metadata.contentIntent`, `title` (when derived from caption) | `AIPipeline` / `AIService` | **MUTABLE via Reprocessing.** Reprocessing may refine tags, improve summaries, and classify intent, but must NEVER touch source-authoritative fields. |
| **Media & Visual** | `thumbnail`, `metadata.thumbnailSource`, `provenance.thumbnail` | `InstagramThumbnailResolver` / Media Providers | **DOWNGRADE PROTECTED.** Authentic media (from export ZIP or verified provider) can never be replaced by a fallback vector placeholder. A fallback placeholder can only be upgraded if genuine authentic media is acquired. |

---

## Core Entities

### 1. `SavedItem`
Represents an individual captured resource in a user's library:

```typescript
export interface SavedItem {
  id: string;                         // Unique ID (e.g. "item-1708872800000-0")
  title: string;                      // Display title (authoritative or AI-derived)
  url: string;                        // Canonical URL of the resource
  thumbnail: string;                  // Image URL or SVG data URL
  platform: Platform;                 // "youtube" | "instagram" | "reddit" | ...
  contentType: ContentType;           // "video" | "reel" | "post" | "article" | ...
  creator: Creator;                   // Authoritative creator details
  community?: Community;             // Subreddit or group name (without "r/")
  description: string;                // Original caption or excerpt
  savedDate: string;                  // ISO 8601 timestamp of original save
  collectionId?: string;              // Primary collection ID
  collections?: string[];             // Multi-collection support
  tags: string[];                     // Sanitized categorization tags
  favorite: boolean;                  // Pinned / favorited state
  archived: boolean;                  // Soft-archived state
  trashed: boolean;                   // Soft-deleted in Trash bin
  aiSummary: AISummary;               // Multi-tier grounded AI summaries
  keyPoints: string[];                // Bulleted key takeaways
  topics: string[];                   // High-level thematic clusters
  personalNotes: string;              // User-authored markdown notes
  metadata: ItemMetadata;             // Extended platform-specific properties
  lastViewedAt?: string;              // ISO timestamp of last view
  viewCount?: number;                 // Frequency counter
  contentStatus?: ContentProcessingStatus; // "FULL_CONTENT" | "PARTIAL_CONTENT" | ...
  isLimited?: boolean;                // True if guest access was login-restricted
  limitedReason?: string;             // Explanation of restriction
  provenance?: Record<string, FieldProvenance>; // Audit trail of each field's origin
}
```

### 2. `Creator` & `Community`
```typescript
export interface Creator {
  name: string;                       // Primary display name or @handle
  handle?: string;                    // Normalized handle
  avatar?: string;                    // Avatar image URL
  verified?: boolean;                 // Platform verification badge
  id?: string | null;                 // Platform internal creator ID
  profileUrl?: string | null;         // Direct link to creator profile
  source?: Platform | string;
  status?: "active" | "deleted" | string;
}

export interface Community {
  id: string | null;
  name: string;                       // Clean name (e.g. "webdev", not "r/webdev")
  displayName?: string | null;
  url?: string | null;
}
```

### 3. `ItemMetadata`
Extended platform facts attached to `SavedItem.metadata`:
```typescript
export interface ItemMetadata {
  domain: string;                     // e.g. "instagram.com", "youtube.com"
  duration?: string;                  // Media duration (ISO or formatted)
  readTime?: string;                  // Estimated reading time
  publishedAt?: string;               // Original post publish date
  canonicalUrl?: string;              // Clean canonical URL
  shortcode?: string;                 // Instagram shortcode (e.g. "Dd6Uamci-Jb")
  fbid?: string;                      // Facebook / Meta internal asset ID
  caption?: string;                   // Preserved raw caption
  hashtags?: string[];                // Extracted post hashtags
  contentIntent?: string;             // "TUTORIAL" | "RESOURCE" | "NEWS" | ...
  evidenceLevel?: string;             // "HIGH" | "MEDIUM" | "MINIMAL"
  thumbnailSource?: "authentic" | "export" | "provider" | "cache" | "fallback" | "media_frame";
  rawPlatformMetadata?: Record<string, any>;
}
```

### 4. `AISummary` & `FieldProvenance`
```typescript
export interface AISummary {
  quick: string;                      // 1-sentence instant TL;DR
  standard: string;                   // 2-3 sentence overview
  detailed: string;                   // Comprehensive breakdown
}

export interface FieldProvenance {
  value: any;                         // Field value at time of extraction
  source: string;                     // "instagram_export_metadata" | "ai" | "user_edited" | ...
  basedOn?: string[];                 // E.g. ["caption", "creator"]
  retrievedAt: string;                // ISO timestamp
}
```

### 5. `Collection`
```typescript
export interface Collection {
  id: string;                         // E.g. "col-react" or "col-1708872800000-123"
  name: string;                       // Display name
  description?: string;               // Optional collection purpose
  color: string;                      // Hex code or Tailwind accent
  icon: string;                       // Lucide icon name (e.g. "Folder", "Atom")
  isSystem?: boolean;                 // System default (cannot be deleted)
  createdAt: string;                  // ISO 8601 timestamp
  updatedAt: string;                  // ISO 8601 timestamp
}
```

### 6. `ImportJob` & `ImportItem`
Entities governing asynchronous bulk import queues:
```typescript
export interface ImportJob {
  id: string;                         // E.g. "job-1708872800000"
  userId: string;                     // Tenant owner
  platform: Platform;                 // "instagram" | "youtube"
  sourceType: ImportMethod;           // "file_export" | "export_file" | "url_list"
  sourceName: string;                 // Name of uploaded archive or file
  status: ImportJobStatus;            // "pending" | "ready" | "processing" | "completed" | "failed"
  totalItems: number;
  processedItems: number;
  successCount: number;
  duplicateCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  options: ImportJobOptions;
  items: ImportItem[];
  error?: string;
}

export interface ImportItem {
  id: string;
  jobId: string;
  originalUrl: string;
  canonicalUrl?: string;
  externalId?: string;
  platform: Platform;
  contentType: ContentType;
  title?: string;
  creatorName?: string;
  caption?: string;
  hashtags?: string[];
  fbid?: string;
  thumbnailUrl?: string;
  status: ImportItemStatus;           // "pending" | "processing" | "completed" | "duplicate" | "failed"
  savedItemId?: string;               // Link to stored SavedItem ID upon success
  collectionId?: string;              // Target collection
  collectionName?: string;
  savedTimestamp?: number;            // Timestamp from platform export
  error?: ImportItemFailure;
  retryCount: number;
  processedAt?: string;
}
```

---

## Organization & Transcription Entities

```typescript
export type OrganizationIntent =
  | "RESOURCE"
  | "RESOURCE_ACQUISITION"
  | "TUTORIAL"
  | "LEARNING"
  | "TOOL"
  | "INSPIRATION"
  | "REFERENCE"
  | "BUSINESS"
  | "ENTERTAINMENT"
  | "OTHER";

export interface ResourceAction {
  action: "comment" | "dm" | "link_in_bio" | "download" | "visit";
  trigger: string;
  confidence: number;
}

export type OrganizationDecision = "APPLIED" | "SUGGESTED" | "UNCERTAIN" | "SKIPPED";

export interface ItemOrganizationResult {
  itemId: string;
  transcription: TranscriptionResult;
  evidence: ContentEvidence;
  analysis: OrganizationAnalysis;
  collectionMatch: CollectionMatchResult;
  decision: OrganizationDecision;
  decisionReason: string;
  appliedCollectionId?: string;
  previousCollectionId?: string;
}

export interface OrganizationJobReport {
  jobId: string;
  totalSelected: number;
  processedCount: number;
  autoAssignedCount: number;
  suggestedCount: number;
  uncertainCount: number;
  failedCount: number;
  clusters: OrganizationCluster[];
  results: ItemOrganizationResult[];
  startedAt: string;
  completedAt: string;
  durationMs: number;
}
```

---

## 7. Social Content Identity & Media Preview Models

```typescript
export interface SocialContentIdentity {
  platform: Platform;
  type: "reel" | "post" | "carousel" | "video" | "short" | "story";
  canonicalUrl: string;
  shortcode?: string;
  fbid?: string;
  cacheKey: string; // e.g. "preview:instagram:reel:C123ABC:v1"
}

export type MediaPreviewStatus = "resolved" | "unavailable" | "failed";

export type MediaPreviewSource =
  | "export_archive_media"
  | "export_archive_video_frame"
  | "durable_media_cache"
  | "authorized_provider"
  | "verified_embed"
  | "fallback_placeholder";

export type MediaPreviewAuthenticity = "verified" | "unverified";

export type MediaPreviewFailureCategory =
  | "MEDIA_NOT_IN_EXPORT"
  | "PROVIDER_UNAVAILABLE"
  | "TIMEOUT"
  | "AUTH_REQUIRED"
  | "RATE_LIMITED"
  | "INVALID_RESPONSE"
  | "IDENTITY_MISMATCH"
  | "DOWNLOAD_FAILED"
  | "UNSUPPORTED_MEDIA"
  | "CACHE_FAILURE";

export interface MediaPreviewResult {
  status: MediaPreviewStatus;
  previewUrl?: string;
  localPath?: string;
  mimeType?: string;
  width?: number;
  height?: number;
  source: MediaPreviewSource;
  sourceIdentity: string;
  authenticity: MediaPreviewAuthenticity;
  retrievedAt: string;
  expiresAt?: string;
  failureCategory?: MediaPreviewFailureCategory;
  failureReason?: string;
}

export interface ResolveMediaPreviewContext {
  archiveMediaUrl?: string;
  archiveMediaPath?: string;
  rawVideoBuffer?: ArrayBuffer | Uint8Array;
  mimeType?: string;
  forceFresh?: boolean;
}
```


