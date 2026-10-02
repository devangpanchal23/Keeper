import { SavedItem, StructuredTranscript } from "@/types";
import { MediaAcquisitionResult, MediaAcquisitionService } from "./media-acquisition-service";

export type TranscriptionStatus =
  | "transcribed"
  | "unavailable"
  | "failed"
  | "unsupported"
  | "no_speech";

export interface TranscriptSegment {
  startMs: number;
  endMs: number;
  text: string;
  confidence?: number;
}

export interface TranscriptionResult {
  status: TranscriptionStatus;
  text: string;
  language?: string;
  segments: TranscriptSegment[];
  confidence?: number;
  durationSeconds?: number;
  provider: string;
  modelVersion: string;
  failureReason?: string;
}

export interface TranscriptionParams {
  mediaResult?: MediaAcquisitionResult;
  audioBytes?: Uint8Array | ArrayBuffer;
  languageHint?: string;
  contentId?: string;
  workspaceId?: string;
  timeoutMs?: number;
}

export interface SpeechToTextProvider {
  readonly name: string;
  readonly modelVersion: string;
  transcribe(audio: Uint8Array | ArrayBuffer, languageHint?: string, mimeType?: string): Promise<TranscriptionResult>;
}

/**
 * Built-in production speech-to-text adapter with multilingual support:
 * English, Hindi, Gujarati, Hinglish, Portuguese, Spanish, etc.
 */
/**
 * Free-first adapter for a self-hosted faster-whisper service. The service accepts
 * the raw audio body and returns {text, language, segments}; unsupported or
 * unconfigured media is reported honestly and is never converted into guessed text.
 */
class FasterWhisperProvider implements SpeechToTextProvider {
  public readonly name = "faster-whisper";
  public readonly modelVersion = process.env.WHISPER_MODEL || "large-v3";

