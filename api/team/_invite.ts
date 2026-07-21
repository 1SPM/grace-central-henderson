/**
 * POST /api/team/invite
 *
 * Invite a staff member to the CRM (admin/pastor/staff/volunteer).
 * Distinct from api/members/invite, which grants congregation members
 * portal access — this grants CRM access, so only admins may call it,
 * regardless of which role is being granted.
 *
 * Flow: create a Clerk invitation carrying { church_id, role } in
 * publicMetadata + a team_invitations row for tracking/audit. On
 * acceptance (api/team/_accept-invitation.ts), Richard signs up
 * himself via Clerk's own hosted form — his password is never seen by
 * this app, only by Clerk.
 *
 * Auth: Clerk Bearer, admin role only.
 * Body: { email: string, full_name?: string, role: 'admin'|'pastor'|'staff'|'volunteer' }
 * Response: { status: 'invited' } | { status: 'skipped', reason } | 4xx/5xx
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';
import { randomBytes } from 'node:crypto';
import { requireClerkAuth } from '../_lib/auth-helper.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const APP_URL = process.env.FRONTEND_URL || process.env.VERCEL_URL
  ? (process.env.FRONTEND_URL || `https://${process.env.VERCEL_URL}`)
  : 'http://localhost:3000';

const TEAM_ROLES = ['admin', 'pastor', 'staff', 'volunteer'] as const;
type TeamRole = typeof TEAM_ROLES[number];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !CLERK_SECRET_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  // Inviting someone into the CRM is an elevated action regardless of
  // which role they're granted — only existing admins may do it.
  const auth = await requireClerkAuth(req, { allowedRoles: ['admin'] });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const fullName = typeof req.body?.full_name === 'string' ? req.body.full_name.trim().slice(0, 200) : null;
  const role = req.body?.role as string;

  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return res.status(400).json({ error: 'valid email required' });
  }
  if (!TEAM_ROLES.includes(role as TeamRole)) {
    return res.status(400).json({ error: `role must be one of: ${TEAM_ROLES.join(', ')}` });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });

  const { data: inviter } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', auth.clerkUserId)
    .maybeSingle();

  // Already a staff member at this church? Nothing to invite.
  const { data: existingUser } = await supabase
    .from('users')
    .select('id')
    .eq('church_id', auth.churchId)
    .ilike('email', email)
    .maybeSingle();
  if (existingUser) {
    return res.status(200).json({ status: 'skipped', reason: 'already_team_member' });
  }

  try {
    // Revoke any prior live invitation to this email at this church.
    await supabase
      .from('team_invitations')
      .update({ status: 'revoked' })
      .eq('church_id', auth.churchId)
      .ilike('email', email)
      .in('status', ['pending', 'sent']);

    const token = randomBytes(24).toString('base64url');

    const invitation = await clerk.invitations.createInvitation({
      emailAddress: email,
      redirectUrl: `${APP_URL}/welcome`,
      publicMetadata: {
        church_id: auth.churchId,
        role,
        grace_team_invite_token: token,
      },
      notify: true,
      ignoreExisting: true,
    });

    const { error: insertErr } = await supabase.from('team_invitations').insert({
      church_id: auth.churchId,
      email,
      full_name: fullName,
      role,
      token,
      status: 'sent',
      invited_by_user_id: inviter?.id ?? null,
      clerk_invitation_id: invitation.id,
      sent_at: new Date().toISOString(),
    });
    if (insertErr) throw new Error(insertErr.message);

    return res.status(200).json({ status: 'invited' });
  } catch (err) {
    console.error('[team/invite] failed for', email, err);
    return res.status(500).json({ error: err instanceof Error ? err.message : 'invite_failed' });
  }
}
