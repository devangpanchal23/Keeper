import {
  AuthoritativeSourceData,
  ContentProcessingStatus,
  ContentType,
  FieldProvenance,
  Platform,
} from "@/types";
import { MediaAcquisitionResult } from "../media/media-acquisition-service";
import { TranscriptionResult, TranscriptSegment } from "../media/transcription-service";
import { VisualTextResult } from "../media/visual-text-service";
import { MetadataNormalizer } from "../normalizer/metadata-normalizer";

export type EvidenceLevel =
  | "URL_ONLY"
  | "METADATA_ONLY"
  | "TEXT_CONTENT"
  | "TRANSCRIBED"
  | "MULTIMODAL";

export interface ContentEvidence {
  url: string;
  canonicalUrl: string;
  platform: Platform;
  contentType: ContentType;
  creator?: {
    username?: string | null;
    name?: string | null;
    handle?: string | null;
  };
  title?: string;
  caption?: string;
  description?: string;
  hashtags: string[];
  transcript?: string;
  transcriptSegments?: TranscriptSegment[];
  visualText?: string;
  providerMetadata?: Record<string, any>;
  evidenceLevel: EvidenceLevel;
  contentStatus: ContentProcessingStatus;
  provenance: Record<string, FieldProvenance>;
  isRestricted: boolean;
}

export interface FuseEvidenceParams {
  sourceData: AuthoritativeSourceData;
  mediaResult?: MediaAcquisitionResult;
  transcription?: TranscriptionResult;
  visualResult?: VisualTextResult;
}

export class EvidenceFusionService {
  /**
   * Fuses platform metadata, acquired media, audio transcription, and visual OCR
   * into a single normalized ContentEvidence structure.
   *
   * HONEST QUALITY EVALUATION:
   * - URL_ONLY: Only a raw link was submitted without platform or body content.
   * - METADATA_ONLY: Factual author, platform, or title retrieved, but no body or speech.
   * - TEXT_CONTENT: Real caption or text description is present.
   * - TRANSCRIBED: Speech-to-text audio transcript was successfully generated.
   * - MULTIMODAL: Both audio transcript and on-screen visual OCR text were fused.
   *
   * HARD RULE: FULL_CONTENT is NEVER applied when Keeper only has URL or metadata.
   */
  public static fuseEvidence(params: FuseEvidenceParams): ContentEvidence {
    const { sourceData, mediaResult, transcription, visualResult } = params;
    const now = new Date().toISOString();

    const rawCaption = sourceData.caption || "";
    const rawTitle = sourceData.title || "";
    const rawDesc = sourceData.description || "";
    const rawTranscript = transcription?.text || sourceData.transcript || "";
    const rawVisual = visualResult?.visualText || "";

    const caption = MetadataNormalizer.normalizeText(rawCaption);
    const description = MetadataNormalizer.normalizeText(rawDesc);
    const transcript = MetadataNormalizer.normalizeText(rawTranscript);
    const visualText = MetadataNormalizer.normalizeText(rawVisual);

    // Extract hashtags from caption, description, and source metadata
    const hashtags = MetadataNormalizer.extractHashtags(
      `${caption} ${description} ${sourceData.bodyText || ""}`
    );

    // Provenance tracking
    const provenance: Record<string, FieldProvenance> = {
      ...sourceData.provenance,
    };

    if (transcription && transcription.status === "transcribed" && transcript.length > 0) {
      provenance.transcript = {
        value: transcript,
        source: transcription.provider || "speech_to_text",
        retrievedAt: now,
      };
    }

    if (visualResult && visualResult.status === "analyzed" && visualText.length > 0) {
      provenance.visualText = {
        value: visualText,
        source: "visual_text_ocr",
        retrievedAt: now,
      };
    }

    // Determine honest EvidenceLevel and ContentProcessingStatus
    let evidenceLevel: EvidenceLevel = "METADATA_ONLY";
    let contentStatus: ContentProcessingStatus = "METADATA_ONLY";

    const hasTranscript = Boolean(transcript && transcript.length >= 10);
    const hasVisualText = Boolean(visualText && visualText.length >= 10);
    const hasCaptionOrBody = Boolean(
      (caption && caption.length >= 15) ||
      (sourceData.bodyText && sourceData.bodyText.length >= 15)
    );
    const hasTitle = Boolean(rawTitle && !rawTitle.startsWith("http") && rawTitle.length > 5);

    if (hasTranscript && hasVisualText) {
      evidenceLevel = "MULTIMODAL";
      contentStatus = "FULL_CONTENT";
    } else if (hasTranscript) {
      evidenceLevel = "TRANSCRIBED";
      contentStatus = "FULL_CONTENT";
    } else if (hasCaptionOrBody) {
      evidenceLevel = "TEXT_CONTENT";
      contentStatus = "PARTIAL_CONTENT";
    } else if (hasTitle || (sourceData.creator && sourceData.creator.name !== "Instagram Creator")) {
      evidenceLevel = "METADATA_ONLY";
      contentStatus = "METADATA_ONLY";
    } else {
      evidenceLevel = "URL_ONLY";
      contentStatus = "INSUFFICIENT_CONTENT";
    }

    // Creator normalization
    let creator: ContentEvidence["creator"] = undefined;
    if (sourceData.creator) {
      const cName = MetadataNormalizer.normalizeText(sourceData.creator.name);
      const cHandle = sourceData.creator.handle
        ? MetadataNormalizer.normalizeText(sourceData.creator.handle)
        : undefined;
      const cUser = sourceData.creator.username || undefined;
      creator = {
        name: cName,
        handle: cHandle,
        username: cUser,
      };
    }

    // Title selection: If title is a raw URL or empty, derive semantic title from caption
    let title = rawTitle;
    if (!title || title.startsWith("http://") || title.startsWith("https://")) {
      if (caption) {
        title = MetadataNormalizer.deriveDisplayTitleFromCaption(
          caption,
          creator?.name || "Instagram",
          sourceData.platform === "instagram" ? "Instagram" : sourceData.platform,
          sourceData.contentType === "reel" ? "Reel" : "Post"
        );
      } else if (transcript) {
        const firstSentence = transcript.split(/[.?!]/)[0]?.trim();
        title = firstSentence && firstSentence.length > 10
          ? firstSentence.slice(0, 80)
          : `${sourceData.platform} ${sourceData.contentType}`;
      }
    }

    return {
      url: sourceData.canonicalUrl,
      canonicalUrl: sourceData.canonicalUrl,
      platform: sourceData.platform,
      contentType: sourceData.contentType,
      creator,
      title,
      caption: caption || undefined,
      description: description || undefined,
      hashtags,
      transcript: transcript || undefined,
      transcriptSegments: transcription?.segments,
      visualText: visualText || undefined,
      providerMetadata: sourceData.rawPlatformMetadata,
      evidenceLevel,
      contentStatus,
      provenance,
      isRestricted: Boolean(sourceData.isRestricted),
    };
  }
}
