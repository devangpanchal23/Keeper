# Keeper — Platform Providers

*Last Updated: 2026-10-02*

Keeper isolates platform-specific parsing, URL canonicalization, and metadata extraction into modular provider implementations adhering to [`ContentProvider`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/providers/content-provider.interface.ts). All providers are registered in [`ProviderRegistry`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/providers/provider-registry.ts).

---

## Provider Catalog

### 1. `InstagramProvider`
- **File**: [`src/services/providers/instagram-provider.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/providers/instagram-provider.ts)
- **Platform**: `"instagram"`
- **URL Patterns**:
  - `instagram.com/p/{shortcode}/`
  - `instagram.com/reel/{shortcode}/` or `instagram.com/reels/{shortcode}/`
  - `instagram.com/tv/{shortcode}/`
  - `instagr.am/p/{shortcode}`
- **Canonicalization**: Strips query parameters (`utm_source`, `igsh`) and normalizes to standard `https://www.instagram.com/{type}/{shortcode}/`.
- **Extraction Capability**:
  - Captions, creator handle, and post metadata from open graph and captioned embed endpoints.
  - In unauthenticated guest mode, Instagram frequently serves login walls or consent challenges. When detected, sets `isRestricted: true` and preserves original export data.
- **Thumbnail & Media Handling**:
  - Delegated to [`MediaPreviewResolver`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/media/media-preview-resolver.ts) via [`InstagramThumbnailResolver`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/media/instagram-thumbnail-resolver.ts).
  - Resolves via 5-tier deterministic hierarchy: Local ZIP media / Reel video frame -> Durable Cache -> Authorized Provider -> Verified Embed -> Compliant Provider -> Honest Branded Vector Card.
  - Architecture is standardized and extensible to YouTube, TikTok, Reddit, LinkedIn, X, Pinterest, Facebook, and Threads. Stock photos are banned.

---

### 2. `YouTubeProvider`
- **File**: [`src/services/providers/youtube-provider.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/providers/youtube-provider.ts)
- **Platform**: `"youtube"` / `"youtube-shorts"`
- **URL Patterns**:
  - Standard Watch: `youtube.com/watch?v={11_chars}`
  - Shortened: `youtu.be/{11_chars}`
  - Shorts: `youtube.com/shorts/{11_chars}`
  - Embed: `youtube.com/embed/{11_chars}`
- **Canonicalization**: Extracts the clean 11-character video ID and formats canonical URLs as `https://www.youtube.com/watch?v={id}` or `https://www.youtube.com/shorts/{id}`.
- **Extraction Capability**:
  - YouTube oEmbed (`https://www.youtube.com/oembed?url=...&format=json`): Fetches video title, channel name (`creator.name`), and author URL without API key requirements.
  - Optional: YouTube Data API v3 (`YOUTUBE_API_KEY`) for tags, duration, and view counts.
- **Thumbnail Handling**:
  - High-resolution YouTube CDN URLs: `https://i.ytimg.com/vi/{videoId}/maxresdefault.jpg` with automatic fallback to `hqdefault.jpg`.

---

### 3. `RedditProvider`
- **File**: [`src/services/providers/reddit-provider.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/providers/reddit-provider.ts)
- **Platform**: `"reddit"`
- **URL Patterns**:
  - Post: `reddit.com/r/{subreddit}/comments/{id}/{slug}/`
  - Short: `redd.it/{id}`
  - Community: `reddit.com/r/{subreddit}/`
- **Canonicalization**: Strips tracking parameters, extracts canonical subreddit and post ID.
- **Extraction Capability**:
  - Public JSON endpoint (`.json`) and Reddit oEmbed: Post title, author, subreddit name (`community`), score, selftext body, and comments.
  - Cross-platform normalization cleans subreddit names (strips prefix `"r/"` in `community.name`).
- **Thumbnail Handling**:
  - Reddit media preview image or subreddit icon fallback.

---

### 4. `LinkedInProvider`
- **File**: [`src/services/providers/linkedin-provider.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/providers/linkedin-provider.ts)
- **Platform**: `"linkedin"`
- **URL Patterns**:
  - Posts: `linkedin.com/posts/{author}_{title-activity-id}`
  - Pulse Articles: `linkedin.com/pulse/{article-slug}`
  - Activity: `linkedin.com/feed/update/urn:li:activity:{id}`
- **Canonicalization**: Strips tracking tokens and session IDs.
- **Extraction Capability**:
  - OpenGraph metadata parsing (title, author, publication date, article excerpt).
  - Handles guest restrictions gracefully.

---

### 5. `XProvider` (Twitter)
- **File**: [`src/services/providers/x-provider.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/providers/x-provider.ts)
- **Platform**: `"x"` / `"twitter"`
- **URL Patterns**:
  - `twitter.com/{user}/status/{id}`
  - `x.com/{user}/status/{id}`
- **Canonicalization**: Normalizes `twitter.com` to `x.com/{user}/status/{id}`.
- **Extraction Capability**:
  - Twitter Publish oEmbed (`publish.twitter.com/oembed`): Tweet text, author display name, author handle, and embed HTML.

---

### 6. `GenericProvider`
- **File**: [`src/services/providers/generic-provider.ts`](file:///Volumes/T7/Devang/Code/Real_Project/Keeper/src/services/providers/generic-provider.ts)
- **Platform**: `"website"` / `"blog"`
- **URL Patterns**: Any valid `http://` or `https://` URL.
- **Canonicalization**: Strips UTM parameters (`utm_source`, `utm_medium`, `utm_campaign`, etc.).
- **Extraction Capability**:
  - HTML `<meta>` tag inspection: `og:title`, `og:description`, `og:image`, `author`, `article:published_time`.
