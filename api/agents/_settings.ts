/**
 * GET/PUT /api/agents/settings
 *
 * Per-church messaging agent config (life-event, new-member drip,
 * donation thank-you). The Rules Engine UI reads and writes the same
 * AgentConfig JSON it previously kept in localStorage; the daily
 * messaging cron (api/_lib/agents/messaging.ts) reads it server-side.
 *
 * church_agent_settings has no client UPDATE policy (service-role
 * writes only, matching migration 014), so writes go through here.
 *
 * Auth: Clerk Bearer token, role ∈ {admin, staff, pastor}.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED_ROLES = ['admin', 'staff', 'pastor', 'platform_admin'];
const KNOWN_AGENT_IDS = new Set(['life-event-agent', 'new-member-agent', 'donation-processing-agent']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'PUT') {
    return res.status(405).json({ error: 'method not allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'supabase not configured' });
  }

  const auth = await requireClerkAuth(req, { allowedRoles: ALLOWED_ROLES });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('church_agent_settings')
      .select('messaging_settings')
      .eq('church_id', auth.churchId)
      .maybeSingle();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ messaging_settings: data?.messaging_settings ?? {} });
  }

  // PUT — replace messaging_settings wholesale (the client always sends
  // the full config map, so no merge semantics needed).
  const body = req.body as { messaging_settings?: Record<string, unknown> } | undefined;
  const incoming = body?.messaging_settings;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ error: 'messaging_settings object required' });
  }
  for (const key of Object.keys(incoming)) {
    if (!KNOWN_AGENT_IDS.has(key)) {
      return res.status(400).json({ error: `unknown agent id: ${key}` });
    }
  }

  const { error: upsertErr } = await supabase
    .from('church_agent_settings')
    .upsert(
      {
        church_id: auth.churchId,
        messaging_settings: incoming,
        updated_at: new Date().toISOString(),
        updated_by_clerk_id: auth.clerkUserId,
      },
      { onConflict: 'church_id' },
    );
  if (upsertErr) return res.status(500).json({ error: upsertErr.message });

  return res.status(200).json({ ok: true });
}
