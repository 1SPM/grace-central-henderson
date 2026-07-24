/**
 * Resolves which church an unauthenticated, public request belongs to,
 * from the request's own Host header — never from client-supplied
 * input. Vercel routes by domain/SNI, so a caller can't make this
 * resolve to a church other than the one whose real domain they're
 * actually connecting to.
 *
 * Checks the known shared/demo hosts first (HOST_CHURCH_IDS, also used
 * by the demo-mode bypass in authz.ts), then falls back to a church's
 * own custom domain via churches.hosts for white-label deployments —
 * same lookup api/tenant/_config.ts already does for cosmetic branding.
 *
 * Used by public-intake routes (e.g. connect-card) that need to know
 * "which church is this form for" without trusting the client to say so.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { HOST_CHURCH_IDS } from './authz.js';

export async function resolveChurchIdForHost(
  host: string | undefined,
  supabase: SupabaseClient,
): Promise<string | null> {
  if (!host) return null;
  if (HOST_CHURCH_IDS[host]) return HOST_CHURCH_IDS[host];

  const { data } = await supabase
    .from('churches')
    .select('id')
    .contains('hosts', [host])
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}
