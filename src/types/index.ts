export type Platform =
  | "youtube"
  | "youtube-shorts"
  | "instagram"
  | "reddit"
  | "linkedin"
  | "x"
  | "twitter"
  | "tiktok"
  | "pinterest"
  | "facebook"
  | "threads"
  | "blog"
  | "website"
  | "github";

export type ContentType =
  | "video"
  | "short"
  | "reel"
  | "article"
  | "post"
  | "image"
  | "website"
  | "product"
  | "pdf"
  | "other";

export interface Community {
  id: string | null;
  name: string; // Canonical community name WITHOUT "r/"
  displayName?: string | null;
  url?: string | null;
}

export interface Creator {
  name: string;
  handle?: string;
  avatar?: string;
  verified?: boolean;
  // Canonical fields for unified platform normalization
  id?: string | null;
  username?: string | null;
  displayName?: string | null;
  profileUrl?: string | null;
  source?: Platform | string;
  status?: "active" | "deleted" | string;
}

export interface AISummary {
  quick: string;      // 1-sentence TLDR
  standard: string;   // 2-3 sentence overview
  detailed: string;   // In-depth breakdown
}

export interface StructuredTranscript {
  status: string;
  text?: string;
  language?: string;
  [key: string]: any;
}

export type ItemTranscript = string | StructuredTranscript;

export interface ContentRepresentation {
  type: "transcript" | "source_text" | "metadata_only" | "unavailable";
  text: string;
  transcript?: string;
  source: "transcription" | "platform_transcript" | "ocr_text" | "caption" | "post_body" | "description" | "title" | "none";
  language?: string;
  extractionMethod: string;
  confidence: number;
  status: "completed" | "partial" | "failed";
  generatedAt: string;
  failureReason?: string;
  sourceSegments?: Array<{ source: string; text: string }>;
}

export interface AssetClassification {
  isAsset: boolean | null;
  assetType: string | null;
  assetScore: number | null;
  reason: string | null;
  evidence: string[];
  method: string;
}

export interface GeneratedContent {
  title: string | null;
  summary: string | null;
  detailedDescription: string | null;
  keyPoints: string[];
  topics: string[];
  keywords: string[];
  tags: string[];
  contentType: string | null;
  assetClassification: AssetClassification;
  collectionReason: string | null;
}

export type AIProcessingState =
  | "QUEUED" | "PENDING" | "EXTRACTING" | "TRANSCRIBING" | "ANALYZING"
  | "GENERATING_TAGS" | "MATCHING_COLLECTION" | "ORGANIZING" | "INDEXING"
  | "COMPLETED" | "FAILED" | "EXTRACTION_FAILED" | "TRANSCRIPTION_FAILED"
  | "ANALYSIS_FAILED" | "ORGANIZATION_FAILED" | "INDEXING_FAILED";

export type GeneratedTagCategory = "Topic" | "Technology" | "Industry" | "Concept" | "Skill" | "Person" | "Product" | "Content Type" | "Intent";

export interface GeneratedTag {
  name: string;
  normalizedName: string;
  category: GeneratedTagCategory;
  confidence: number;
  source: "ai" | "user";
  evidence: string;
}

export interface ItemMetadata {
  domain?: string;
  duration?: string;
  readTime?: string;
  likes?: string;
  comments?: string;
  upvotes?: string;
  views?: string;
  publishedAt?: string;
  canonicalUrl?: string;
  authorUrl?: string;
  suggestedCollectionName?: string;
  transcript?: ItemTranscript;
  transcriptSegments?: Array<{ startMs: number; endMs: number; text: string; confidence?: number }>;
  contentRepresentation?: ContentRepresentation;
  generatedContent?: GeneratedContent;
  assetClassification?: AssetClassification;
  aiProcessingStatus?: AIProcessingState;
  aiProcessingError?: string;
  aiGeneratedTags?: GeneratedTag[];
  aiOrganization?: Record<string, unknown>;
  visualText?: string;
  contentIntent?: string;
  evidenceLevel?: string;
  caption?: string;
  hashtags?: string[];
  shortcode?: string;
  fbid?: string;
  thumbnailSource?: "authentic" | "export" | "provider" | "cache" | "fallback" | "media_frame";
  organization?: any;
  testMediaBuffer?: any;
  rawPlatformMetadata?: Record<string, any>;
  [key: string]: any;
}

export type ContentProcessingStatus =
  | "FULL_CONTENT"
  | "PARTIAL_CONTENT"
  | "METADATA_ONLY"
  | "INSUFFICIENT_CONTENT";

