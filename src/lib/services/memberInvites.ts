/**
 * Member portal invitation client.
 *
 * Calls POST /api/members/invite with the Clerk session token (sourced
 * from the token provider registered in src/lib/supabase.ts, so this
 * works without pulling Clerk hooks into list components).
 */

import { getClerkTokenProvider } from '../supabase';

export interface InviteOutcome {
  invited: number;
  total: number;
  results: { person_id: string; status: 'invited' | 'skipped' | 'error'; error?: string }[];
}

export async function invitePortalMembers(personIds: string[]): Promise<InviteOutcome> {
  const provider = getClerkTokenProvider();
  const token = provider ? await provider() : null;
  if (!token) {
    throw new Error('Portal invitations require a signed-in staff account (not available in demo mode).');
  }

  const res = await fetch('/api/members/invite', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ person_ids: personIds }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(body.error || `Invitation request failed (HTTP ${res.status})`);
  }
  return body as InviteOutcome;
}