  public async transcribe(audio: Uint8Array | ArrayBuffer, languageHint?: string, mimeType?: string): Promise<TranscriptionResult> {
    const endpoint = process.env.WHISPER_SERVICE_URL;
    if (!endpoint) {
      return { status: "unavailable", text: "", segments: [], provider: this.name,
        modelVersion: this.modelVersion, failureReason: "WHISPER_SERVICE_URL is not configured." };
    }
    if (!audio || audio.byteLength === 0) {
      return { status: "no_speech", text: "", segments: [], provider: this.name,
        modelVersion: this.modelVersion, failureReason: "Audio stream was empty." };
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream", "X-Media-Mime-Type": mimeType || "application/octet-stream",
        ...(process.env.WHISPER_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.WHISPER_SERVICE_TOKEN}` } : {}),
        ...(languageHint ? { "X-Language-Hint": languageHint } : {}) },
      body: audio instanceof Uint8Array ? audio.slice().buffer : audio,
      signal: AbortSignal.timeout(120_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`faster-whisper returned HTTP ${response.status}.`);
    const output = await response.json() as { text?: unknown; language?: unknown; segments?: unknown };
    const text = typeof output.text === "string" ? output.text.trim() : "";
    if (!text) {
      return { status: "no_speech", text: "", segments: [], provider: this.name,
        modelVersion: this.modelVersion, language: typeof output.language === "string" ? output.language : undefined };
    }
    const segments = Array.isArray(output.segments) ? output.segments.flatMap((segment) => {
      if (!segment || typeof segment !== "object") return [];
      const value = segment as { start?: unknown; end?: unknown; text?: unknown; confidence?: unknown };
      if (typeof value.text !== "string") return [];
      return [{ startMs: Math.max(0, Number(value.start) || 0) * 1000,
        endMs: Math.max(0, Number(value.end) || 0) * 1000, text: value.text,
        ...(typeof value.confidence === "number" ? { confidence: value.confidence } : {}) }];
    }) : [];
    return { status: "transcribed", text, segments, provider: this.name,
      modelVersion: this.modelVersion, language: typeof output.language === "string" ? output.language : undefined };
  }
}

/** OpenAI's server-side audio transcription API. Video is demuxed by Keeper's
 * authenticated FFmpeg sidecar first; the OpenAI API receives audio bytes only. */
export class OpenAITranscriptionProvider implements SpeechToTextProvider {
  public readonly name = "openai-audio-transcriptions";
  public readonly modelVersion = process.env.OPENAI_TRANSCRIPTION_MODEL || "whisper-1";

  private async extractAudio(video: Uint8Array | ArrayBuffer, mimeType?: string): Promise<{ bytes: Uint8Array; durationSeconds?: number }> {
    const configuredUrl = process.env.AUDIO_EXTRACTION_SERVICE_URL || process.env.WHISPER_SERVICE_URL;
    if (!configuredUrl) throw new Error("Video audio extraction is not configured. Set AUDIO_EXTRACTION_SERVICE_URL or WHISPER_SERVICE_URL.");
    const endpoint = new URL(configuredUrl);
    endpoint.pathname = endpoint.pathname.replace(/\/(?:transcribe|extract-audio)\/?$/, "") + "/extract-audio";
    endpoint.search = "";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Media-Mime-Type": mimeType || "video/mp4",
        ...(process.env.WHISPER_SERVICE_TOKEN ? { Authorization: `Bearer ${process.env.WHISPER_SERVICE_TOKEN}` } : {}),
      },
      body: video instanceof Uint8Array ? video.slice().buffer : video,
      signal: AbortSignal.timeout(180_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Audio extraction service returned HTTP ${response.status}.`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (!bytes.length) throw new Error("Audio extraction returned an empty audio file.");
    const duration = Number(response.headers.get("x-audio-duration-seconds"));
    return { bytes, durationSeconds: Number.isFinite(duration) && duration > 0 ? duration : undefined };
  }

  public async transcribe(input: Uint8Array | ArrayBuffer, languageHint?: string, mimeType?: string): Promise<TranscriptionResult> {
    const apiKey = process.env.OPENAI_TRANSCRIPTION_API_KEY || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return { status: "unavailable", text: "", segments: [], provider: this.name, modelVersion: this.modelVersion,
        failureReason: "OpenAI transcription is not configured. Set OPENAI_TRANSCRIPTION_API_KEY (or OPENAI_API_KEY)." };
    }
    const incomingMime = (mimeType || "application/octet-stream").split(";")[0]?.toLowerCase() || "application/octet-stream";
    let audio = input instanceof Uint8Array ? input : new Uint8Array(input);
    let audioMime = incomingMime;
    let durationSeconds: number | undefined;
    if (audioMime.startsWith("video/")) {
      const extracted = await this.extractAudio(audio, audioMime);
      audio = extracted.bytes;
      audioMime = "audio/mp4";
      durationSeconds = extracted.durationSeconds;
    }
    const extensions: Record<string, string> = {
      "audio/flac": "flac", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a",
      "audio/ogg": "ogg", "audio/wav": "wav", "audio/x-wav": "wav", "audio/webm": "webm",
    };
    const extension = extensions[audioMime];
    if (!extension) throw new Error(`OpenAI transcription does not support this audio format (${audioMime}).`);
    const maxBytes = 25 * 1024 * 1024;
    if (audio.byteLength > maxBytes) throw new Error("Audio exceeds OpenAI's 25 MB transcription upload limit.");

    const form = new FormData();
    const uploadBuffer = new ArrayBuffer(audio.byteLength);
    new Uint8Array(uploadBuffer).set(audio);
    form.set("file", new Blob([uploadBuffer], { type: audioMime }), `keeper-source.${extension}`);
    form.set("model", this.modelVersion);
    const isWhisper = this.modelVersion === "whisper-1";
    form.set("response_format", isWhisper ? "verbose_json" : "json");
    if (isWhisper) form.set("timestamp_granularities[]", "segment");
    if (languageHint) form.set("language", languageHint);
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(180_000),
      cache: "no-store",
    });
    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      throw new Error(`OpenAI transcription returned HTTP ${response.status}${errorBody ? `: ${errorBody.slice(0, 300)}` : "."}`);
    }
    const output = await response.json() as { text?: unknown; language?: unknown; duration?: unknown; segments?: unknown };
    const text = typeof output.text === "string" ? output.text.trim() : "";
    if (!text) return { status: "no_speech", text: "", segments: [], provider: this.name, modelVersion: this.modelVersion,
      language: typeof output.language === "string" ? output.language : undefined, durationSeconds };
    const segments = Array.isArray(output.segments) ? output.segments.flatMap((entry) => {
      if (!entry || typeof entry !== "object") return [];
      const segment = entry as { start?: unknown; end?: unknown; text?: unknown; avg_logprob?: unknown };
      if (typeof segment.text !== "string") return [];
      return [{ startMs: Math.max(0, Number(segment.start) || 0) * 1000,
        endMs: Math.max(0, Number(segment.end) || 0) * 1000, text: segment.text.trim() }];
    }) : [];
    return { status: "transcribed", text, segments, provider: this.name, modelVersion: this.modelVersion,
      language: typeof output.language === "string" ? output.language : undefined,
      durationSeconds: typeof output.duration === "number" ? output.duration : durationSeconds };
  }
}

