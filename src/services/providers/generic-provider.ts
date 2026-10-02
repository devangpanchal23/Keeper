import {
  AuthoritativeSourceData,
  ContentType,
  Creator,
  FieldProvenance,
  Platform,
} from "@/types";
import { ContentProvider, UrlValidationResult } from "./content-provider.interface";

export class GenericWebsiteProvider implements ContentProvider {
  readonly platform: Platform = "website";

  canHandle(_url: string): boolean {
    return true; // Fallback for any standard web URL
  }

  validateAndCanonicalize(url: string): UrlValidationResult {
    try {
      const trimmed = url.trim();
      const urlObj = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
      const domain = urlObj.hostname.toLowerCase().replace(/^(?:www\.|m\.)/, "");
      const cleanPath = urlObj.pathname.replace(/\/+$/, "");

      const canonicalUrl = `${urlObj.protocol}//${urlObj.host}${cleanPath}`;
      const normalizedUrl = `${domain}${cleanPath}`;

      return {
        isValid: true,
        normalizedUrl,
        canonicalUrl,
        contentId: normalizedUrl,
        platform: "website",
        contentType: "website",
      };
    } catch {
      return {
        isValid: false,
        normalizedUrl: url,
        canonicalUrl: url,
        contentId: null,
        platform: "website",
        contentType: "website",
        error: "Malformed URL provided",
      };
    }
  }

  async fetchAuthoritativeData(
    url: string,
    signal?: AbortSignal
  ): Promise<AuthoritativeSourceData> {
    const validation = this.validateAndCanonicalize(url);
    const now = new Date().toISOString();
    const domain = validation.normalizedUrl.split("/")[0] || "website.com";

    const provenance: Record<string, FieldProvenance> = {
      canonicalUrl: { value: validation.canonicalUrl, source: "url_canonicalizer", retrievedAt: now },
    };

    try {
      const res = await fetch(validation.canonicalUrl, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        },
        signal,
      });

      if (res.ok) {
        const html = await res.text();

        // Extract title
        const titleMatch =
          html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
          html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const title = titleMatch ? titleMatch[1].trim() : domain;

        // Extract description
        const descMatch =
          html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
          html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
        const description = descMatch ? descMatch[1].trim() : "";

        // Extract image
        const imgMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        const thumbnail = imgMatch
          ? imgMatch[1].trim()
          : "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80";

        // Extract site name / author
        const siteNameMatch = html.match(/<meta\s+property=["']og:site_name["']\s+content=["']([^"']+)["']/i);
        const authorMatch = html.match(/<meta\s+name=["']author["']\s+content=["']([^"']+)["']/i);
        const creatorName = siteNameMatch ? siteNameMatch[1].trim() : (authorMatch ? authorMatch[1].trim() : domain);

        provenance.title = { value: title, source: "html_metadata", retrievedAt: now };
        provenance.creator = { value: creatorName, source: "html_metadata", retrievedAt: now };
        provenance.thumbnail = { value: thumbnail, source: "html_metadata", retrievedAt: now };

        return {
          platform: "website",
          canonicalUrl: validation.canonicalUrl,
          contentId: validation.normalizedUrl,
          creator: {
            name: creatorName,
            handle: `@${domain}`,
            avatar: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=100&auto=format&fit=crop&q=80",
          },
          title,
          caption: description || title,
          description,
          bodyText: description,
          thumbnailUrl: thumbnail,
          contentType: "website",
          retrievedAt: now,
          isRestricted: false,
          provenance,
        };
      }
    } catch {
      // Fall through to domain fallback
    }

    return {
      platform: "website",
      canonicalUrl: validation.canonicalUrl,
      contentId: validation.normalizedUrl,
      creator: {
        name: domain,
        handle: `@${domain}`,
        avatar: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=100&auto=format&fit=crop&q=80",
      },
      title: domain,
      description: `Resource from ${domain}`,
      bodyText: "",
      thumbnailUrl: "https://images.unsplash.com/photo-1499750310107-5fef28a66643?w=800&auto=format&fit=crop&q=80",
      contentType: "website",
      retrievedAt: now,
      isRestricted: true,
      restrictionReason: "Site metadata could not be retrieved over network; domain used.",
      provenance,
    };
  }
}
