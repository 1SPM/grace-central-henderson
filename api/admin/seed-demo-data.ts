/**
 * POST /api/admin/seed-demo-data
 *
 * Seeds 20 sample people + 30 giving entries + 10 calendar events into
 * the caller's church. Idempotent on already-populated churches —
 * bails with skipped_reason='already_populated' if the church already
 * has 5+ people.
 *
 * Auth: admin role required (only the church owner should be able to
 * seed). Locked to the caller's own church via the auth context's
 * church_id (cannot supply via body).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';
import { seedDemoData } from '../_lib/seed/demo-data.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ROLES = ['admin', 'platform_admin'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await requireClerkAuth(req, { allowedRoles: ALLOWED_ROLES });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const result = await seedDemoData(supabase, auth.churchId);
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({
      error: 'seed_failed',
      detail: err instanceof Error ? err.message : 'unknown',
    });
  }
}
