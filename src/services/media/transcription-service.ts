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

  public async extractAudioForProvider(video: Uint8Array | ArrayBuffer, mimeType?: string): Promise<{ bytes: Uint8Array; durationSeconds?: number }> {
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
      const extracted = await this.extractAudioForProvider(audio, audioMime);
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

/** Gemini 3.5 Transcribe file API adapter. Only audio is uploaded; videos use Keeper's FFmpeg sidecar. */
export class GeminiTranscriptionProvider implements SpeechToTextProvider {
  readonly name = "gemini-3.5-transcribe";
  readonly modelVersion = "gemini-3.5-transcribe";

  async transcribe(input: Uint8Array | ArrayBuffer, languageHint?: string, mimeType?: string): Promise<TranscriptionResult> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return { status: "unavailable", text: "", segments: [], provider: this.name, modelVersion: this.modelVersion, failureReason: "GEMINI_API_KEY is not configured." };
    let audio = input instanceof Uint8Array ? input : new Uint8Array(input);
    let mime = (mimeType || "application/octet-stream").split(";")[0].toLowerCase();
    let durationSeconds: number | undefined;
    if (mime.startsWith("video/")) {
      const extracted = await new OpenAITranscriptionProvider().extractAudioForProvider(audio, mime);
      audio = extracted.bytes;
      mime = "audio/mp4";
      durationSeconds = extracted.durationSeconds;
    }
    const supported = new Set(["audio/wav", "audio/mp3", "audio/mpeg", "audio/aiff", "audio/aac", "audio/ogg", "audio/flac", "audio/m4a", "audio/mp4", "audio/webm", "audio/opus", "audio/x-m4a", "audio/x-wav"]);
    if (!supported.has(mime)) throw new Error(`Gemini transcription does not support this audio format (${mime}).`);
    if (!audio.byteLength) return { status: "no_speech", text: "", segments: [], provider: this.name, modelVersion: this.modelVersion };

    const started = await fetch("https://generativelanguage.googleapis.com/upload/v1beta/files", { method: "POST",
      headers: { "x-goog-api-key": apiKey, "X-Goog-Upload-Protocol": "resumable", "X-Goog-Upload-Command": "start",
        "X-Goog-Upload-Header-Content-Length": String(audio.byteLength), "X-Goog-Upload-Header-Content-Type": mime, "Content-Type": "application/json" },
      body: JSON.stringify({ file: { display_name: "keeper-audio" } }), signal: AbortSignal.timeout(30_000), cache: "no-store" });
    if (!started.ok) throw new Error(`Gemini file upload returned HTTP ${started.status}.`);
    const uploadUrl = started.headers.get("x-goog-upload-url");
    if (!uploadUrl || new URL(uploadUrl).hostname !== "generativelanguage.googleapis.com") throw new Error("Gemini file upload returned an invalid upload URL.");
    const uploaded = await fetch(uploadUrl, { method: "POST", headers: { "Content-Length": String(audio.byteLength), "X-Goog-Upload-Offset": "0", "X-Goog-Upload-Command": "upload, finalize" },
      body: audio.slice().buffer, signal: AbortSignal.timeout(120_000), cache: "no-store" });
    if (!uploaded.ok) throw new Error(`Gemini audio upload returned HTTP ${uploaded.status}.`);
    const file = await uploaded.json() as { file?: { uri?: unknown } };
    if (typeof file.file?.uri !== "string") throw new Error("Gemini audio upload returned no file URI.");
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", { method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" }, cache: "no-store", signal: AbortSignal.timeout(150_000),
      body: JSON.stringify({ model: this.modelVersion, input: [{ type: "audio", uri: file.file.uri, mime_type: mime }],
        generation_config: { transcription_config: { language_codes: languageHint ? [languageHint] : [], mode: { type: "verbatim" } } } }) });
    if (!response.ok) throw new Error(`Gemini transcription returned HTTP ${response.status}.`);
    const result = await response.json() as { output_text?: unknown; outputs?: Array<{ type?: unknown; text?: unknown }>; detected_language?: unknown };
    const value = typeof result.output_text === "string" ? result.output_text : result.outputs?.find((part) => part.type === "text")?.text;
    const text = typeof value === "string" ? value.trim() : "";
    return { status: text ? "transcribed" : "no_speech", text, segments: [], provider: this.name, modelVersion: this.modelVersion,
      language: typeof result.detected_language === "string" ? result.detected_language : undefined, durationSeconds };
  }
}

