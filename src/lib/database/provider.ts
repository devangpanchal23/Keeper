import "server-only";

export type DatabaseProvider = "supabase" | "postgres" | "mongodb";

export function getDatabaseProvider(): DatabaseProvider {
  const value = process.env.DATABASE_PROVIDER?.trim().toLowerCase() || "supabase";
  if (value === "supabase" || value === "postgres" || value === "mongodb") return value;
  throw new Error("DATABASE_PROVIDER must be supabase, postgres, or mongodb.");
}

export function assertBackendConfiguration(provider = getDatabaseProvider()): void {
  if (provider === "postgres" && !process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required when DATABASE_PROVIDER=postgres.");
  }
  if (provider === "mongodb" && !process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is required when DATABASE_PROVIDER=mongodb.");
  }
}
