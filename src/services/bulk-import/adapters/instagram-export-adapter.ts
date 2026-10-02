/**
 * Instagram Official Export Adapter
 *
 * Primary Source Acquisition Adapter for official Instagram / Meta data exports
 * ("Download Your Information" feature from Meta Accounts Center).
 *
 * Architectural Boundaries:
 * - Pure discovery & extraction: converts untrusted export files/archives into normalized ParsedImportCandidate[]
 * - Does NOT save to database
 * - Does NOT invoke AI pipelines
 * - Does NOT fetch network metadata or scrape endpoints
 * - Does NOT create ImportJobs or bypass duplicate analysis
 * - Relies strictly on content structure detection rather than brittle filename heuristics
 */

import { ParsedImportCandidate } from "../export-parser";
import { ZipArchiveReader, ZipReaderLimits } from "./zip-archive-reader";
import { MetadataNormalizer } from "../../normalizer/metadata-normalizer";

export interface DiscoveredInstagramCollection {
  name: string;
  count: number;
  sampleUrls: string[];
}

export interface InstagramExportCandidate extends ParsedImportCandidate {
  sourceCollection?: string;
  sourceType: "saved_collection" | "saved_post" | "saved_media" | "generic_instagram";
  creatorName?: string;
  thumbnailUrl?: string;
}

export interface InstagramExportAnalysis {
  isValid: boolean;
  totalFound: number;
  collections: DiscoveredInstagramCollection[];
  uncollectedCount: number;
  candidates: InstagramExportCandidate[];
  detectedSchemas: string[];
  warnings: string[];
  error?: string;
}

export class InstagramExportAdapter {
  /**
   * Main entrypoint for parsing string content (single JSON file or raw text).
   */
  public static parse(content: string, filename?: string): InstagramExportAnalysis {
    const trimmed = (content || "").trim();
    if (!trimmed) {
      return {
        isValid: false,
        totalFound: 0,
        collections: [],
        uncollectedCount: 0,
        candidates: [],
        detectedSchemas: [],
        warnings: ["Empty file content provided."],
      };
    }

    let parsedJson: any;
    try {
      parsedJson = JSON.parse(trimmed);
    } catch (err: any) {
      return {
        isValid: false,
        totalFound: 0,
        collections: [],
        uncollectedCount: 0,
        candidates: [],
        detectedSchemas: [],
        warnings: [],
        error: `Malformed JSON format: ${err?.message || "Invalid syntax"}`,
      };
    }

    return this.parseJsonObject(parsedJson, filename);
  }

  /**
   * Parses multiple JSON files uploaded together (e.g. user selected saved_posts.json AND saved_collections.json).
   * Deduplicates candidates while preserving collection associations.
   */
  public static parseMultipleJsonFiles(
    files: Array<{ content: string; filename: string }>
  ): InstagramExportAnalysis {
    const combinedCandidates: InstagramExportCandidate[] = [];
    const detectedSchemas = new Set<string>();
    const allWarnings: string[] = [];
    const seenUrls = new Map<string, InstagramExportCandidate>();

    for (const file of files) {
      const result = this.parse(file.content, file.filename);
      if (result.isValid) {
        result.detectedSchemas.forEach((s) => detectedSchemas.add(s));
        allWarnings.push(...result.warnings);

        for (const candidate of result.candidates) {
          const key = candidate.originalUrl.toLowerCase().trim();
          if (!seenUrls.has(key)) {
            seenUrls.set(key, candidate);
            combinedCandidates.push(candidate);
          } else {
            // If already seen without collection, but current occurrence has collection, update it
            const existing = seenUrls.get(key)!;
            if (!existing.sourceCollection && candidate.sourceCollection) {
              existing.sourceCollection = candidate.sourceCollection;
              existing.sourceContext = candidate.sourceCollection;
            }
            if (!existing.creatorName && candidate.creatorName) {
              existing.creatorName = candidate.creatorName;
            }
            if (!existing.caption && candidate.caption) {
              existing.caption = candidate.caption;
            }
            if (!existing.hashtags && candidate.hashtags) {
              existing.hashtags = candidate.hashtags;
            }
            if (!existing.fbid && candidate.fbid) {
              existing.fbid = candidate.fbid;
            }
            if (!existing.thumbnailUrl && candidate.thumbnailUrl) {
              existing.thumbnailUrl = candidate.thumbnailUrl;
            }
            if (!existing.savedTimestamp && candidate.savedTimestamp) {
              existing.savedTimestamp = candidate.savedTimestamp;
            }
          }
        }
      }
    }

    if (combinedCandidates.length === 0) {
      return {
        isValid: false,
        totalFound: 0,
        collections: [],
        uncollectedCount: 0,
        candidates: [],
        detectedSchemas: Array.from(detectedSchemas),
        warnings: allWarnings.length > 0 ? allWarnings : ["No Instagram saved content found in selected files."],
      };
    }

    const { collections, uncollectedCount } = this.summarizeCollections(combinedCandidates);

    return {
      isValid: true,
      totalFound: combinedCandidates.length,
      collections,
      uncollectedCount,
      candidates: combinedCandidates,
      detectedSchemas: Array.from(detectedSchemas),
      warnings: allWarnings,
    };
  }

