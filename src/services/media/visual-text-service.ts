import { MediaAcquisitionResult } from "./media-acquisition-service";

export type VisualTextStatus =
  | "analyzed"
  | "unavailable"
  | "failed"
  | "no_text_detected";

export interface VisualTextResult {
  status: VisualTextStatus;
  visualText: string;
  extractedLines: string[];
  confidence?: number;
  sampleCount: number;
  failureReason?: string;
}

export interface VisualTextParams {
  mediaResult?: MediaAcquisitionResult;
  imageUrl?: string;
  videoBytes?: Uint8Array | ArrayBuffer;
  contentId?: string;
}

export class VisualTextService {
  private static cache = new Map<string, VisualTextResult>();

  /**
   * Intelligently samples frames and extracts on-screen text, titles, and subtitles.
   * Deduplicates repeated subtitle frames across consecutive intervals.
   */
  public static async extractVisualText(params: VisualTextParams): Promise<VisualTextResult> {
    const { mediaResult, imageUrl, videoBytes, contentId } = params;

    const scopedContentId = contentId;
    if (scopedContentId && this.cache.has(scopedContentId)) {
      return this.cache.get(scopedContentId)!;
    }

    // Check media availability
    const hasMedia = videoBytes || (mediaResult && mediaResult.status === "available");
    const hasImage = Boolean(imageUrl && imageUrl.startsWith("http"));

    if (!hasMedia && !hasImage) {
      const unavailable: VisualTextResult = {
        status: "unavailable",
        visualText: "",
        extractedLines: [],
        sampleCount: 0,
        failureReason: "No video frames or images accessible for visual text recognition.",
      };
      if (scopedContentId) this.cache.set(scopedContentId, unavailable);
      return unavailable;
    }

    const endpoint = process.env.OCR_SERVICE_URL;
    if (!endpoint) {
      return {
        status: "unavailable", visualText: "", extractedLines: [], sampleCount: 0,
        failureReason: "OCR service is not configured for this deployment.",
      };
    }
    const mediaBytes = mediaResult?.video || mediaResult?.audio || videoBytes;
    if (!mediaBytes) {
      return {
        status: "unavailable", visualText: "", extractedLines: [], sampleCount: 0,
        failureReason: "No accessible image or video bytes were available for OCR.",
      };
    }
    const bytes = mediaBytes instanceof Uint8Array ? mediaBytes : new Uint8Array(mediaBytes);
    if (bytes.byteLength > 25 * 1024 * 1024) {
      return { status: "failed", visualText: "", extractedLines: [], sampleCount: 0, failureReason: "OCR input exceeds the 25 MB processing limit." };
    }
    let serviceUrl: URL;
    try { serviceUrl = new URL(endpoint); }
    catch { return { status: "failed", visualText: "", extractedLines: [], sampleCount: 0, failureReason: "OCR_SERVICE_URL is invalid." }; }
    if (serviceUrl.protocol !== "https:" && serviceUrl.hostname !== "localhost") {
      return { status: "failed", visualText: "", extractedLines: [], sampleCount: 0, failureReason: "OCR service must use HTTPS outside localhost." };
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);
    const requestBody = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(requestBody).set(bytes);
    try {
      const response = await fetch(serviceUrl, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": mediaResult?.mimeType || "application/octet-stream",
          Accept: "application/json",
          ...(process.env.OCR_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.OCR_SERVICE_TOKEN}` } : {}),
        },
        body: requestBody,
      });
      if (!response.ok) throw new Error(`OCR service returned HTTP ${response.status}.`);
      const payload = await response.json() as { text?: unknown; lines?: unknown; confidence?: unknown; sampleCount?: unknown };
      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      const lines = Array.isArray(payload.lines) ? payload.lines.filter((line): line is string => typeof line === "string" && Boolean(line.trim())) : text.split(/\r?\n/).filter(Boolean);
      const result: VisualTextResult = {
        status: text ? "analyzed" : "no_text_detected",
        visualText: text,
        extractedLines: this.deduplicateSubtitleLines(lines),
        confidence: typeof payload.confidence === "number" ? Math.max(0, Math.min(1, payload.confidence)) : undefined,
        sampleCount: typeof payload.sampleCount === "number" ? Math.max(0, payload.sampleCount) : 1,
      };
      if (scopedContentId) this.cache.set(scopedContentId, result);
      return result;
    } catch (error) {
      return {
        status: "failed", visualText: "", extractedLines: [], sampleCount: 0,
        failureReason: error instanceof Error ? error.message : "OCR processing failed.",
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  /**
   * Deduplicates successive subtitle lines that often repeat in consecutive video frames.
   */
  public static deduplicateSubtitleLines(rawLines: string[]): string[] {
    const unique: string[] = [];
    const seen = new Set<string>();

    for (const line of rawLines) {
      const normalized = line.trim().toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "");
      if (normalized.length > 3 && !seen.has(normalized)) {
        seen.add(normalized);
        unique.push(line.trim());
      }
    }

    return unique;
  }

  public static setCachedResult(contentId: string, result: VisualTextResult): void {
    this.cache.set(contentId, result);
  }

  public static clearCache(): void {
    this.cache.clear();
  }
}