/** Deepgram Nova-3 multilingual adapter used only as an explicitly configured fallback. */
export class DeepgramNova3Provider implements SpeechToTextProvider {
  readonly name = "deepgram-nova-3";
  readonly modelVersion = "nova-3";
  async transcribe(input: Uint8Array | ArrayBuffer, languageHint?: string, mimeType?: string): Promise<TranscriptionResult> {
    const apiKey = process.env.DEEPGRAM_API_KEY;
    if (!apiKey) return { status: "unavailable", text: "", segments: [], provider: this.name, modelVersion: this.modelVersion, failureReason: "DEEPGRAM_API_KEY is not configured." };
    let audio = input instanceof Uint8Array ? input : new Uint8Array(input);
    let audioMime = mimeType || "application/octet-stream";
    if (audioMime.startsWith("video/")) {
      const extracted = await new OpenAITranscriptionProvider().extractAudioForProvider(audio, audioMime);
      audio = extracted.bytes;
      audioMime = "audio/mp4";
    }
    const query = new URLSearchParams({ model: this.modelVersion, smart_format: "true", punctuate: "true", language: languageHint || "multi" });
    const response = await fetch(`https://api.deepgram.com/v1/listen?${query}`, { method: "POST",
      headers: { Authorization: `Token ${apiKey}`, "Content-Type": audioMime },
      body: audio.slice().buffer, signal: AbortSignal.timeout(150_000), cache: "no-store" });
    if (!response.ok) throw new Error(`Deepgram Nova-3 returned HTTP ${response.status}.`);
    const result = await response.json() as { results?: { channels?: Array<{ detected_language?: unknown; alternatives?: Array<{ transcript?: unknown; confidence?: unknown; words?: Array<{ start?: number; end?: number; word?: string; confidence?: number }> }> }> } };
    const channel = result.results?.channels?.[0];
    const alternative = channel?.alternatives?.[0];
    const text = typeof alternative?.transcript === "string" ? alternative.transcript.trim() : "";
    const segments = (alternative?.words || []).flatMap((word) => typeof word.word === "string" ? [{ startMs: (word.start || 0) * 1000, endMs: (word.end || 0) * 1000, text: word.word,
      ...(typeof word.confidence === "number" ? { confidence: word.confidence } : {}) }] : []);
    return { status: text ? "transcribed" : "no_speech", text, segments, provider: this.name, modelVersion: this.modelVersion,
      language: typeof channel?.detected_language === "string" ? channel.detected_language : undefined,
      confidence: typeof alternative?.confidence === "number" ? alternative.confidence : undefined };
  }
}

function configuredProvider(): SpeechToTextProvider {
  const selected = process.env.TRANSCRIPTION_PROVIDER || "auto";
  const openAiKey = process.env.OPENAI_TRANSCRIPTION_API_KEY || process.env.OPENAI_API_KEY;
  if (selected === "gemini" || (selected === "auto" && process.env.GEMINI_API_KEY)) return new GeminiTranscriptionProvider();
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
      if (result.status === "failed" || result.status === "unavailable") return await this.transcribeWithFallback(buffer, languageHint, mediaResult?.mimeType, result);
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
      return await this.transcribeWithFallback(buffer, languageHint, mediaResult?.mimeType, failedResult);
    }
  }

  private static async transcribeWithFallback(audio: Uint8Array | ArrayBuffer, languageHint: string | undefined, mimeType: string | undefined, primary: TranscriptionResult): Promise<TranscriptionResult> {
    const status = Number(primary.failureReason?.match(/HTTP\s+(\d{3})/i)?.[1]);
    const reason = primary.failureReason || "";
    const retryable = status === 408 || status === 429 || status >= 500 || /timeout|timed out|network|fetch failed|ECONN|socket/i.test(reason);
    const fallbackName = process.env.TRANSCRIPTION_FALLBACK;
    if (!retryable || !fallbackName || fallbackName === primary.provider) return primary;
    const fallback = fallbackName === "deepgram" ? new DeepgramNova3Provider()
      : fallbackName === "openai" ? new OpenAITranscriptionProvider()
      : fallbackName === "faster-whisper" ? new FasterWhisperProvider() : null;
    if (!fallback) return primary;
    try {
      const result = await fallback.transcribe(audio, languageHint, mimeType);
      return result.status === "failed" || result.status === "unavailable" ? { ...result, failureReason: `${result.failureReason || "Fallback failed."} Primary ${primary.provider} failed: ${primary.failureReason || "provider error"}` } : result;
    } catch (error) {
      return { status: "failed", text: "", segments: [], provider: fallback.name, modelVersion: fallback.modelVersion,
        failureReason: `Fallback failed: ${error instanceof Error ? error.message : "provider error"}. Primary ${primary.provider} failed: ${primary.failureReason || "provider error"}` };
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