  /**
   * Safely parses an official Instagram / Meta ZIP export archive in memory.
   */
  public static async parseZipArchive(
    data: Uint8Array | ArrayBuffer,
    limits?: ZipReaderLimits
  ): Promise<InstagramExportAnalysis> {
    try {
      const { files, warnings } = await ZipArchiveReader.extractJsonFiles(data, limits);

      if (Object.keys(files).length === 0) {
        return {
          isValid: false,
          totalFound: 0,
          collections: [],
          uncollectedCount: 0,
          candidates: [],
          detectedSchemas: [],
          warnings: warnings.length > 0 ? warnings : ["No JSON files found in archive."],
          error: "No readable JSON files found in the ZIP archive.",
        };
      }

      const fileList = Object.entries(files).map(([filename, content]) => ({
        filename,
        content,
      }));

      const result = this.parseMultipleJsonFiles(fileList);
      result.warnings = [...warnings, ...result.warnings];

      // Extract authentic media entries (photos/videos) included in export archive
      try {
        const mediaMap = await ZipArchiveReader.extractMediaDataUrls(data, undefined, limits);
        if (mediaMap.size > 0) {
          for (const candidate of result.candidates) {
            const rawThumb = candidate.thumbnailUrl?.trim();
            // If already an authentic external HTTP URL, keep it
            if (rawThumb && (rawThumb.startsWith("http://") || rawThumb.startsWith("https://"))) {
              continue;
            }

            let matchedDataUrl: string | undefined;

            // 1. Try matching explicit relative media path from export JSON
            if (rawThumb) {
              const normThumb = rawThumb.toLowerCase().replace(/\\/g, "/").replace(/^\/+/, "");
              if (mediaMap.has(normThumb)) {
                matchedDataUrl = mediaMap.get(normThumb);
              } else if (mediaMap.has(normThumb.split("/").pop()!)) {
                matchedDataUrl = mediaMap.get(normThumb.split("/").pop()!);
              }
            }

            // 2. Try matching by shortcode (e.g. media/posts/C3x90ZaLkPq.jpg)
            if (!matchedDataUrl) {
              const codeMatch = candidate.originalUrl.match(/(?:reel|reels|p|tv)\/([a-zA-Z0-9_\-]+)/i);
              if (codeMatch && codeMatch[1]) {
                const code = codeMatch[1].toLowerCase();
                for (const [pathKey, dataUrl] of mediaMap.entries()) {
                  if (pathKey.includes(code)) {
                    matchedDataUrl = dataUrl;
                    break;
                  }
                }
              }
            }

            // 3. Try matching by fbid
            if (!matchedDataUrl && candidate.fbid) {
              for (const [pathKey, dataUrl] of mediaMap.entries()) {
                if (pathKey.includes(candidate.fbid.toLowerCase())) {
                  matchedDataUrl = dataUrl;
                  break;
                }
              }
            }

            if (matchedDataUrl) {
              candidate.thumbnailUrl = matchedDataUrl;
            }
          }
        }
      } catch {
        // Non-blocking: If media extraction fails, proceed with parsed JSON candidates
      }

      return result;
    } catch (err: any) {
      return {
        isValid: false,
        totalFound: 0,
        collections: [],
        uncollectedCount: 0,
        candidates: [],
        detectedSchemas: [],
        warnings: [],
        error: `ZIP archive processing failed: ${err?.message || "Invalid archive"}`,
      };
    }
  }