export interface FieldProvenance {
  value?: any;
  source: string; // e.g. "youtube_metadata", "reddit_oembed", "url_parse", "ai", etc.
  basedOn?: string[]; // e.g. ["transcript", "description"] or ["caption"]
  retrievedAt?: string;
  [key: string]: any;
}

export interface VerifiedSourceMetadata {
  contentId: string | null;
  platform: Platform;
  contentType: ContentType;
  url: string;
  canonicalUrl: string;
  title: string;
  creator: Creator;
  description: string;
  thumbnail: string;
  metadata: ItemMetadata;
  suggestedTags: string[];
  suggestedCollectionName: string;
  community?: Community;
  status: ContentProcessingStatus;
  isLimited: boolean;
  limitedReason?: string;
  provenance: Record<string, FieldProvenance>;
}

export interface ExtractedContent extends VerifiedSourceMetadata {
  bodyText?: string | null;
  transcript?: string | null;
  caption?: string | null;
  hashtags?: string[];
  subreddit?: string;
  extractedAt?: string;
}

export interface ContentValidationResult {
  isValid: boolean;
  status: ContentProcessingStatus;
  missingFields: string[];
  isLimited: boolean;
  limitedReason?: string;
}

export interface SavedItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  platform: Platform;
  contentType: ContentType;
  creator: Creator;
  community?: Community;
  description: string;
  savedDate: string; // ISO string
  collectionId?: string; // primary collection
  collections?: string[]; // multiple collections support
  tags: string[];
  favorite: boolean;
  archived: boolean;
  trashed: boolean;
  aiSummary: AISummary;
  keyPoints: string[]; // Key takeaways
  topics: string[];
  personalNotes: string;
  metadata: ItemMetadata;
  lastViewedAt?: string;
  viewCount?: number;
  contentStatus?: ContentProcessingStatus;
  isLimited?: boolean;
  limitedReason?: string;
  provenance?: Record<string, FieldProvenance>;
}

export interface Collection {
  id: string;
  name: string;
  description?: string;
  color: string; // Tailwind hex or class
  icon: string;  // Lucide icon identifier
  isSystem?: boolean;
  createdAt: string;
  updatedAt: string;
  count?: number;
  [key: string]: any;
}

export interface Tag {
  id: string;
  name: string;
  count: number;
  color?: string;
}

export interface UserSettings {
  theme: "light" | "dark" | "system";
  defaultSummaryMode: "quick" | "standard" | "detailed";
  autoTagging: boolean;
  aiModel: string;
  notificationsEnabled: boolean;
}

export interface ImportLimits {
  total: number;
  used: number;
  remaining: number;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  tier: "free" | "basic" | "pro" | "team";
  joinedDate: string;
  updatedAt?: string;
  settings: UserSettings;
  importLimits?: {
    total: number;
    used: number;
  };
}

export interface UserRecord extends User {
  passwordHash: string; // Cryptographic salt:hash (NEVER returned to client UI)
}

export interface AuthSession {
  token: string;
  userId: string;
  email: string;
  expiresAt: string;
}

export interface SearchFilters {
  query?: string;
  platform?: Platform | "all";
  contentType?: ContentType | "all";
  collectionId?: string | "all";
  tag?: string | "all";
  favoriteOnly?: boolean;
  dateRange?: "all" | "today" | "week" | "month" | "year";
  sortBy?: "newest" | "oldest" | "title" | "relevance";
}

export interface SearchResult {
  item: SavedItem;
  score: number;
  matchedFields: string[];
  snippet?: string;
}

export interface AIQueryResponse {
  id: string;
  query: string;
  answer: string;
  keyInsights: string[];
  referencedItemIds: string[];
  confidence: number;
  timestamp: string;
  suggestedFollowUps: string[];
}

export type ViewMode = "grid" | "list" | "compact";

export interface ToastMessage {
  id: string;
  title: string;
  description?: string;
  type: "success" | "info" | "warning" | "error";
  duration?: number;
}

// =============================================================================
// Ingestion Pipeline & Metadata Separation Types
// =============================================================================

export interface AuthoritativeSourceData {
  platform: Platform;
  canonicalUrl: string;
  contentId: string;
  creator: Creator;
  community?: Community;
  title: string;
  caption?: string;
  description?: string;
  bodyText?: string;
  transcript?: string;
  thumbnailUrl: string;
  mediaUrl?: string;
  publishedAt?: string;
  contentType: ContentType;
  duration?: string;
  viewCount?: string;
  likeCount?: string;
  commentCount?: string;
  rawPlatformMetadata?: Record<string, any>;
  retrievedAt: string;
  isRestricted: boolean;
  restrictionReason?: string;
  provenance: Record<string, FieldProvenance>;
}

