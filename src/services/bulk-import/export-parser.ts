import { Platform } from "@/types";
import { ProviderRegistry } from "../providers/provider-registry";
import { InstagramExportAdapter } from "./adapters/instagram-export-adapter";

export interface ParsedImportCandidate {
  originalUrl: string;
  platform: Platform;
  title?: string;
  creatorName?: string;
  caption?: string;
  hashtags?: string[];
  fbid?: string;
  thumbnailUrl?: string;
  sourceContext?: string;
  savedTimestamp?: number | string;
  collectionId?: string;
  collectionName?: string;
}

export class ExportFileParser {
  /**
   * Parses arbitrary user input: HTML bookmarks, JSON, CSV, or raw newline-delimited URLs.
   */
  public static parse(content: string, filename?: string): ParsedImportCandidate[] {
    const trimmed = (content || "").trim();
    if (!trimmed) return [];

    const lowerName = (filename || "").toLowerCase();

    // 1. Check if it's a Browser Bookmarks HTML file (Netscape Bookmark format)
    if (
      lowerName.endsWith(".html") ||
      lowerName.endsWith(".htm") ||
      trimmed.includes("<!DOCTYPE NETSCAPE-Bookmark-file-1>") ||
      /<A\s+[^>]*HREF=/i.test(trimmed)
    ) {
      const bookmarkResults = this.parseBookmarkHtml(trimmed);
      if (bookmarkResults.length > 0) return bookmarkResults;
    }

    // 2. Check if it's JSON
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const json = JSON.parse(trimmed);
        const jsonResults = this.parseJsonExport(json, lowerName);
        if (jsonResults.length > 0) return jsonResults;
      } catch {
        // Fall through to text/csv parsing
      }
    }

    // 3. Check if it's CSV
    if (lowerName.endsWith(".csv") || trimmed.includes(",")) {
      const csvResults = this.parseCsvExport(trimmed);
      if (csvResults.length > 0) return csvResults;
    }

    // 4. Fallback: Parse raw URLs from plaintext
    return this.parseRawUrlList(trimmed);
  }

  /**
   * Parses standard Netscape Bookmark HTML files exported by Chrome, Safari, Firefox, Edge, Brave.
   * Format: <A HREF="https://..." ADD_DATE="1700000000" ...>Title of Bookmark</A>
   */
  public static parseBookmarkHtml(html: string): ParsedImportCandidate[] {
    const results: ParsedImportCandidate[] = [];
    const registry = ProviderRegistry.getInstance();

    const linkRegex = /<A\s+([^>]*?)HREF=["']([^"']+)["']([^>]*?)>(.*?)<\/A>/gi;
    let match: RegExpExecArray | null;

    while ((match = linkRegex.exec(html)) !== null) {
      const attrs = `${match[1]} ${match[3]}`;
      const href = match[2]?.trim();
      let rawTitle = match[4]?.replace(/<[^>]+>/g, "").trim();

      // Clean HTML entities from title
      rawTitle = rawTitle
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

      if (href && (href.startsWith("http://") || href.startsWith("https://"))) {
        // Extract optional timestamp from ADD_DATE="..."
        const dateMatch = attrs.match(/ADD_DATE=["']?(\d+)["']?/i);
        const timestamp = dateMatch && dateMatch[1] ? parseInt(dateMatch[1], 10) * 1000 : undefined;

        results.push({
          originalUrl: href,
          platform: registry.identifyPlatform(href),
          title: rawTitle || undefined,
          sourceContext: "Browser Bookmarks",
          savedTimestamp: timestamp,
        });
      }
    }

    return results;
  }

  /**
   * Parses official JSON exports from Instagram, YouTube, Reddit, or generic JSON structures
   */
  public static parseJsonExport(json: any, filename: string): ParsedImportCandidate[] {
    const results: ParsedImportCandidate[] = [];
    const registry = ProviderRegistry.getInstance();

    // Case A & B: Instagram Exports (saved_posts, saved_collections, Accounts Center, etc.)
    const igAnalysis = InstagramExportAdapter.parseJsonObject(json, filename);
    if (igAnalysis.isValid && igAnalysis.candidates.length > 0) {
      return igAnalysis.candidates.map((c) => ({
        originalUrl: c.originalUrl,
        platform: "instagram",
        title: c.title,
        creatorName: c.creatorName,
        caption: c.caption,
        hashtags: c.hashtags,
        fbid: c.fbid,
        thumbnailUrl: c.thumbnailUrl,
        sourceContext: c.sourceCollection || c.sourceContext || "Instagram Saved Media",
        collectionId: c.collectionId,
        collectionName: c.sourceCollection || c.collectionName,
        savedTimestamp: c.savedTimestamp,
      }));
    }

    // Case C: Reddit Saved Export JSON: { data: { children: [ { data: { permalink: "...", title: "...", subreddit: "..." } } ] } }
    if (json.data && Array.isArray(json.data.children)) {
      for (const child of json.data.children) {
        const item = child.data;
        if (!item) continue;
        const permalink = item.permalink;
        const fullUrl = permalink
          ? (permalink.startsWith("http") ? permalink : `https://www.reddit.com${permalink}`)
          : item.url;
        if (fullUrl) {
          results.push({
            originalUrl: fullUrl,
            platform: "reddit",
            title: item.title || undefined,
            sourceContext: item.subreddit ? `r/${item.subreddit}` : "Reddit Saved",
            savedTimestamp: item.created_utc ? item.created_utc * 1000 : undefined,
          });
        }
      }
      if (results.length > 0) return results;
    }

    // Case D: YouTube Takeout playlists.json or watch-history.json
    if (Array.isArray(json)) {
      for (const entry of json) {
        // Watch history format or playlist item format
        const url = entry.titleUrl || entry.url || entry.snippet?.resourceId?.videoId;
        if (url) {
          const fullUrl = url.startsWith("http")
            ? url
            : `https://www.youtube.com/watch?v=${url}`;
          results.push({
            originalUrl: fullUrl,
            platform: registry.identifyPlatform(fullUrl),
            title: entry.title || entry.snippet?.title,
            sourceContext: "YouTube Takeout",
          });
        }
      }
      if (results.length > 0) return results;
    }

    // Case E: Generic JSON array of URLs or objects
    if (typeof json === "object") {
      const urls = this.extractUrlsFromObject(json);
      for (const u of urls) {
        results.push({
          originalUrl: u,
          platform: registry.identifyPlatform(u),
          sourceContext: "Import File",
        });
      }
    }

    return results;
  }

  /**
   * Parses CSV exports, including YouTube Takeout Watch later.csv, Reddit CSVs, and generic CSVs
   */
  public static parseCsvExport(csvText: string): ParsedImportCandidate[] {
    const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return [];

    const results: ParsedImportCandidate[] = [];
    const registry = ProviderRegistry.getInstance();

    // Check header
    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(",").map((h) => h.replace(/^["']|["']$/g, "").trim());
    const urlColIndex = headers.findIndex(
      (h) => h === "url" || h === "link" || h === "permalink" || h.includes("url") || h.includes("link")
    );
    const titleColIndex = headers.findIndex((h) => h === "title" || h === "name");

    const startIndex = (headerLine.includes("video id") || headerLine.includes("url") || headerLine.includes("link") || headerLine.includes("permalink"))
      ? 1
      : 0;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      const columns = this.parseCsvLine(line);
      if (columns.length === 0) continue;

      let targetUrl = "";
      let title: string | undefined;

      if (urlColIndex !== -1 && columns[urlColIndex]) {
        targetUrl = columns[urlColIndex];
        if (titleColIndex !== -1 && columns[titleColIndex]) {
          title = columns[titleColIndex];
        }
      } else {
        const firstCol = columns[0];
        // YouTube Video ID (11 chars) in CSV
        if (/^[a-zA-Z0-9_-]{11}$/.test(firstCol)) {
          targetUrl = `https://www.youtube.com/watch?v=${firstCol}`;
        } else if (firstCol.startsWith("http://") || firstCol.startsWith("https://")) {
          targetUrl = firstCol;
        } else {
          // Check if any column contains a URL
          const found = columns.find((c) => c.startsWith("http://") || c.startsWith("https://"));
          if (found) targetUrl = found;
        }
      }

      if (targetUrl) {
        // Handle relative Reddit permalink in CSV
        if (targetUrl.startsWith("/r/")) {
          targetUrl = `https://www.reddit.com${targetUrl}`;
        }

        results.push({
          originalUrl: targetUrl,
          platform: registry.identifyPlatform(targetUrl),
          title: title || undefined,
          sourceContext: "CSV Import",
        });
      }
    }

    return results;
  }

  /**
   * Helper to parse a single CSV line with quoted string support
   */
  private static parseCsvLine(line: string): string[] {
    const columns: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"' || char === "'") {
        insideQuotes = !insideQuotes;
      } else if (char === "," && !insideQuotes) {
        columns.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    columns.push(current.trim());
    return columns.map((c) => c.replace(/^["']|["']$/g, "").trim());
  }

  /**
   * Extracts raw URLs from newline/whitespace delimited string
   */
  public static parseRawUrlList(text: string): ParsedImportCandidate[] {
    const results: ParsedImportCandidate[] = [];
    const registry = ProviderRegistry.getInstance();

    const urlRegex = /(https?:\/\/[^\s"'<>]+)/gi;
    const matches = text.match(urlRegex) || [];

    for (const raw of matches) {
      const clean = raw.trim().replace(/[.,;:)]+$/, "");
      results.push({
        originalUrl: clean,
        platform: registry.identifyPlatform(clean),
        sourceContext: "URL List",
      });
    }

    return results;
  }

  private static extractUrlsFromObject(obj: any): string[] {
    const found: string[] = [];
    const recurse = (val: any) => {
      if (!val) return;
      if (typeof val === "string" && (val.startsWith("http://") || val.startsWith("https://"))) {
        found.push(val.trim());
      } else if (Array.isArray(val)) {
        val.forEach(recurse);
      } else if (typeof val === "object") {
        Object.values(val).forEach(recurse);
      }
    };
    recurse(obj);
    return found;
  }
}