  /**
   * Content-based schema analyzer and extractor for any parsed JavaScript object / array.
   */
  public static parseJsonObject(json: any, filename?: string): InstagramExportAnalysis {
    if (!json || typeof json !== "object") {
      return {
        isValid: false,
        totalFound: 0,
        collections: [],
        uncollectedCount: 0,
        candidates: [],
        detectedSchemas: [],
        warnings: ["Provided data is not a JSON object or array."],
      };
    }

    const candidates: InstagramExportCandidate[] = [];
    const detectedSchemas: string[] = [];
    const warnings: string[] = [];
    const seenUrlsInFile = new Set<string>();

    const addCandidate = (
      rawUrl: string,
      title?: string,
      collectionName?: string,
      timestamp?: number,
      sourceType: InstagramExportCandidate["sourceType"] = "generic_instagram",
      creatorName?: string,
      caption?: string,
      hashtags?: string[],
      fbid?: string,
      thumbnailUrl?: string
    ) => {
      const canonical = this.canonicalizeInstagramUrl(rawUrl);
      if (!canonical) return;

      const normKey = canonical.toLowerCase().trim();
      if (seenUrlsInFile.has(normKey)) return; // Internal batch deduplication
      seenUrlsInFile.add(normKey);

      const normalizedTitle = title ? MetadataNormalizer.normalizeText(title) : undefined;
      const normalizedCollection = collectionName ? MetadataNormalizer.normalizeText(collectionName) : undefined;
      const normalizedCreator = creatorName ? MetadataNormalizer.normalizeText(creatorName).replace(/^@/, "") : undefined;
      const normalizedCaption = caption ? MetadataNormalizer.normalizeText(caption) : undefined;
      const cleanThumbnail = thumbnailUrl && typeof thumbnailUrl === "string" ? thumbnailUrl.trim() : undefined;

      const derivedTitle = normalizedTitle || (normalizedCaption ? MetadataNormalizer.deriveDisplayTitleFromCaption(normalizedCaption, normalizedCreator || "Instagram", "Instagram", "Reel") : undefined);

      candidates.push({
        originalUrl: canonical,
        platform: "instagram",
        title: derivedTitle || undefined,
        creatorName: normalizedCreator || undefined,
        caption: normalizedCaption || undefined,
        hashtags: hashtags && hashtags.length > 0 ? hashtags : undefined,
        fbid: fbid || undefined,
        thumbnailUrl: cleanThumbnail || undefined,
        sourceCollection: normalizedCollection || undefined,
        sourceContext: normalizedCollection || "Instagram Saved",
        sourceType,
        savedTimestamp: timestamp ? (timestamp < 1e11 ? timestamp * 1000 : timestamp) : undefined,
      });
    };

    // -------------------------------------------------------------------------
    // SCHEMA 0: Direct Single Item / Object with label_values
    // Format: { label_values: [ ... ], fbid: "...", timestamp: 12345 }
    // -------------------------------------------------------------------------
    if (json.label_values && Array.isArray(json.label_values)) {
      const extracted = this.extractMediaRecord(json);
      if (extracted) {
        addCandidate(
          extracted.url,
          extracted.title,
          undefined,
          extracted.timestamp,
          "saved_post",
          extracted.creatorName,
          extracted.caption,
          extracted.hashtags,
          extracted.fbid,
          extracted.thumbnailUrl
        );
        detectedSchemas.push("meta_label_values_single");
      }
    }

    // -------------------------------------------------------------------------
    // SCHEMA 1: Saved Collections (saved_collections array)
    // Format: { saved_collections: [ { title: "Col Name", media: [ ... ] } ] }
    // -------------------------------------------------------------------------
    const collectionsArray = json.saved_collections || json.collections || (Array.isArray(json) && json[0]?.media ? json : null);
    if (Array.isArray(collectionsArray) && collectionsArray.length > 0) {
      let isCollectionSchema = false;

      for (const col of collectionsArray) {
        if (!col || typeof col !== "object") continue;
        const colTitle = col.title || col.name || "Instagram Collection";
        const mediaItems = col.media || col.items || col.string_list_data || [];

        if (Array.isArray(mediaItems)) {
          for (const item of mediaItems) {
            const extracted = this.extractMediaRecord(item);
            if (extracted) {
              isCollectionSchema = true;
              addCandidate(
                extracted.url,
                extracted.title || (item.title ? `${item.title} (${colTitle})` : undefined),
                colTitle,
                extracted.timestamp,
                "saved_collection",
                extracted.creatorName,
                extracted.caption,
                extracted.hashtags,
                extracted.fbid,
                extracted.thumbnailUrl
              );
            }
          }
        }
      }

      if (isCollectionSchema) {
        detectedSchemas.push("meta_saved_collections_v1");
      }
    }

    // -------------------------------------------------------------------------
    // SCHEMA 2: Saved Saved Media (saved_saved_media array)
    // Format: { saved_saved_media: [ { title: "author", string_map_data: { "Saved on": { href: "..." } } } ] }
    // -------------------------------------------------------------------------
    const mediaArray = json.saved_saved_media || json.saved_posts || json.saved_media || json.saved_items;
    if (Array.isArray(mediaArray) && mediaArray.length > 0) {
      let isMediaSchema = false;

      for (const item of mediaArray) {
        const extracted = this.extractMediaRecord(item);
        if (extracted) {
          isMediaSchema = true;
          addCandidate(
            extracted.url,
            extracted.title || (item.title ? `Post from ${item.title}` : undefined),
            undefined, // No collection grouping in flat saved_media
            extracted.timestamp,
            "saved_post",
            extracted.creatorName,
            extracted.caption,
            extracted.hashtags,
            extracted.fbid,
            extracted.thumbnailUrl
          );
        }
      }

      if (isMediaSchema) {
        detectedSchemas.push("meta_saved_posts_v1");
      }
    }

    // -------------------------------------------------------------------------
    // SCHEMA 3: Root Array of Media Items
    // Format: [ { href: "...", title: "...", timestamp: 123456 } ]
    // -------------------------------------------------------------------------
    if (Array.isArray(json) && candidates.length === 0) {
      let isArraySchema = false;
      for (const item of json) {
        const extracted = this.extractMediaRecord(item);
        if (extracted) {
          isArraySchema = true;
          addCandidate(
            extracted.url,
            extracted.title,
            item.collection || item.collection_name,
            extracted.timestamp,
            "saved_media",
            extracted.creatorName,
            extracted.caption,
            extracted.hashtags,
            extracted.fbid,
            extracted.thumbnailUrl
          );
        }
      }
      if (isArraySchema) {
        detectedSchemas.push("meta_direct_media_array");
      }
    }

    // -------------------------------------------------------------------------
    // SCHEMA 4: Heuristic Deep Tree Traversal (Defensive fallback for new Accounts Center schemas)
    // -------------------------------------------------------------------------
    if (candidates.length === 0) {
      const discovered = this.heuristicExtractFromTree(json);
      if (discovered.length > 0) {
        detectedSchemas.push("heuristic_tree_discovery");
        for (const item of discovered) {
          addCandidate(
            item.url,
            item.title,
            item.collectionName,
            item.timestamp,
            "generic_instagram",
            item.creatorName,
            item.caption,
            item.hashtags,
            item.fbid,
            item.thumbnailUrl
          );
        }
      }
    }

    // -------------------------------------------------------------------------
    // Result Assembly & Validation
    // -------------------------------------------------------------------------
    if (candidates.length === 0) {
      return {
        isValid: false,
        totalFound: 0,
        collections: [],
        uncollectedCount: 0,
        candidates: [],
        detectedSchemas,
        warnings: [
          "No valid Instagram post or reel links were found in the provided structure.",
        ],
      };
    }

    const { collections, uncollectedCount } = this.summarizeCollections(candidates);

    return {
      isValid: true,
      totalFound: candidates.length,
      collections,
      uncollectedCount,
      candidates,
      detectedSchemas,
      warnings,
    };
  }

