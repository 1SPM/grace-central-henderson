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

  return res.status(200).json({
    user_id: actor.userId,
    church_id: actor.churchId,
    permissions: Array.from(actor.permissions).sort(),
  });
}
