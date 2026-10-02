import { AvailableImportSource, Platform, PlatformConnection } from "@/types";

export interface OAuthStatePayload {
  userId: string;
  platform: Platform;
  nonce: string;
  createdAt: number;
}

export class OAuthSecurityService {
  /**
   * Generates a cryptographically random CSRF state nonce.
   */
  public static generateState(userId: string, platform: Platform): string {
    const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const payload: OAuthStatePayload = {
      userId,
      platform,
      nonce,
      createdAt: Date.now(),
    };
    return Buffer.from(JSON.stringify(payload)).toString("base64url");
  }

  /**
   * Validates state nonce and checks 15-minute expiration window.
   */
  public static validateState(stateStr: string, currentUserId: string): { isValid: boolean; platform?: Platform; error?: string } {
    try {
      const decoded = Buffer.from(stateStr, "base64url").toString("utf-8");
      const payload: OAuthStatePayload = JSON.parse(decoded);

      if (payload.userId !== currentUserId) {
        return { isValid: false, error: "CSRF state user mismatch" };
      }

      // 15-minute TTL
      if (Date.now() - payload.createdAt > 15 * 60 * 1000) {
        return { isValid: false, error: "OAuth authorization session expired. Please try again." };
      }

      return { isValid: true, platform: payload.platform };
    } catch {
      return { isValid: false, error: "Malformed OAuth state token" };
    }
  }

  /**
   * Demonstrates official platform API capabilities and restrictions.
   * NEVER claims an unsupported API feature is supported.
   */
  public static getPlatformCapabilities(platform: Platform): {
    canConnectOAuth: boolean;
    supportsSavedItemsViaApi: boolean;
    sources: AvailableImportSource[];
    securityNotice: string;
  } {
    if (platform === "youtube") {
      return {
        canConnectOAuth: true,
        supportsSavedItemsViaApi: true,
        securityNotice:
          "Keeper connects directly to Google OAuth using least-privilege readonly permissions (youtube.readonly). We never request or store your Google password.",
        sources: [
          {
            id: "yt-liked-videos",
            name: "Liked Videos",
            platform: "youtube",
            description: "Videos and Shorts you have liked on your YouTube account.",
            supportedVia: "official_oauth",
            isSupportedProgrammatically: true,
          },
          {
            id: "yt-my-playlists",
            name: "My Created Playlists",
            platform: "youtube",
            description: "All public, unlisted, and private playlists created on your channel.",
            supportedVia: "official_oauth",
            isSupportedProgrammatically: true,
          },
          {
            id: "yt-watch-later",
            name: "Watch Later",
            platform: "youtube",
            description:
              "Google deprecated programmatic API access to the Watch Later playlist (WL) in YouTube Data API v3. Import your Watch Later safely using Google Takeout export.",
            supportedVia: "data_export_only",
            isSupportedProgrammatically: false,
            unsupportedReason:
              "Google disabled API access to the 'WL' (Watch Later) playlist in YouTube Data API v3.",
            safeAlternative:
              "Export Watch Later via Google Takeout (takeout.google.com -> YouTube -> Playlists) and upload Watch later.csv or playlists.json.",
          },
        ],
      };
    }

    if (platform === "instagram") {
      return {
        canConnectOAuth: true,
        supportsSavedItemsViaApi: false, // Meta does NOT allow reading saved posts via API
        securityNotice:
          "Meta retired the Instagram Basic Display API on Dec 4, 2024. The official Instagram Graph API is restricted to Professional accounts and only provides access to your own published media. Meta does not permit third-party API access to your private Saved Posts or Collections.",
        sources: [
          {
            id: "ig-official-export",
            name: "Official Data Export (Saved Posts & Collections)",
            platform: "instagram",
            description:
              "Import your complete saved reels, posts, and audio collections using Instagram's official 'Download Your Information' export.",
            supportedVia: "data_export_only",
            isSupportedProgrammatically: false,
            unsupportedReason:
              "Meta restricts programmatic retrieval of private Saved Posts and Collections to protect user privacy. No official Meta API provides this endpoint.",
            safeAlternative:
              "Go to Instagram Settings -> Accounts Center -> Your information and permissions -> Download your information -> Saved posts. Upload the resulting saved_posts.json or ZIP.",
          },
          {
            id: "ig-published-media",
            name: "My Published Media (Professional/Creator Accounts)",
            platform: "instagram",
            description: "Reels and posts published by your connected Professional or Creator account.",
            supportedVia: "official_oauth",
            isSupportedProgrammatically: true,
          },
          {
            id: "ig-url-list",
            name: "Paste URL List",
            platform: "instagram",
            description: "Paste a list of Instagram Reel or Post share links to import in bulk.",
            supportedVia: "url_list",
            isSupportedProgrammatically: true,
          },
        ],
      };
    }

    return {
      canConnectOAuth: false,
      supportsSavedItemsViaApi: false,
      securityNotice: "Platform does not offer official OAuth bookmark APIs.",
      sources: [
        {
          id: `${platform}-url-list`,
          name: "URL List Import",
          platform,
          description: "Paste a list of links to import into Keeper.",
          supportedVia: "url_list",
          isSupportedProgrammatically: true,
        },
      ],
    };
  }
}