  /**
   * Helper to summarize discovered collection groupings and counts.
   */
  private static summarizeCollections(
    candidates: InstagramExportCandidate[]
  ): { collections: DiscoveredInstagramCollection[]; uncollectedCount: number } {
    const colMap = new Map<string, { count: number; samples: string[] }>();
    let uncollectedCount = 0;

    for (const c of candidates) {
      if (c.sourceCollection) {
        const existing = colMap.get(c.sourceCollection);
        if (existing) {
          existing.count++;
          if (existing.samples.length < 3) existing.samples.push(c.originalUrl);
        } else {
          colMap.set(c.sourceCollection, { count: 1, samples: [c.originalUrl] });
        }
      } else {
        uncollectedCount++;
      }
    }

    const collections: DiscoveredInstagramCollection[] = Array.from(colMap.entries()).map(
      ([name, data]) => ({
        name,
        count: data.count,
        sampleUrls: data.samples,
      })
    );

    return { collections, uncollectedCount };
  }

  /**
   * Extracts URL, timestamp, optional title, and creator handle from a single item record in any Meta schema variation.
   */
  private static extractMediaRecord(item: any): {
    url: string;
    timestamp?: number;
    title?: string;
    creatorName?: string;
    caption?: string;
    hashtags?: string[];
    fbid?: string;
    thumbnailUrl?: string;
  } | null {
    if (!item) return null;

    // Pattern D: Modern Meta Accounts Center label_values schema (as in tempDATA.json / saved_posts.json)
    if (Array.isArray(item.label_values)) {
      let url: string | undefined;
      let caption: string | undefined;
      let labelTitle: string | undefined;
      let ownerUsername: string | undefined;
      let ownerName: string | undefined;
      const extractedHashtags: string[] = [];

      let thumbnailUrl: string | undefined;

      for (const lv of item.label_values) {
        if (!lv) continue;
        const lbl = typeof lv.label === "string" ? lv.label.toLowerCase() : "";
        const ttl = typeof lv.title === "string" ? lv.title.toLowerCase() : "";

        if (lbl === "url" && (lv.value || lv.href)) {
          url = lv.href || lv.value;
        } else if (
          (lbl === "thumbnail" || lbl === "image" || lbl === "preview" || lbl === "media" || lbl === "cover" ||
           ttl === "thumbnail" || ttl === "image" || ttl === "preview" || ttl === "media" || ttl === "cover") &&
          (lv.value || lv.href)
        ) {
          const thumbVal = lv.href || lv.value;
          if (typeof thumbVal === "string" && thumbVal.trim()) {
            thumbnailUrl = thumbVal.trim();
          }
        } else if (lbl === "caption" && typeof lv.value === "string") {
          caption = MetadataNormalizer.normalizeText(lv.value);
        } else if (lbl === "title" && typeof lv.value === "string" && lv.value.trim()) {
          labelTitle = MetadataNormalizer.normalizeText(lv.value);
        } else if (ttl === "owner" && Array.isArray(lv.dict)) {
          const findOwnerFields = (d: any) => {
            if (!d) return;
            if (Array.isArray(d)) {
              d.forEach(findOwnerFields);
            } else if (typeof d === "object") {
              if (d.dict) findOwnerFields(d.dict);
              if (d.label === "Username" && typeof d.value === "string") {
                ownerUsername = MetadataNormalizer.normalizeText(d.value).replace(/^@/, "");
              }
              if (d.label === "Name" && typeof d.value === "string" && d.value.trim()) {
                ownerName = MetadataNormalizer.normalizeText(d.value);
              }
            }
          };
          findOwnerFields(lv.dict);
        } else if (ttl === "hashtags" && Array.isArray(lv.dict)) {
          const findHashtags = (d: any) => {
            if (!d) return;
            if (Array.isArray(d)) d.forEach(findHashtags);
            else if (typeof d === "object") {
              if (d.dict) findHashtags(d.dict);
              if (d.value && typeof d.value === "string") extractedHashtags.push(d.value);
            }
          };
          findHashtags(lv.dict);
        }
      }

      // Check item.media array or direct media properties
      if (!thumbnailUrl && Array.isArray(item.media) && item.media.length > 0) {
        const m = item.media[0];
        const mUri = typeof m === "string" ? m : (m?.uri || m?.url);
        if (typeof mUri === "string" && mUri.trim()) {
          thumbnailUrl = mUri.trim();
        }
      }
      if (!thumbnailUrl) {
        const directThumb = item.thumbnail_url || item.thumbnail || item.image_url || item.image || item.media_url;
        const thumbStr = typeof directThumb === "string" ? directThumb : (directThumb?.uri || directThumb?.url);
        if (typeof thumbStr === "string" && thumbStr.trim()) {
          thumbnailUrl = thumbStr.trim();
        }
      }

      if (url && this.isInstagramContentUrl(url)) {
        const creator = ownerUsername || ownerName;
        const derivedTitle = labelTitle || (caption ? MetadataNormalizer.deriveDisplayTitleFromCaption(caption, creator || "Instagram", "Instagram", "Post") : undefined);
        return {
          url,
          timestamp: item.timestamp,
          title: derivedTitle,
          creatorName: creator,
          caption,
          hashtags: extractedHashtags.length > 0 ? extractedHashtags : undefined,
          fbid: item.fbid,
          thumbnailUrl,
        };
      }
    }

    const rawTitle = item.title || item.name || item.caption;
    const cleanTitle = typeof rawTitle === "string" ? MetadataNormalizer.normalizeText(rawTitle) : undefined;

    // In Meta saved_posts exports, item.title is frequently the author username (e.g. "photographer_art")
    let creatorName: string | undefined;
    if (cleanTitle) {
      if (/^[a-zA-Z0-9_\.]+$/.test(cleanTitle) && !cleanTitle.startsWith("http")) {
        creatorName = cleanTitle;
      } else {
        const match = cleanTitle.match(/^Post from\s+([a-zA-Z0-9_\.]+)/i);
        if (match) creatorName = match[1];
      }
    }

    // Extract thumbnail from media/thumbnail properties if present
    let extractedThumbnail: string | undefined;
    if (Array.isArray(item.media) && item.media.length > 0) {
      const m = item.media[0];
      const mUri = typeof m === "string" ? m : (m?.uri || m?.url);
      if (typeof mUri === "string" && mUri.trim()) {
        extractedThumbnail = mUri.trim();
      }
    }
    if (!extractedThumbnail) {
      const directThumb = item.thumbnail_url || item.thumbnail || item.image_url || item.image || item.media_url;
      const thumbStr = typeof directThumb === "string" ? directThumb : (directThumb?.uri || directThumb?.url);
      if (typeof thumbStr === "string" && thumbStr.trim()) {
        extractedThumbnail = thumbStr.trim();
      }
    }
    if (!extractedThumbnail && item.string_map_data && typeof item.string_map_data === "object") {
      const thumbEntry =
        item.string_map_data["Thumbnail"] ||
        item.string_map_data["thumbnail"] ||
        item.string_map_data["Media"] ||
        item.string_map_data["Media URI"] ||
        item.string_map_data["Image"];
      if (thumbEntry && typeof thumbEntry.href === "string") {
        extractedThumbnail = thumbEntry.href.trim();
      }
    }

    // Pattern A: direct properties (item.href or item.uri or item.url)
    const directUrl = item.href || item.uri || item.url;
    if (typeof directUrl === "string" && this.isInstagramContentUrl(directUrl)) {
      return {
        url: directUrl,
        timestamp: item.timestamp || item.creation_timestamp,
        title: cleanTitle,
        creatorName,
        thumbnailUrl: extractedThumbnail,
      };
    }

    // Pattern B: string_map_data (e.g. item.string_map_data["Saved on"].href)
    if (item.string_map_data && typeof item.string_map_data === "object") {
      const mapKeys = Object.keys(item.string_map_data);
      const targetEntry =
        item.string_map_data["Saved on"] ||
        item.string_map_data["saved_on"] ||
        (mapKeys.length > 0 ? item.string_map_data[mapKeys[0]] : null);

      if (targetEntry && typeof targetEntry.href === "string" && this.isInstagramContentUrl(targetEntry.href)) {
        return {
          url: targetEntry.href,
          timestamp: targetEntry.timestamp,
          title: cleanTitle,
          creatorName,
          thumbnailUrl: extractedThumbnail,
        };
      }
    }

    // Pattern C: string_list_data (e.g. item.string_list_data[0].href)
    if (Array.isArray(item.string_list_data) && item.string_list_data.length > 0) {
      const firstEntry = item.string_list_data[0];
      if (firstEntry && typeof firstEntry.href === "string" && this.isInstagramContentUrl(firstEntry.href)) {
        return {
          url: firstEntry.href,
          timestamp: firstEntry.timestamp,
          title: cleanTitle,
          creatorName,
          thumbnailUrl: extractedThumbnail,
        };
      }
    }

    return null;
  }

