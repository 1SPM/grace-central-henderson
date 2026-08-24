/**
 * GET /api/workos/permissions
 *
 * Returns the caller's effective permission set. Used by the Admin
 * Dashboard WorkOS hub to decide which panels/actions to render — a UX
 * convenience only. Every mutation still re-checks server-side via
 * requirePermission() regardless of what this returns (see
 * SHARED_BACKEND.md "Authorization model" — never rely on hidden UI
 * elements as the actual control).
 *
 * Auth: any active staff user (no specific permission required to ask
 * "what can I do").
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveStaffActor } from '../_lib/authz.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;

  const { data: userRow } = await supabase
    .from('users')
    .select('first_name, last_name, staff_profiles(employment_type)')
    .eq('id', actor.userId)
    .maybeSingle();

  // staff_profiles.user_id is UNIQUE, so PostgREST returns the embed as a
  // to-one OBJECT — but typings and older rows can present an array (same
  // gotcha PR #135 fixed for staffDisplayName; see api/workos/_areas.ts's
  // profileTitle for the canonical explanation).
  const profile = Array.isArray(userRow?.staff_profiles) ? userRow.staff_profiles[0] : userRow?.staff_profiles;
  const employmentType = (profile as { employment_type?: string | null } | null | undefined)?.employment_type ?? null;

  return res.status(200).json({
    user_id: actor.userId,
    church_id: actor.churchId,
    permissions: Array.from(actor.permissions).sort(),
    person_id: actor.personId,
    first_name: userRow?.first_name ?? null,
    last_name: userRow?.last_name ?? null,
    // Same gate PUT /api/workos/areas already uses for "may reassign who's
    // accountable" — reusing it here instead of inventing a parallel
    // "master admin" permission keeps the two checks impossible to drift.
    is_master_admin: actor.permissions.has('admin.manage_settings'),
    // The GRACE WorkOS hub's own gate (migration 068) — Senior Pastor and
    // System Administrator only. Deliberately distinct from
    // is_master_admin: a Senior-Pastor-only account (no System
    // Administrator role) holds this without holding
    // admin.manage_settings, and must still get into WorkOS.
    has_workos_access: actor.permissions.has('workos.access'),
    // Hierarchy tier for display — derived, not a parallel authorization
    // system. "Pastor" comes from the real workos.access grant; clergy vs.
    // staff vs. volunteer comes from staff_profiles.employment_type, a
    // field that already existed for exactly this organizational
    // distinction. Never used for access control, only for the "who is
    // this person" label the WorkOS/Action Center UI shows.
    hierarchy_tier: actor.permissions.has('workos.access')
      ? 'pastor'
      : employmentType === 'clergy'
        ? 'clergy'
        : employmentType === 'volunteer'
          ? 'volunteer'
          : 'staff',
  });
}
