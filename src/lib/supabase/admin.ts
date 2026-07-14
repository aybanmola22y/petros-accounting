import dns from "node:dns";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

// Prefer IPv4 when resolving hostnames. On networks with broken/partial IPv6,
// Node's fetch (undici) can otherwise hang on the AAAA record and surface as
// an intermittent "TypeError: fetch failed".
try {
  dns.setDefaultResultOrder("ipv4first");
} catch {
  // Older Node runtimes may not support this — safe to ignore.
}

/**
 * Wraps fetch with a few retries so a single transient network failure
 * (e.g. "fetch failed") doesn't bubble up to the user as a 500. Only
 * network-level throws are retried; real HTTP error responses pass through.
 */
const fetchWithRetry: typeof fetch = async (input, init) => {
  const maxRetries = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
      }
    }
  }
  throw lastError;
};

/** Server-only Supabase client (bypasses RLS). Never import in Client Components. */
export function createSupabaseAdminClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = getSupabaseServiceRoleKey();
  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase admin client requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: fetchWithRetry,
    },
  });
}