  /**
   * Heuristically searches a nested JSON tree for Instagram permalinks, associating them with parent collection names.
   * Safe against prototype pollution and circular references.
   */
  private static heuristicExtractFromTree(
    root: any,
    maxDepth: number = 8,
    maxTotal: number = 5000
  ): Array<{
    url: string;
    title?: string;
    collectionName?: string;
    timestamp?: number;
    creatorName?: string;
    caption?: string;
    hashtags?: string[];
    fbid?: string;
    thumbnailUrl?: string;
  }> {
    const results: Array<{
      url: string;
      title?: string;
      collectionName?: string;
      timestamp?: number;
      creatorName?: string;
      caption?: string;
      hashtags?: string[];
      fbid?: string;
      thumbnailUrl?: string;
    }> = [];
    const seen = new WeakSet();

    const traverse = (node: any, depth: number, currentCollection?: string) => {
      if (!node || depth > maxDepth || results.length >= maxTotal) return;

      if (typeof node === "object") {
        if (seen.has(node)) return;
        seen.add(node);

        // Derive collection name from object title or name if present
        let nextCollection = currentCollection;
        if (typeof node.title === "string" && !this.isInstagramContentUrl(node.title)) {
          nextCollection = node.title;
        } else if (typeof node.name === "string" && !this.isInstagramContentUrl(node.name)) {
          nextCollection = node.name;
        }

        // Check if current node is a media record
        const record = this.extractMediaRecord(node);
        if (record) {
          results.push({
            url: record.url,
            title: record.title,
            collectionName: currentCollection,
            timestamp: record.timestamp,
            creatorName: record.creatorName,
            caption: record.caption,
            hashtags: record.hashtags,
            fbid: record.fbid,
            thumbnailUrl: record.thumbnailUrl,
          });
          return;
        }

        // Recursively visit properties
        if (Array.isArray(node)) {
          for (const item of node) {
            traverse(item, depth + 1, nextCollection);
          }
        } else {
          for (const key of Object.keys(node)) {
            // Prototype pollution safeguard
            if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
            traverse(node[key], depth + 1, nextCollection);
          }
        }
      } else if (typeof node === "string" && this.isInstagramContentUrl(node)) {
        results.push({
          url: node,
          collectionName: currentCollection,
        });
      }
    };

    traverse(root, 0, undefined);
    return results;
  }

