/**
 * Enterprise-grade Supabase configuration resolver.
 * Resilient against:
 * - Empty string vs nullish values ("" vs null)
 * - Trailing/leading quotes or whitespace (e.g. from copy-pasting into Vercel UI)
 * - Multiple environment variable naming conventions (Vercel integrations, Supabase CLI, legacy)
 */

export interface SupabaseConfig {
  url: string | undefined;
  key: string | undefined;
  serviceRoleKey: string | undefined;
  isConfigured: boolean;
}

function cleanEnv(val: string | undefined): string | undefined {
  if (!val) return undefined;
  const trimmed = val.trim().replace(/^["']|["']$/g, "").trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function getSupabaseConfig(): SupabaseConfig {
  const url = cleanEnv(
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL
  );

  const key = cleanEnv(
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_ANON_KEY
  );

  const serviceRoleKey = cleanEnv(
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY
  );

  const effectiveKey = key || serviceRoleKey;
  const isConfigured = Boolean(url && effectiveKey);

  return {
    url,
    key: effectiveKey,
    serviceRoleKey,
    isConfigured,
  };
}

export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig().isConfigured;
}