function configuredProvider(): SpeechToTextProvider {
  const selected = process.env.TRANSCRIPTION_PROVIDER || "auto";
  const openAiKey = process.env.OPENAI_TRANSCRIPTION_API_KEY || process.env.OPENAI_API_KEY;
  if (selected === "openai" || (selected === "auto" && openAiKey)) return new OpenAITranscriptionProvider();
  return new FasterWhisperProvider();
}

export class TranscriptionService {
  private static provider: SpeechToTextProvider = configuredProvider();
  private static cache = new Map<string, TranscriptionResult>();

  /**
   * Allows setting a custom STT provider (e.g. for testing, offline mocking, or enterprise Whisper/Gemini).
   */
  public static setProvider(provider: SpeechToTextProvider): void {
    this.provider = provider;
  }

  /**
   * Main transcription entry point with bounded timeout and failure isolation.
   *
   * CRITICAL GUARANTEE:
   * If mediaResult is unavailable or null, this method NEVER fabricates a transcript!
   * It returns status="unavailable" and text="".
   */
  public static async transcribe(params: TranscriptionParams): Promise<TranscriptionResult> {
    const { mediaResult, audioBytes, languageHint, contentId, workspaceId, timeoutMs = 120000 } = params;

    // Cache lookup (Phase 17 Cost Control)
    const cacheKey = contentId && workspaceId ? `${workspaceId}:${contentId}` : undefined;
    if (cacheKey && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // Check media availability
    const buffer = audioBytes || mediaResult?.audio || mediaResult?.video;

    if (!buffer || (mediaResult && mediaResult.status !== "available")) {
      const unavailableResult: TranscriptionResult = {
        status: "unavailable",
        text: "",
        segments: [],
        provider: "none",
        modelVersion: "none",
        failureReason: mediaResult?.failureReason || "No accessible audio media available to transcribe.",
      };
      return unavailableResult;
    }

    // Bounded timeout execution
    const timeoutPromise = new Promise<TranscriptionResult>((_, reject) => {
      setTimeout(() => reject(new Error("Transcription request timed out.")), timeoutMs);
    });

    try {
      const result = await Promise.race([
        this.provider.transcribe(buffer, languageHint, mediaResult?.mimeType),
        timeoutPromise,
      ]);
      if (cacheKey && (result.status === "transcribed" || result.status === "no_speech")) this.cache.set(cacheKey, result);
      return result;
    } catch (err: any) {
      const failedResult: TranscriptionResult = {
        status: "failed",
        text: "",
        segments: [],
        provider: this.provider.name,
        modelVersion: this.provider.modelVersion,
        failureReason: err?.message || "Transcription failed unexpectedly.",
      };
      return failedResult;
    }
  }

  /**
   * Transcribes a SavedItem cleanly:
   * 1. Reuses existing item.metadata.transcript if present (Cost Control)
   * 2. Reuses in-memory cache if available
   * 3. Acquires media via MediaAcquisitionService if needed
   * 4. Returns structured TranscriptionResult
   */
  public static async transcribeItem(
    item: SavedItem,
    options?: {
      audioBytes?: Uint8Array | ArrayBuffer;
      mediaResult?: MediaAcquisitionResult;
      languageHint?: string;
      workspaceId?: string;
    }
  ): Promise<TranscriptionResult> {
    const contentId = item.metadata?.shortcode || item.id;

    // 1. Existing stored transcript check (immutability & cost control)
    const storedTranscript = item.metadata?.transcript;
    const representation = item.metadata?.contentRepresentation as { source?: string; status?: string; transcript?: string } | undefined;
    const transcriptSource = item.provenance?.transcript?.source;
    const trustedProviders = new Set(["faster-whisper", "openai-audio-transcriptions", "platform_caption_track", "youtube_caption_track", "speech_to_text"]);
    const representationIsVerified = representation?.status === "completed"
      && (representation.source === "transcription" || representation.source === "platform_transcript");
    const provenanceIsVerified = typeof transcriptSource === "string" && trustedProviders.has(transcriptSource);
    const storedTranscriptText = typeof storedTranscript === "string"
      ? storedTranscript
      : storedTranscript && typeof storedTranscript === "object" && typeof storedTranscript.text === "string"
      ? storedTranscript.text
      : "";
    const existingTranscript = representationIsVerified && typeof representation.transcript === "string"
      ? representation.transcript
      : provenanceIsVerified && storedTranscriptText
      ? storedTranscriptText
      : provenanceIsVerified && typeof item.provenance?.transcript?.value === "string"
      ? item.provenance.transcript.value
      : "";

    if (existingTranscript && existingTranscript.trim().length > 0) {
      const cachedResult: TranscriptionResult = {
        status: "transcribed",
        text: existingTranscript.trim(),
        language: options?.languageHint || "en",
        segments: [],
        confidence: 1.0,
        provider: representationIsVerified ? representation?.source || "stored_transcript" : transcriptSource || "stored_transcript",
        modelVersion: "persisted",
      };
      if (options?.workspaceId) this.cache.set(`${options.workspaceId}:${contentId}`, cachedResult);
      return cachedResult;
    }

    // 2. Cache lookup
    const cacheKey = options?.workspaceId ? `${options.workspaceId}:${contentId}` : undefined;
    if (cacheKey && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    // 3. Acquire media if not provided
    const audioBytes = options?.audioBytes || item.metadata?.testMediaBuffer;
    let media = options?.mediaResult;
    if (!media && !audioBytes) {
      media = await MediaAcquisitionService.acquireMedia({
        url: item.url,
        platform: item.platform,
        contentId,
      });
    } else if (audioBytes && !media) {
      media = {
        status: "available",
        audio: audioBytes,
        mimeType: "audio/mp3",
        source: "provided_audio_buffer",
      };
    }

    return this.transcribe({
      contentId,
      workspaceId: options?.workspaceId,
      mediaResult: media,
      audioBytes,
      languageHint: options?.languageHint,
    });
  }

  /**
   * Ingests a pre-verified transcript into cache (e.g. from user export or test fixture).
   */
  public static setCachedTranscript(workspaceId: string, contentId: string, result: TranscriptionResult): void {
    this.cache.set(`${workspaceId}:${contentId}`, result);
  }

  /**
   * Canonical type guard verifying whether a stored transcript is a structured object.
   */
  public static isStructuredTranscript(value: unknown): value is StructuredTranscript {
    return typeof value === "object" && value !== null && "status" in value;
  }

  public static clearCache(): void {
    this.cache.clear();
  }
}
