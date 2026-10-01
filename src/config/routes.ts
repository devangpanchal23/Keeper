/**
 * Centralized Route Registry
 * Ensures all internal links (especially the product dashboard at /app) are strongly typed and unified.
 */
export const ROUTES = {
  home: "/",
  dashboard: "/app",
  library: "/app/library",
  collections: "/app/collections",
  search: "/app/search",
  settings: "/app/settings",
  signIn: "/sign-in",
  signUp: "/sign-up",
  styleguide: "/styleguide",
} as const;

export type AppRoute = typeof ROUTES[keyof typeof ROUTES];
