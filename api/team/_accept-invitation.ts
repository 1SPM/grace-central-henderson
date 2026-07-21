/**
 * POST /api/team/accept-invitation
 *
 * Redeems a staff invitation token for the signed-in Clerk user:
 *   1. validates the token (live, unexpired, same church)
 *   2. upserts a users row with the invited role
 *   3. writes church_id + role to Clerk publicMetadata so the next JWT
 *      carries the claims requireClerkAuth reads
 *   4. marks the invitation accepted
 *
 * The invitee authenticates entirely through Clerk's own sign-up UI
 * before this call — their password is never sent to or stored by
 * this endpoint.
 *
 * Auth: Clerk Bearer. A freshly-invited user's JWT may not yet carry
 * the church_id claim (set during this call), so we verify the raw
 * token instead of requiring the tenant claim.
 *
 * Body: { token: string }
 * Response: { church_id, role }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient, verifyToken } from '@clerk/backend';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !CLERK_SECRET_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const authHeader = req.headers.authorization || '';
  const bearer = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!bearer) return res.status(401).json({ error: 'auth_required' });

  let clerkUserId: string;
  try {
    const payload = await verifyToken(bearer, { secretKey: CLERK_SECRET_KEY });
    clerkUserId = payload.sub;
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }

  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token || token.length > 200) return res.status(400).json({ error: 'token required' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const { data: invitation, error: invErr } = await supabase
    .from('team_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (invErr) return res.status(500).json({ error: 'invitation_read_failed' });
  if (!invitation) return res.status(404).json({ error: 'invitation_not_found' });

  if (!['pending', 'sent'].includes(invitation.status as string)) {
    return res.status(410).json({ error: `invitation_${invitation.status}` });
  }
  if (new Date(invitation.expires_at as string) < new Date()) {
    await supabase.from('team_invitations').update({ status: 'expired' }).eq('id', invitation.id);
    return res.status(410).json({ error: 'invitation_expired' });
  }

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const clerkUser = await clerk.users.getUser(clerkUserId);
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? invitation.email;

  const { error: upsertErr } = await supabase.from('users').upsert(
    {
      clerk_id: clerkUserId,
      email,
      name: invitation.full_name ?? clerkUser.firstName ?? null,
      role: invitation.role,
      church_id: invitation.church_id,
    },
    { onConflict: 'clerk_id' },
  );
  if (upsertErr) return res.status(500).json({ error: 'user_upsert_failed' });

  try {
    await clerk.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        ...(clerkUser.publicMetadata ?? {}),
        church_id: invitation.church_id,
        role: invitation.role,
      },
    });
  } catch (err) {
    // Metadata write is best-effort; the users row is authoritative and
    // the JWT template can fall back to it on next refresh.
    console.warn('[team/accept-invitation] clerk metadata write failed', err);
  }

  await supabase
    .from('team_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  return res.status(200).json({ church_id: invitation.church_id, role: invitation.role });
}
