/**
 * POST /api/members/accept-invitation
 *
 * Redeems a portal invitation token for the signed-in Clerk user:
 *   1. validates the token (live, unexpired, same church)
 *   2. binds people.clerk_user_id to the caller
 *   3. upserts a users row with role 'member'
 *   4. marks the invitation accepted
 *
 * Auth: Clerk Bearer. Note: a freshly-invited member's JWT may not yet
 * carry the church_id claim (it's set during this call), so we verify
 * the raw token instead of requiring the tenant claim.
 *
 * Body: { token: string }
 * Response: { person } — the bound people row
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
    .from('member_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (invErr) return res.status(500).json({ error: 'invitation_read_failed' });
  if (!invitation) return res.status(404).json({ error: 'invitation_not_found' });

  if (!['pending', 'sent'].includes(invitation.status as string)) {
    return res.status(410).json({ error: `invitation_${invitation.status}` });
  }
  if (new Date(invitation.expires_at as string) < new Date()) {
    await supabase.from('member_invitations').update({ status: 'expired' }).eq('id', invitation.id);
    return res.status(410).json({ error: 'invitation_expired' });
  }

  // Guard: this Clerk user must not already be bound to a different person.
  const { data: existingLink } = await supabase
    .from('people')
    .select('id')
    .eq('clerk_user_id', clerkUserId)
    .maybeSingle();
  if (existingLink && existingLink.id !== invitation.person_id) {
    return res.status(409).json({ error: 'account_already_linked' });
  }

  // Bind the person.
  const { data: person, error: bindErr } = await supabase
    .from('people')
    .update({
      clerk_user_id: clerkUserId,
      portal_enabled: true,
      portal_last_seen_at: new Date().toISOString(),
    })
    .eq('id', invitation.person_id)
    .eq('church_id', invitation.church_id)
    .select()
    .single();
  if (bindErr || !person) return res.status(500).json({ error: 'binding_failed' });

  // Upsert the member's users row + Clerk metadata so future JWTs carry
  // the church scope and member role.
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  try {
    const clerkUser = await clerk.users.getUser(clerkUserId);
    const email = clerkUser.emailAddresses[0]?.emailAddress ?? invitation.email;
    await supabase.from('users').upsert(
      {
        clerk_id: clerkUserId,
        email,
        first_name: person.first_name,
        last_name: person.last_name,
        role: 'member',
        church_id: invitation.church_id,
      },
      { onConflict: 'clerk_id' },
    );
    await clerk.users.updateUserMetadata(clerkUserId, {
      publicMetadata: {
        ...(clerkUser.publicMetadata ?? {}),
        church_id: invitation.church_id,
        role: 'member',
        person_id: person.id,
      },
    });
  } catch (err) {
    // Metadata writes are best-effort; the people binding is authoritative.
    console.warn('[members/accept-invitation] clerk metadata write failed', err);
  }

  await supabase
    .from('member_invitations')
    .update({ status: 'accepted', accepted_at: new Date().toISOString() })
    .eq('id', invitation.id);

  return res.status(200).json({ person });
}
