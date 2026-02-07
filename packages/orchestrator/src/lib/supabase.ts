/**
 * Shared Supabase client singletons for the orchestrator package.
 *
 * Two clients are provided:
 * - `supabaseClient` — uses the anon key (for DB reads, auth verification)
 * - `supabaseServiceClient` — uses the service role key (for storage uploads, bypasses RLS)
 *
 * Both are `null` when the corresponding env vars are missing (e.g., in tests).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Support NEXT_PUBLIC_ prefix fallbacks (used by auth middleware in shared environments)
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Standard client using anon key.
 * Suitable for: DB queries, auth.getUser(), RLS-governed reads.
 */
export const supabaseClient: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

/**
 * Service-role client (bypasses RLS).
 * Suitable for: storage uploads, server-side writes.
 * Falls back to anon key if service role key is unavailable.
 */
export const supabaseServiceClient: SupabaseClient | null =
  url && (serviceKey || anonKey)
    ? createClient(url, serviceKey || anonKey!)
    : null;
