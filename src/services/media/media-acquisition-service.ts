import { Platform } from "@/types";

export type MediaAcquisitionStatus =
  | "available"
  | "unavailable"
  | "authentication_required"
  | "unsupported"
  | "failed";

export type MediaSourceType =
  | "local_export"
  | "authorized_api"
  | "public_stream"
  | "cached_media"
  | "provided_audio_buffer"
  | "none";

export interface MediaAcquisitionResult {
  status: MediaAcquisitionStatus;
  audio?: Uint8Array | ArrayBuffer;
  video?: Uint8Array | ArrayBuffer;
  mediaUrl?: string;
  mimeType?: string;
  duration?: number;
  source: MediaSourceType;
  failureReason?: string;
}

export interface AcquireMediaParams {
  url: string;
  platform: Platform;
  contentId?: string;
  mediaUrl?: string;
  localData?: Uint8Array | ArrayBuffer;
  mimeType?: string;
  workspaceId?: string;
}

export class MediaAcquisitionService {
  private static mediaCache = new Map<string, MediaAcquisitionResult>();

  /**
   * Acquires media safely adhering strictly to platform terms, legal boundaries, and privacy.
   *
   * LEGAL & PRIVACY BOUNDARIES:
   * - NEVER automates passwords or steals session cookies.
   * - NEVER attempts anti-bot or private scraping bypasses.
   * - Uses:
   *   1. User-provided exported files / local buffers
   *   2. Authorized provider APIs
   *   3. Publicly accessible media streams
   *   4. In-memory cached media
   * - Falls back honestly to status="unavailable" if restricted.
   */
  public static async acquireMedia(params: AcquireMediaParams): Promise<MediaAcquisitionResult> {
    const { url, platform, contentId, mediaUrl, localData, mimeType, workspaceId } = params;
    const cacheKey = workspaceId ? `${workspaceId}:${platform}:${contentId || url}` : undefined;

    if (cacheKey && this.mediaCache.has(cacheKey)) {
      return this.mediaCache.get(cacheKey)!;
    }

    // 1. Evidence Hierarchy 1: User-provided local media in export
    if (localData && (localData instanceof Uint8Array || localData instanceof ArrayBuffer)) {
      const result: MediaAcquisitionResult = {
        status: "available",
        audio: localData,
        mimeType: mimeType || "audio/mp4",
        source: "local_export",
      };
      if (cacheKey) this.mediaCache.set(cacheKey, result);
      return result;
    }

    // 2. Evidence Hierarchy 2: Explicitly provided media attachment URL
    if (mediaUrl && typeof mediaUrl === "string") {
      let mediaAddress: URL | null = null;
      try { mediaAddress = new URL(mediaUrl); } catch { mediaAddress = null; }
      const hostname = mediaAddress?.hostname.toLowerCase() || "";
      const privateAddress = hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")
        || hostname.includes(":") || hostname === "0.0.0.0"
        || /^127\./.test(hostname) || /^10\./.test(hostname) || /^192\.168\./.test(hostname)
        || /^169\.254\./.test(hostname)
        || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);
      if (!mediaAddress || mediaAddress.protocol !== "https:" || mediaAddress.username || mediaAddress.password || privateAddress) {
        return { status: "unavailable", source: "none", failureReason: "The media URL is not a safe public HTTPS address." };
      }
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(mediaUrl, {
          signal: controller.signal,
          headers: {
            "Accept": "audio/*,video/*,image/*,*/*",
          },
        });
        if (res.ok) {
          const maxBytes = 100 * 1024 * 1024;
          const declaredSize = Number(res.headers.get("content-length") || 0);
          if (declaredSize > maxBytes) throw new Error("Media is larger than the 100 MB processing limit.");
          const reader = res.body?.getReader();
          if (!reader) throw new Error("The media source did not return a readable stream.");
          const chunks: Uint8Array[] = [];
          let byteCount = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            byteCount += value.byteLength;
            if (byteCount > maxBytes) {
              await reader.cancel("Media exceeds processing size limit.");
              throw new Error("Media is larger than the 100 MB processing limit.");
            }
            chunks.push(value);
          }
          const bytes = new Uint8Array(byteCount);
          let offset = 0;
          for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
          const contentType = res.headers.get("content-type") || mimeType || "audio/mp4";
          const result: MediaAcquisitionResult = {
            status: "available",
            ...(contentType.toLowerCase().startsWith("video/") ? { video: bytes } : { audio: bytes }),
            mediaUrl,
            mimeType: contentType,
            source: "public_stream",
          };
          if (cacheKey) this.mediaCache.set(cacheKey, result);
          return result;
        }
      } catch (err: unknown) {
        const failureReason = err instanceof Error ? err.message : "The media source could not be fetched.";
        return { status: "failed", source: "none", failureReason };
      } finally {
        clearTimeout(timeoutId);
      }
    }

    // 3. Platform-specific acquisition policies
    if (platform === "instagram") {
      // Instagram guest access restricts direct media streaming without official Graph API credentials.
      // Honest platform boundary enforcement:
      const result: MediaAcquisitionResult = {
        status: "unavailable",
        source: "none",
        failureReason:
          "Instagram restricts unauthenticated guest media streaming. Media acquisition requires user export attachment or authorized Meta Graph API token.",
      };
      return result;
    }

    if (platform === "youtube" || platform === "youtube-shorts") {
      const result: MediaAcquisitionResult = {
        status: "unavailable",
        source: "none",
        failureReason: "Keeper's current YouTube adapter retrieves metadata only. The YouTube captions download API requires permission to edit the video, and this deployment has no authorized media-delivery integration for arbitrary videos.",
      };
      return result;
    }

    // Default Fallback: No accessible media
    const fallbackResult: MediaAcquisitionResult = {
      status: "unavailable",
      source: "none",
      failureReason: "No accessible audio or video stream available for this resource.",
    };
    return fallbackResult;
  }

  /**
   * Clears cached media to prevent memory leaks and respect privacy.
   */
  public static clearCache(): void {
    this.mediaCache.clear();
  }
}