export interface GroundedAIEnrichment {
  summary: AISummary;
  topics: string[];
  category: string;
  keywords: string[];
  tags: string[];
  entities: string[];
  contentIntent?: string;
  searchableContext: string;
  keyPoints: string[];
  suggestedCollectionName?: string;
  suggestedCollectionId?: string;
  confidence: number; // 0.0 - 1.0
  isSufficientContent: boolean;
  status: ContentProcessingStatus;
  provenance: Record<string, FieldProvenance>;
}

export interface IngestionResult {
  sourceData: AuthoritativeSourceData;
  aiEnrichment: GroundedAIEnrichment;
  savedItem: SavedItem;
}

// =============================================================================
// Bulk Import Entities & Types
// =============================================================================

export type ImportMethod = "oauth" | "file_export" | "export_file" | "url_list";

export type ImportJobStatus =
  | "pending"
  | "analyzing"
  | "ready"
  | "processing"
  | "paused"
  | "completed"
  | "failed"
  | "cancelled";

export type ImportItemStatus =
  | "queued"
  | "pending"
  | "processing"
  | "extracting"
  | "enriching"
  | "saving"
  | "success"
  | "completed"
  | "duplicate"
  | "failed"
  | "skipped"
  | "unsupported";

export type FailureCategory =
  | "rate_limit"
  | "timeout"
  | "unavailable"
  | "invalid_url"
  | "auth"
  | "unsupported_source"
  | "extraction_failed"
  | "ai_failed"
  | "save_failed"
  | "unknown";

export interface ImportItemFailure {
  code?: string;
  provider?: string;
  stage?: "validation" | "extraction" | "enrichment" | "saving" | "network";
  message: string;
  category: FailureCategory;
  isRetryable: boolean;
  userActionRequired: boolean;
  suggestedAction?: string;
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
  status: ImportItemStatus;
  savedItemId?: string;
  collectionId?: string;
  collectionName?: string;
  savedTimestamp?: number | string;
  error?: ImportItemFailure;
  retryCount: number;
  processedAt?: string;
}

export type DuplicateStrategy = "skip" | "update" | "allow";
export type AIEnrichmentMode = "full" | "fast_metadata";

export interface ImportJobOptions {
  targetCollectionId?: string;
  autoOrganize: boolean;
  skipDuplicates: boolean;
  duplicateStrategy?: DuplicateStrategy;
  aiEnrichmentMode?: AIEnrichmentMode;
  defaultTags: string[];
  concurrencyLimit?: number;
}

export interface PreImportAnalysisBreakdown {
  total: number;
  ready: number;
  alreadySaved: number;
  batchDuplicates: number;
  unsupported: number;
  candidateItems: ImportItem[];
}

export interface ImportJob {
  id: string;
  userId: string;
  platform: Platform;
  sourceType: ImportMethod;
  sourceName: string;
  status: ImportJobStatus;
  totalItems: number;
  processedItems: number;
  successCount: number;
  duplicateCount: number;
  failedCount: number;
  skippedCount: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  pausedAt?: string;
  estimatedSecondsRemaining?: number;
  options: ImportJobOptions;
  items: ImportItem[];
  error?: string;
}

export interface ImportReportSummary {
  totalDiscovered: number;
  alreadyExisted: number;
  eligible: number;
  imported: number;
  failed: number;
  skipped: number;
  duplicates: number;
  unsupported: number;
  successPercentage: number;
}

export interface ImportReport {
  id: string;
  jobId: string;
  userId: string;
  platform: Platform;
  accountName: string;
  sourceName: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  summary: ImportReportSummary;
  items: ImportItem[];
}

export interface PlatformConnection {
  id: string;
  userId: string;
  platform: Platform;
  accountName: string;
  accountId: string;
  avatarUrl?: string;
  scopes: string[];
  connectedAt: string;
  expiresAt?: string;
  status: "connected" | "expired" | "revoked";
}

export interface AvailableImportSource {
  id: string;
  name: string;
  platform: Platform;
  description: string;
  estimatedCount?: number;
  supportedVia: "official_oauth" | "data_export_only" | "url_list";
  isSupportedProgrammatically: boolean;
  unsupportedReason?: string;
  safeAlternative?: string;
}

export interface DeleteCollectionItemsOptions {
  userId: string;
  collectionId: string;
  itemIds?: string[];
  selectAll?: boolean;
}

export interface DeleteCollectionItemsResult {
  success: boolean;
  requested: number;
  deleted: number;
  removedFromCollection: number;
  skipped: number;
  failed: number;
  processedIds: string[];
}

// =============================================================================
// AI Transcription & Intelligent Collection Organizer Types
// =============================================================================

