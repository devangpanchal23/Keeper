/**
 * Production-Grade Safe ZIP Archive Reader
 *
 * Lightweight, zero-external-dependency ZIP parser designed specifically for extracting
 * structured text/JSON files from user-uploaded archives (such as Meta/Instagram exports).
 *
 * Security Controls:
 * 1. Strict Central Directory parsing (reads metadata BEFORE decompressing)
 * 2. Zip-bomb protection: hard limits on maximum uncompressed entry size and total archive size
 * 3. Path traversal protection: rejects entries with "..", null bytes, or absolute path traversal
 * 4. Binary exclusion: skips media (mp4, jpg, png, etc.) without reading or decompressing
 * 5. Environment resilient: operates in both modern browsers (DecompressionStream) and Node.js (zlib)
 */

export interface ZipEntryMetadata {
  filename: string;
  compressedSize: number;
  uncompressedSize: number;
  compressionMethod: number; // 0 = Stored, 8 = Deflated
  relativeOffset: number;
}

export interface ZipReaderLimits {
  maxArchiveSizeBytes?: number;
  maxEntriesInspected?: number;
  maxJsonFilesExtracted?: number;
  maxSingleEntryUncompressedBytes?: number;
  maxTotalUncompressedBytes?: number;
}

const DEFAULT_LIMITS: Required<ZipReaderLimits> = {
  maxArchiveSizeBytes: 100 * 1024 * 1024, // 100 MB max archive size
  maxEntriesInspected: 1000,
  maxJsonFilesExtracted: 50,
  maxSingleEntryUncompressedBytes: 15 * 1024 * 1024, // 15 MB per JSON file
  maxTotalUncompressedBytes: 50 * 1024 * 1024, // 50 MB total decompressed
};

export class ZipArchiveReader {
  /**
   * Fast signature check: returns true if buffer starts with ZIP magic number 'PK\x03\x04'
   */
  public static isZip(data: Uint8Array | ArrayBuffer): boolean {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    if (bytes.length < 4) return false;
    return (
      bytes[0] === 0x50 && // P
      bytes[1] === 0x4b && // K
      bytes[2] === 0x03 &&
      bytes[3] === 0x04
    );
  }

  /**
   * Reads the Central Directory to discover all entries safely without decompressing payload.
   */
  public static readCentralDirectory(
    data: Uint8Array | ArrayBuffer,
    limits: ZipReaderLimits = {}
  ): ZipEntryMetadata[] {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };

    if (bytes.length < 22) {
      throw new Error("Archive is too small to be a valid ZIP file.");
    }

    if (bytes.length > resolvedLimits.maxArchiveSizeBytes) {
      throw new Error(
        `Archive exceeds maximum safe size of ${Math.round(
          resolvedLimits.maxArchiveSizeBytes / 1024 / 1024
        )}MB (uploaded size: ${Math.round(bytes.length / 1024 / 1024)}MB). Please extract JSON files directly.`
      );
    }

    // 1. Locate End of Central Directory Record (EOCD) by searching backwards from the end
    // EOCD signature: 0x06054b50 ("PK\x05\x06")
    let eocdOffset = -1;
    const maxSearchLength = Math.min(bytes.length, 65557); // 65535 max comment + 22 EOCD size
    const searchStart = bytes.length - maxSearchLength;

    for (let i = bytes.length - 22; i >= searchStart; i--) {
      if (
        bytes[i] === 0x50 &&
        bytes[i + 1] === 0x4b &&
        bytes[i + 2] === 0x05 &&
        bytes[i + 3] === 0x06
      ) {
        eocdOffset = i;
        break;
      }
    }

    if (eocdOffset === -1) {
      throw new Error("Invalid ZIP archive: End of Central Directory record not found.");
    }

    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const totalEntries = view.getUint16(eocdOffset + 10, true);
    const cdSize = view.getUint32(eocdOffset + 12, true);
    const cdOffset = view.getUint32(eocdOffset + 16, true);

    if (totalEntries > resolvedLimits.maxEntriesInspected) {
      throw new Error(
        `Archive exceeds safety limit: ${totalEntries} entries (maximum allowed: ${resolvedLimits.maxEntriesInspected}).`
      );
    }

