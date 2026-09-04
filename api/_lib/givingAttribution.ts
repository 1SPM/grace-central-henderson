/**
 * Attribution guard for the public giving endpoints
 * (api/giving/_create-payment-intent.ts, _create-subscription.ts).
 *
 * Both endpoints are deliberately anonymous — donations from the public
 * /give/<slug> page have no session at all. The Members Portal's giving
 * page reuses the same endpoints, adding a client-supplied person_id so
 * the resulting gift shows up in that member's own history.
 *
 * The original guard only checked that person_id belonged to *some*
 * member of the target church — not that it belonged to the caller. An
 * anonymous request could attribute a gift (and its tax-statement
 * implications) to any member whose id it could guess or scrape from a
 * roster page. See the members-portal audit, Phase 1.
 *
 * This verifies the claimed person_id against the caller's own Clerk
 * session. A public donor never sends person_id, so never touches this
 * path; a portal member's request now needs their own bearer token to
 * self-attribute. Verification failure (missing/invalid token, church
 * mismatch, wrong person) drops attribution rather than blocking the
 * gift — the money still moves, it just isn't credited to anyone.
 */

import type { VercelRequest } from '@vercel/node';
import type { SupabaseClient } from '@supabase/supabase-js';
import { requireClerkAuth } from './auth-helper.js';

export async function verifyGivingPersonId(
  req: VercelRequest,
  supabase: SupabaseClient,
  churchId: string,
  claimedPersonId: string | null | undefined,
): Promise<string | null> {
  if (!claimedPersonId) return null;

  const auth = await requireClerkAuth(req);
  if (!auth.ok || auth.churchId !== churchId) return null;

  const { data: person } = await supabase
    .from('people')
    .select('id')
    .eq('clerk_user_id', auth.clerkUserId)
    .eq('church_id', churchId)
    .maybeSingle();

  if (!person || person.id !== claimedPersonId) return null;
  return person.id;
}
