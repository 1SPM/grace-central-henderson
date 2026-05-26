/**
 * POST /api/agents/run
 *
 * Manual agent trigger for the operator. Runs all enabled agents for
 * the caller's church RIGHT NOW. Used by the "Run agents" button in
 * the Agent Dashboard for instant feedback during demos / debugging.
 *
 * Auth: Clerk Bearer token, role ∈ {admin, staff, pastor}. Volunteer
 * roles cannot trigger; agents create tasks and shouldn't be
 * weaponizable by lower-trust users.
 *
 * Dedup still applies — running this twice in a minute won't double
 * the observations (the runner checks agent_logs for matching
 * dedup_keys in the last 24h).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';
import { runAgentsForChurch } from '../_lib/agents/runner.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ROLES = ['admin', 'staff', 'pastor', 'platform_admin'];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'supabase not configured' });

  const auth = await requireClerkAuth(req, { allowedRoles: ALLOWED_ROLES });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  try {
    const result = await runAgentsForChurch(supabase, auth.churchId, new Date());
    return res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error('[agents/run]', err);
    return res.status(500).json({
      error: 'agent run failed',
      detail: err instanceof Error ? err.message : String(err),
    });
  }
}