export type OrganizationIntent =
  | "LEARNING"
  | "TUTORIAL"
  | "NEWS"
  | "TOOL"
  | "RESOURCE"
  | "RESOURCE_ACQUISITION"
  | "INSPIRATION"
  | "REFERENCE"
  | "BUSINESS"
  | "ENTERTAINMENT"
  | "OTHER";

export interface ResourceAction {
  action: "comment" | "dm" | "link" | "download";
  trigger?: string; // e.g. "PRESET", "PACK", "TEMPLATE", "ASSET"
  confidence: number;
}

export type OrganizationDecision =
  | "AUTO_ASSIGNED"
  | "SUGGESTED"
  | "UNCERTAIN"
  | "FAILED"
  | "SKIPPED";

export interface ItemOrganizationResult {
  itemId: string;
  savedItemId?: string;
  title: string;
  url: string;
  platform: Platform;
  transcriptionStatus: "transcribed" | "unavailable" | "failed" | "unsupported" | "no_speech";
  transcriptText?: string;
  language?: string;
  visualText?: string;
  evidenceLevel: "URL_ONLY" | "METADATA_ONLY" | "TEXT_CONTENT" | "TRANSCRIBED" | "MULTIMODAL";
  primaryTopic: string;
  secondaryTopics: string[];
  intent: OrganizationIntent;
  resourceAction?: ResourceAction;
  targetCollectionId?: string;
  targetCollectionName?: string;
  isNewCollection?: boolean;
  confidence: number; // 0.0 - 1.0
  decision: OrganizationDecision | "APPLIED";
  reasoning: string;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
  processedAt?: string;
  transcription?: { status: string; text?: string; language?: string; [key: string]: any };
  collectionMatch?: { collectionId?: string; suggestedCollectionName?: string; confidence: number; [key: string]: any };
  analysis?: { intent: OrganizationIntent; primaryTopic: string; secondaryTopics?: string[]; resourceAction?: ResourceAction; [key: string]: any };
  [key: string]: any;
}

export interface OrganizationCluster {
  collectionName: string;
  collectionId?: string;
  count: number;
  itemCount?: number;
  autoAssignedCount?: number;
  suggestedCount?: number;
  isNew: boolean;
  isExisting?: boolean;
  itemIds: string[];
  avgConfidence: number;
}

export interface OrganizationJobReport {
  jobId: string;
  userId: string;
  totalSelected: number;
  processed: number;
  processedCount?: number;
  assignedCount: number;
  autoAssignedCount?: number;
  suggestedCount: number;
  uncertainCount: number;
  failedCount: number;
  clusterSummary: OrganizationCluster[];
  clusters?: OrganizationCluster[];
  results: ItemOrganizationResult[];
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  [key: string]: any;
}

export interface OrganizeItemsOptions {
  userId?: string;
  autoApplyHighConfidence?: boolean;
  highConfidenceThreshold?: number;
  mediumConfidenceThreshold?: number;
  concurrencyLimit?: number;
  createCollectionsPolicy?: "manual_review" | "auto_cluster" | "disabled";
}

// ---------------------------------------------------------------------------
// Authentic Media Preview & Social Identity
// ---------------------------------------------------------------------------

export interface SocialContentIdentity {
  platform: Platform;
  type: ContentType;
  canonicalUrl: string;
  shortcode: string;
  fbid?: string;
  cacheKey: string;
}

export type MediaPreviewStatus = "resolved" | "unavailable" | "failed";

export type MediaPreviewSource =
  | "export_archive_image"
  | "export_archive_video_frame"
  | "export_metadata"
  | "durable_cache"
  | "authorized_api"
  | "verified_embed"
  | "provider_media"
  | "fallback";

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
  | "CACHE_FAILURE"
  | "SECURITY_BLOCKED";

export interface MediaPreviewResult {
  status: MediaPreviewStatus;
  previewUrl: string;
  mimeType?: string;
  width?: number;
  height?: number;
  source: MediaPreviewSource;
  sourceIdentity: string;
  authenticity: MediaPreviewAuthenticity;
  retrievedAt: string;
  expiresAt?: string;
  failureReason?: string;
  failureCategory?: MediaPreviewFailureCategory;
}

export interface ResolveMediaPreviewContext {
  archiveFileResolver?: (pathOrPattern: string) => string | null;
  exportMetadata?: {
    thumbnailUrl?: string;
    media?: any[];
    archivePath?: string;
    fbid?: string;
    caption?: string;
    localVideoBuffer?: Uint8Array | ArrayBuffer;
    [key: string]: any;
  };
  providerMetadata?: {
    thumbnailUrl?: string;
    hasAuthenticThumb?: boolean;
    rawPlatformMetadata?: any;
    [key: string]: any;
  };
  signal?: AbortSignal;
  allowNetwork?: boolean;
}