  /**
   * Validates if a string is a legitimate Instagram content link (post, reel, tv)
   */
  public static isInstagramContentUrl(url: string): boolean {
    return this.canonicalizeInstagramUrl(url) !== null;
  }

  /**
   * Canonicalizes an Instagram post, reel, or TV URL into a standard permalink.
   * Strictly validates scheme (http/https) and hostname (instagram.com, www.instagram.com, instagr.am).
   * Rejects attacker domains, subdomains, port tricks, credentials, javascript:, and data: URLs.
   * Returns null if the URL is not a valid Instagram content link.
   */
  public static canonicalizeInstagramUrl(url: string): string | null {
    if (!url || typeof url !== "string") return null;
    const trimmed = url.trim();

    // Guard against dangerous schemes before parsing
    if (/^(?:javascript|data|file|ftp|vbscript):/i.test(trimmed)) {
      return null;
    }

    try {
      const parsed = new URL(
        trimmed.startsWith("http://") || trimmed.startsWith("https://")
          ? trimmed
          : `https://${trimmed}`
      );

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return null;
      }

      const hostname = parsed.hostname.toLowerCase();
      const validHostnames = ["instagram.com", "www.instagram.com", "instagr.am"];
      if (!validHostnames.includes(hostname)) {
        return null;
      }

      // Match path: optional user prefix followed by /p/, /reel/, /reels/, or /tv/ and an alphanumeric shortcode
      const match = parsed.pathname.match(
        /^(?:\/[a-zA-Z0-9_\.]+)?\/(p|reel|reels|tv)\/([a-zA-Z0-9_\-]+)/i
      );
      if (!match) return null;

      const type = match[1].toLowerCase();
      const code = match[2];

      if (!code || code.length < 3) return null;

      const isReel = type === "reel" || type === "reels";
      return isReel
        ? `https://www.instagram.com/reel/${code}/`
        : `https://www.instagram.com/p/${code}/`;
    } catch {
      return null;
    }
  }
}