    if (cdOffset + cdSize > bytes.length) {
      throw new Error("Invalid ZIP archive: Central Directory offset out of bounds.");
    }

    // 2. Iterate through Central Directory File Headers (signature 0x02014b50 "PK\x01\x02")
    const entries: ZipEntryMetadata[] = [];
    const seenFilenames = new Set<string>();
    let currentOffset = cdOffset;
    const decoder = new TextDecoder("utf-8");

    while (currentOffset < cdOffset + cdSize) {
      if (currentOffset + 46 > bytes.length) break;

      const sig = view.getUint32(currentOffset, true);
      if (sig !== 0x02014b50) {
        break; // Not a Central Directory header
      }

      const compressionMethod = view.getUint16(currentOffset + 10, true);
      const compressedSize = view.getUint32(currentOffset + 20, true);
      const uncompressedSize = view.getUint32(currentOffset + 24, true);
      const filenameLength = view.getUint16(currentOffset + 28, true);
      const extraFieldLength = view.getUint16(currentOffset + 30, true);
      const commentLength = view.getUint16(currentOffset + 32, true);
      const relativeOffset = view.getUint32(currentOffset + 42, true);

      const filenameBytes = bytes.subarray(
        currentOffset + 46,
        currentOffset + 46 + filenameLength
      );
      const rawFilename = decoder.decode(filenameBytes);

      // Path traversal & malicious format security check
      const normalizedFilename = rawFilename.replace(/\\/g, "/");
      if (
        normalizedFilename.includes("../") ||
        normalizedFilename.includes("/..") ||
        normalizedFilename.startsWith("../") ||
        normalizedFilename.startsWith("/") ||
        normalizedFilename.includes("\0") ||
        normalizedFilename.includes(":")
      ) {
        // Skip potentially malicious entry
        currentOffset += 46 + filenameLength + extraFieldLength + commentLength;
        continue;
      }

      // Skip duplicate filename entries inside archive
      if (seenFilenames.has(normalizedFilename)) {
        currentOffset += 46 + filenameLength + extraFieldLength + commentLength;
        continue;
      }
      seenFilenames.add(normalizedFilename);

      entries.push({
        filename: normalizedFilename,
        compressedSize,
        uncompressedSize,
        compressionMethod,
        relativeOffset,
      });

      currentOffset += 46 + filenameLength + extraFieldLength + commentLength;
    }

