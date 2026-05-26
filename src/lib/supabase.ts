/**
 * Supabase client with optional Clerk-issued JWT.
 *
 * The client is created with the anon key as the baseline. When a Clerk
 * token provider is registered (via setClerkTokenProvider), every request
 * is sent with `Authorization: Bearer <clerk-token>` instead of the anon
 * key's default authorization. PostgREST then sees `auth.jwt()` populated
 * with the Clerk session claims — which is the prerequisite for the
 * church-scoped RLS policies Sprint 1 will ship.
 *
 * REQUIRED Supabase dashboard setup before scoped RLS works:
 *   1. Dashboard → Authentication → Third-Party Auth → Add provider → Clerk
 *   2. Paste your Clerk Frontend API URL (e.g., https://xxxx.clerk.accounts.dev)
 *   3. Configure a Clerk JWT template (Clerk dashboard → JWT Templates → new):
 *      - Name: `supabase`
 *      - Claims include `app_metadata.church_id` so RLS can read it via
 *        `auth.jwt() -> 'app_metadata' ->> 'church_id'`
 *
 * Until both of these land, the registered provider returns a token that
 * Supabase will accept and forward to PostgREST, but `auth.jwt()` will
 * carry whatever claims Clerk currently issues — `church_id` may be null.
 *
 * Without a registered provider, the client behaves exactly as before
 * (anon-key reads, fully governed by the permissive RLS in migration 005).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';

const log = createLogger('supabase');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  log.warn('Missing Supabase environment variables. Running in demo mode with sample data.');
}

// ---- Clerk token wiring ------------------------------------------------

type TokenProvider = () => Promise<string | null>;

let clerkTokenProvider: TokenProvider | null = null;

export function setClerkTokenProvider(provider: TokenProvider | null): void {
  clerkTokenProvider = provider;
}

export function getClerkTokenProvider(): TokenProvider | null {
  return clerkTokenProvider;
}

/**
 * Custom fetch that injects the Clerk JWT on the way out.
 * Falls back to whatever Authorization header Supabase set by default
 * (the anon key) when no provider is registered or the provider errors.
 */
export async function clerkAwareFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  if (!clerkTokenProvider) {
    return fetch(input, init);
  }
  let token: string | null = null;
  try {
    token = await clerkTokenProvider();
  } catch (err) {
    log.warn('Clerk token provider threw; falling back to anon key', err);
  }
  if (!token) {
    return fetch(input, init);
  }
  const headers = new Headers(init?.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);
  // PostgREST still requires the apikey header even when Authorization is set.
  if (supabaseAnonKey) headers.set('apikey', supabaseAnonKey);
  return fetch(input, { ...init, headers });
}

// ---- Client ------------------------------------------------------------

export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, {
      global: { fetch: clerkAwareFetch },
    })
  : null;

export const isSupabaseConfigured = () => !!supabase;
