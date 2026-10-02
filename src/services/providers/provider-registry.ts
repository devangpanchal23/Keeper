import { Platform } from "@/types";
import { ContentProvider } from "./content-provider.interface";
import { YouTubeProvider } from "./youtube-provider";
import { InstagramProvider } from "./instagram-provider";
import { RedditProvider } from "./reddit-provider";
import { XProvider } from "./x-provider";
import { LinkedInProvider } from "./linkedin-provider";
import { GenericWebsiteProvider } from "./generic-provider";

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: ContentProvider[] = [];
  private fallbackProvider: ContentProvider;

  private constructor() {
    this.fallbackProvider = new GenericWebsiteProvider();
    // Register default platform providers in order of specificity
    this.registerProvider(new YouTubeProvider());
    this.registerProvider(new InstagramProvider());
    this.registerProvider(new RedditProvider());
    this.registerProvider(new XProvider());
    this.registerProvider(new LinkedInProvider());
  }

  public static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  public static getProviderForUrl(url: string): ContentProvider {
    return ProviderRegistry.getInstance().getProviderForUrl(url);
  }

  public static identifyPlatform(url: string): Platform {
    return ProviderRegistry.getInstance().identifyPlatform(url);
  }

  /**
   * Registers a new platform provider. Newer or more specific providers are prepended.
   */
  public registerProvider(provider: ContentProvider): void {
    // Avoid duplicate provider registrations for the same platform
    this.providers = [provider, ...this.providers.filter((p) => p.platform !== provider.platform)];
  }

  /**
   * Finds the appropriate provider for the given URL.
   */
  public getProviderForUrl(url: string): ContentProvider {
    if (!url || typeof url !== "string") return this.fallbackProvider;
    const matched = this.providers.find((p) => p.canHandle(url));
    return matched || this.fallbackProvider;
  }

  /**
   * Identifies the platform of a URL.
   */
  public identifyPlatform(url: string): Platform {
    const provider = this.getProviderForUrl(url);
    if (provider.platform === "youtube") {
      return /youtube\.com\/shorts\//i.test(url) ? "youtube-shorts" : "youtube";
    }
    return provider.platform;
  }

  /**
   * Returns all registered providers.
   */
  public getAllProviders(): ContentProvider[] {
    return [...this.providers, this.fallbackProvider];
  }
}
