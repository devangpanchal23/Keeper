/**
 * Sanitized Production Test Fixtures for Instagram Data Exports
 *
 * All identifiers, URLs, and creator handles are sanitized synthetic test data.
 * No real personal data, private tokens, cookies, or real account credentials are used.
 */

// 1. Saved posts with string_map_data (Legacy Instagram format)
export const FIXTURE_SAVED_POSTS_STRING_MAP = JSON.stringify({
  saved_saved_media: [
    {
      title: "photographer_art",
      string_map_data: {
        "Saved on": {
          href: "https://www.instagram.com/p/C3x90ZaLkPq/",
          timestamp: 1708700000,
        },
      },
    },
    {
      title: "nature_daily",
      string_map_data: {
        "Saved on": {
          href: "https://www.instagram.com/p/C4y81MbKqRs/",
          timestamp: 1708786400,
        },
      },
    },
  ],
});

// 2. Saved reels with string_list_data (Newer Accounts Center format)
export const FIXTURE_SAVED_REELS_STRING_LIST = JSON.stringify({
  saved_saved_media: [
    {
      title: "motion_designer",
      string_list_data: [
        {
          href: "https://www.instagram.com/reel/C5z92NcLrSt/",
          timestamp: 1708872800,
        },
      ],
    },
    {
      title: "code_snippets",
      string_list_data: [
        {
          href: "https://www.instagram.com/reel/C6a03OdMsTu/",
          timestamp: 1708959200,
        },
      ],
    },
  ],
});

// 3. Saved collections with multiple named collections
export const FIXTURE_MULTIPLE_COLLECTIONS = JSON.stringify({
  saved_collections: [
    {
      title: "UI Inspiration",
      media: [
        {
          title: "design_system_weekly",
          string_map_data: {
            "Saved on": {
              href: "https://www.instagram.com/p/C3x90ZaLkPq/",
              timestamp: 1708700000,
            },
          },
        },
        {
          title: "interaction_lab",
          string_map_data: {
            "Saved on": {
              href: "https://www.instagram.com/reel/C7b14PeNtUv/",
              timestamp: 1708705000,
            },
          },
        },
      ],
    },
    {
      title: "Architecture & Interiors",
      media: [
        {
          title: "minimal_spaces",
          string_map_data: {
            "Saved on": {
              href: "https://www.instagram.com/p/C8c25QfOuVw/",
              timestamp: 1708800000,
            },
          },
        },
      ],
    },
    {
      title: "Recipes & Cooking",
      media: [
        {
          title: "chef_craft",
          string_map_data: {
            "Saved on": {
              href: "https://www.instagram.com/reel/C9d36RgPvWx/",
              timestamp: 1708900000,
            },
          },
        },
      ],
    },
  ],
});

// 4. Flat list without collection grouping
export const FIXTURE_NO_COLLECTIONS_FLAT = JSON.stringify([
  {
    href: "https://www.instagram.com/p/C1a2b3c4d5e/",
    title: "Post One",
    timestamp: 1708100000,
  },
  {
    href: "https://www.instagram.com/reel/C2b3c4d5e6f/",
    title: "Reel Two",
    timestamp: 1708200000,
  },
]);

// 5. Export with internal duplicate URLs across different collections
export const FIXTURE_WITH_DUPLICATE_URLS = JSON.stringify({
  saved_collections: [
    {
      title: "Design",
      media: [
        {
          title: "Duplicated Post",
          string_map_data: {
            "Saved on": {
              href: "https://www.instagram.com/p/C3x90ZaLkPq/",
              timestamp: 1708700000,
            },
          },
        },
      ],
    },
    {
      title: "Favorites",
      media: [
        {
          title: "Duplicated Post in Another Collection",
          string_map_data: {
            "Saved on": {
              href: "https://www.instagram.com/p/C3x90ZaLkPq/",
              timestamp: 1708700000,
            },
          },
        },
      ],
    },
  ],
});

// 6. Export with invalid URLs (invalid domain, non-instagram, bad schemes)
export const FIXTURE_WITH_INVALID_URLS = JSON.stringify({
  saved_saved_media: [
    {
      title: "Valid Post",
      string_map_data: {
        "Saved on": {
          href: "https://www.instagram.com/p/C3x90ZaLkPq/",
          timestamp: 1708700000,
        },
      },
    },
    {
      title: "Invalid Scheme",
      string_map_data: {
        "Saved on": {
          href: "ftp://www.instagram.com/p/invalid/",
          timestamp: 1708700000,
        },
      },
    },
    {
      title: "Invalid Path (Not a post or reel)",
      string_map_data: {
        "Saved on": {
          href: "https://www.instagram.com/about/us/",
          timestamp: 1708700000,
        },
      },
    },
  ],
});

// 7. Missing URLs in records
export const FIXTURE_MISSING_URLS = JSON.stringify({
  saved_saved_media: [
    {
      title: "Empty record without map data",
    },
    {
      title: "Record with null href",
      string_map_data: {
        "Saved on": {
          href: null,
          timestamp: 1708700000,
        },
      },
    },
    {
      title: "Valid record alongside missing ones",
      string_map_data: {
        "Saved on": {
          href: "https://www.instagram.com/p/C4y81MbKqRs/",
          timestamp: 1708700000,
        },
      },
    },
  ],
});

// 8. Malformed JSON string
export const FIXTURE_MALFORMED_JSON = `{"saved_saved_media": [{"title": "Broken", "string_map_data": {`;

// 9. Completely unexpected schema (e.g. general settings JSON or unrelated file)
export const FIXTURE_UNEXPECTED_SCHEMA = JSON.stringify({
  app_version: "2.1.0",
  user_preferences: {
    dark_mode: true,
    language: "en-US",
  },
  device_info: {
    model: "MacBookPro",
  },
});

// 10. Large candidate set generator for stress testing
export function generateLargeCandidateSet(count: number = 250): string {
  const items = [];
  for (let i = 0; i < count; i++) {
    // Generate valid looking synthetic shortcode
    const shortcode = `MockPost${i.toString().padStart(6, "0")}`;
    items.push({
      title: `creator_${i}`,
      string_map_data: {
        "Saved on": {
          href: `https://www.instagram.com/p/${shortcode}/`,
          timestamp: 1700000000 + i * 3600,
        },
      },
    });
  }

  return JSON.stringify({
    saved_saved_media: items,
  });
}

// 11. Nested export structure with Accounts Center attachments style
export const FIXTURE_NESTED_ACCOUNTS_CENTER = JSON.stringify({
  activity_saved: {
    collections_data: [
      {
        name: "Design Engineering",
        items_list: [
          {
            uri: "https://www.instagram.com/reel/DEfg12345/",
            creation_timestamp: 1710000000,
            caption: "CSS Grid Fluid Layouts",
          },
        ],
      },
    ],
  },
});