    return entries;
  }

  /**
   * Safely extracts only the structured JSON files relevant to Instagram exports from a ZIP archive.
   * Returns a map of relativeFilename -> textContent.
   */
  public static async extractJsonFiles(
    data: Uint8Array | ArrayBuffer,
    limits: ZipReaderLimits = {}
  ): Promise<{ files: Record<string, string>; warnings: string[] }> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };
    const warnings: string[] = [];
    const files: Record<string, string> = {};

    const entries = this.readCentralDirectory(bytes, resolvedLimits);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    // Filter to only .json files (ignoring images, videos, audio, etc.)
    const jsonEntries = entries.filter((e) => {
      const lower = e.filename.toLowerCase();
      return lower.endsWith(".json") && !lower.endsWith("/");
    });

    if (jsonEntries.length === 0) {
      warnings.push("No JSON files found inside the uploaded ZIP archive.");
      return { files, warnings };
    }

    let totalDecompressedBytes = 0;
    let extractedCount = 0;

    for (const entry of jsonEntries) {
      if (extractedCount >= resolvedLimits.maxJsonFilesExtracted) {
        warnings.push(
          `Reached maximum JSON extraction limit (${resolvedLimits.maxJsonFilesExtracted} files). Remaining files were skipped.`
        );
        break;
      }

      // Check zip-bomb size limits for individual entry
      if (entry.uncompressedSize > resolvedLimits.maxSingleEntryUncompressedBytes) {
        warnings.push(
          `Skipped '${entry.filename}': size (${Math.round(
            entry.uncompressedSize / 1024 / 1024
          )}MB) exceeds maximum safe size (${Math.round(
            resolvedLimits.maxSingleEntryUncompressedBytes / 1024 / 1024
          )}MB).`
        );
        continue;
      }

      if (
        totalDecompressedBytes + entry.uncompressedSize >
        resolvedLimits.maxTotalUncompressedBytes
      ) {
        warnings.push(
          `Reached maximum safe total decompression size (${Math.round(
            resolvedLimits.maxTotalUncompressedBytes / 1024 / 1024
          )}MB). Stopping extraction.`
        );
        break;
      }

      // Read local file header to locate compressed data offset
      // Local header signature: 0x04034b50 ("PK\x03\x04")
      if (entry.relativeOffset + 30 > bytes.length) continue;
      const localSig = view.getUint32(entry.relativeOffset, true);
      if (localSig !== 0x04034b50) continue;

      const localFilenameLen = view.getUint16(entry.relativeOffset + 26, true);
      const localExtraLen = view.getUint16(entry.relativeOffset + 28, true);
      const dataOffset = entry.relativeOffset + 30 + localFilenameLen + localExtraLen;

      if (dataOffset + entry.compressedSize > bytes.length) {
        warnings.push(`File data for '${entry.filename}' is truncated or out of bounds.`);
        continue;
      }

      const compressedChunk = bytes.subarray(dataOffset, dataOffset + entry.compressedSize);

      let textContent = "";

      if (entry.compressionMethod === 0) {
        // Stored (no compression)
        const decoder = new TextDecoder("utf-8");
        textContent = decoder.decode(compressedChunk);
      } else if (entry.compressionMethod === 8) {
        // Deflated (RFC 1951 raw deflate)
        try {
          textContent = await this.decompressRawDeflate(compressedChunk);
        } catch (decompErr: any) {
          warnings.push(
            `Failed to decompress '${entry.filename}': ${decompErr?.message || "Invalid deflate stream"}`
          );
          continue;
        }
      } else {
        warnings.push(
          `Skipped '${entry.filename}': unsupported compression method (${entry.compressionMethod}).`
        );
        continue;
      }

      files[entry.filename] = textContent;
      totalDecompressedBytes += entry.uncompressedSize;
      extractedCount++;
    }

    return { files, warnings };
  }

  /**
   * Extracts raw bytes for a specific archive entry by filename / path safely.
   */
  public static async extractEntryBytes(
    data: Uint8Array | ArrayBuffer,
    targetPath: string,
    limits: ZipReaderLimits = {}
  ): Promise<Uint8Array | null> {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };
    const entries = this.readCentralDirectory(bytes, resolvedLimits);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

    const normalizedTarget = targetPath.toLowerCase().replace(/\\/g, "/").replace(/^\/+/, "");
    const entry = entries.find((e) => {
      const norm = e.filename.toLowerCase().replace(/\\/g, "/").replace(/^\/+/, "");
      return norm === normalizedTarget || norm.endsWith("/" + normalizedTarget) || norm.endsWith(normalizedTarget);
    });

    if (!entry) return null;
    if (entry.uncompressedSize > resolvedLimits.maxSingleEntryUncompressedBytes) return null;

    if (entry.relativeOffset + 30 > bytes.length) return null;
    const localSig = view.getUint32(entry.relativeOffset, true);
    if (localSig !== 0x04034b50) return null;

    const localFilenameLen = view.getUint16(entry.relativeOffset + 26, true);
    const localExtraLen = view.getUint16(entry.relativeOffset + 28, true);
    const dataOffset = entry.relativeOffset + 30 + localFilenameLen + localExtraLen;

    if (dataOffset + entry.compressedSize > bytes.length) return null;

    const compressedChunk = bytes.subarray(dataOffset, dataOffset + entry.compressedSize);

    if (entry.compressionMethod === 0) {
      return compressedChunk;
    } else if (entry.compressionMethod === 8) {
      try {
        return await this.decompressRawDeflateBytes(compressedChunk);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Discovers and extracts media files from archive entries into Data URLs.
   */
  public static async extractMediaDataUrls(
    data: Uint8Array | ArrayBuffer,
    targetPaths?: string[],
    limits: ZipReaderLimits = {}
  ): Promise<Map<string, string>> {
    const result = new Map<string, string>();
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    const resolvedLimits = { ...DEFAULT_LIMITS, ...limits };
    const entries = this.readCentralDirectory(bytes, resolvedLimits);

    const mediaExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".mp4"];
    const targets = targetPaths
      ? new Set(targetPaths.map((p) => p.toLowerCase().replace(/\\/g, "/").replace(/^\/+/, "")))
      : null;

    for (const entry of entries) {
      const normName = entry.filename.toLowerCase().replace(/\\/g, "/").replace(/^\/+/, "");
      const ext = mediaExtensions.find((e) => normName.endsWith(e));
      if (!ext) continue;

      if (targets && !targets.has(normName)) {
        const matchesTarget = Array.from(targets).some(
          (t) => normName.endsWith("/" + t) || normName.endsWith(t)
        );
        if (!matchesTarget) continue;
      }

      const fileBytes = await this.extractEntryBytes(bytes, entry.filename, limits);
      if (!fileBytes) continue;

      let mime = "image/jpeg";
      if (normName.endsWith(".png")) mime = "image/png";
      else if (normName.endsWith(".webp")) mime = "image/webp";
      else if (normName.endsWith(".gif")) mime = "image/gif";
      else if (normName.endsWith(".mp4")) mime = "video/mp4";

      let base64 = "";
      if (typeof Buffer !== "undefined") {
        base64 = Buffer.from(fileBytes).toString("base64");
      } else {
        let binary = "";
        const len = fileBytes.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(fileBytes[i]);
        }
        base64 = btoa(binary);
      }

      const dataUrl = `data:${mime};base64,${base64}`;
      result.set(normName, dataUrl);
      result.set(entry.filename, dataUrl);
      const basename = normName.split("/").pop();
      if (basename) result.set(basename, dataUrl);
    }

    return result;
  }

  /**
   * Decompresses raw deflate bytes returning binary Uint8Array.
   */
  private static async decompressRawDeflateBytes(chunk: Uint8Array): Promise<Uint8Array> {
    if (typeof DecompressionStream !== "undefined") {
      try {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        const arrayBuffer = new ArrayBuffer(chunk.byteLength);
        new Uint8Array(arrayBuffer).set(chunk);
        await writer.write(arrayBuffer);
        await writer.close();
        const response = new Response(ds.readable);
        const buf = await response.arrayBuffer();
        return new Uint8Array(buf);
      } catch {
        // Fall through to node zlib
      }
    }

    if (typeof process !== "undefined" && process.versions && process.versions.node) {
      try {
        const zlib = await import("zlib");
        const buffer = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        const decompressed = zlib.inflateRawSync(buffer);
        return new Uint8Array(decompressed.buffer, decompressed.byteOffset, decompressed.byteLength);
      } catch (err: any) {
        throw new Error(`Node zlib binary decompression failed: ${err.message}`);
      }
    }

    throw new Error(
      "Deflate binary decompression is not supported in this environment without DecompressionStream."
    );
  }

  /**
   * Decompresses raw deflate bytes using DecompressionStream in Browser or zlib in Node.js.
   */
  private static async decompressRawDeflate(chunk: Uint8Array): Promise<string> {
    // 1. Browser environment with DecompressionStream ('deflate-raw')
    if (typeof DecompressionStream !== "undefined") {
      try {
        const ds = new DecompressionStream("deflate-raw");
        const writer = ds.writable.getWriter();
        const arrayBuffer = new ArrayBuffer(chunk.byteLength);
        new Uint8Array(arrayBuffer).set(chunk);
        await writer.write(arrayBuffer);
        await writer.close();
        const response = new Response(ds.readable);
        return await response.text();
      } catch {
        // Fall through to node zlib if browser DecompressionStream failed on raw stream
      }
    }

    // 2. Node.js environment (dynamic import to prevent bundling issues in pure client builds)
    if (typeof process !== "undefined" && process.versions && process.versions.node) {
      try {
        // Dynamic import zlib
        const zlib = await import("zlib");
        const buffer = Buffer.from(chunk.buffer, chunk.byteOffset, chunk.byteLength);
        const decompressed = zlib.inflateRawSync(buffer);
        return decompressed.toString("utf-8");
      } catch (err: any) {
        throw new Error(`Node zlib decompression failed: ${err.message}`);
      }
    }

    throw new Error(
      "Deflate decompression is not supported in this environment without DecompressionStream."
    );
  }
}

