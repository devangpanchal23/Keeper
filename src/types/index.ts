export type Platform =
  | "youtube"
  | "youtube-shorts"
  | "instagram"
  | "reddit"
  | "linkedin"
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

export interface Creator {
  name: string;
  handle?: string;
  avatar?: string;
  verified?: boolean;
}

export interface AISummary {
  quick: string;      // 1-sentence TLDR
  standard: string;   // 2-3 sentence overview
  detailed: string;   // In-depth breakdown
}

export interface ItemMetadata {
  domain: string;
  duration?: string;
  readTime?: string;
  likes?: string;
  comments?: string;
  upvotes?: string;
  views?: string;
  publishedAt?: string;
  canonicalUrl?: string;
  authorUrl?: string;
}

export type ContentProcessingStatus =
  | "FULL_CONTENT"
  | "PARTIAL_CONTENT"
  | "METADATA_ONLY"
  | "INSUFFICIENT_CONTENT";

export interface FieldProvenance {
  value: any;
  source: string; // e.g. "youtube_metadata", "reddit_oembed", "url_parse", "ai", etc.
  basedOn?: string[]; // e.g. ["transcript", "description"] or ["caption"]
  retrievedAt: string;
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

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  tier: "free" | "pro" | "team";
  joinedDate: string;
  updatedAt?: string;
  settings: UserSettings;
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
