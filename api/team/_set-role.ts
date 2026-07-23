/**
 * POST /api/team/set-role
 *
 * Assigns a staff member's RBAC role. This is the working,
 * permission-checked replacement for the (never-implemented)
 * /api/auth/users/:id/role endpoint. It writes the real authorization
 * grant in `user_roles` — the table `user_has_permission` reads — not
 * just the legacy coarse `users.role` column, so it actually changes
 * what the user can do.
 *
 * Body: { user_id: uuid, role: 'admin'|'pastor'|'staff'|'volunteer' }
 *
 * Auth: requirePermission('admin.manage_roles') — only role admins.
 * Church-scoped: the target user must belong to the caller's church.
 * Audited: every change writes an audit_logs row.
 *
 * Coarse role → system role mapping (least-privilege default; elevate
 * finance/care/impact_card per-person separately):
 *   admin     → system_administrator
 *   pastor    → senior_pastor
 *   staff     → member_services
 *   volunteer → member_portal_user
 * ('member' is not managed here — members authorize via people/get_person_id().)
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const COARSE_TO_SYSTEM_ROLE: Record<string, string> = {
  admin: 'system_administrator',
  pastor: 'senior_pastor',
  staff: 'member_services',
  volunteer: 'member_portal_user',
};

const SCHEMA = {
  user_id: uuid_({ required: true }),
  role: str({ required: true, pattern: /^(admin|pastor|staff|volunteer)$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  const actor = await requirePermission(req, res, supabase, 'admin.manage_roles');
  if (!actor) return; // 401/403 already sent

  const body = readBody(req, res, SCHEMA);
  if (!body) return;
  const { user_id, role } = body;

  // Self-lockout guard: an admin cannot change their own role here (that's
  // how you accidentally strip your own admin.manage_roles). Another admin
  // must do it.
  if (user_id === actor.userId) {
    return res.status(409).json({ error: 'cannot_change_own_role', detail: 'Ask another admin to change your role.' });
  }

  // Object ownership + org scope: the target must be a user in the caller's church.
  const { data: target } = await supabase
    .from('users')
    .select('id, role, church_id')
    .eq('id', user_id!)
    .eq('church_id', actor.churchId)
    .maybeSingle();
  if (!target) return res.status(404).json({ error: 'user_not_found' });

  const systemRoleKey = COARSE_TO_SYSTEM_ROLE[role!];
  const { data: systemRole } = await supabase
    .from('roles')
    .select('id')
    .eq('key', systemRoleKey)
    .is('church_id', null)
    .maybeSingle();
  if (!systemRole) {
    return res.status(500).json({ error: 'system_role_missing', detail: `Seeded role "${systemRoleKey}" not found.` });
  }

  // Revoke the target's current active grants, then insert the new one.
  // (PostgREST has no multi-statement transaction; the revoke-then-insert
  // order means a transient failure leaves them with fewer perms, never more.)
  const { error: revokeErr } = await supabase
    .from('user_roles')
    .update({ revoked_at: new Date().toISOString() })
    .eq('user_id', user_id!)
    .eq('church_id', actor.churchId)
    .is('revoked_at', null);
  if (revokeErr) return res.status(500).json({ error: 'revoke_failed' });

  const { error: grantErr } = await supabase
    .from('user_roles')
    .insert({ church_id: actor.churchId, user_id: user_id!, role_id: systemRole.id });
  if (grantErr) return res.status(500).json({ error: 'grant_failed' });

  // Keep the legacy coarse column in sync (used for display + JWT claim).
  await supabase.from('users').update({ role }).eq('id', user_id!).eq('church_id', actor.churchId);

  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'user.role_changed',
    entityType: 'user',
    entityId: user_id!,
    before: { role: target.role },
    after: { role, system_role: systemRoleKey },
    route: '/api/team/set-role',
    method: 'POST',
  });

  return res.status(200).json({ user_id, role, system_role: systemRoleKey });
}
