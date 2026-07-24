/**
 * GET /api/agents/workos-registry
 *
 * The Agent Command Centre's data source: the static registry (name,
 * role, description, implemented) merged with each agent's most recent
 * real agent_runs row for this church, if any. Agents with zero runs
 * show status "not_yet_run" — never a fabricated "active" state.
 *
 * Auth: Clerk Bearer (or demo bootstrap), agents.view.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { AGENT_REGISTRY } from '../_lib/agentRegistry.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'agents.view');
  if (!actor) return;

  const { data: runs, error } = await supabase
    .from('agent_runs')
    .select('id, agent_key, status, started_at, finished_at, created_at, output, error, work_order_id')
    .eq('church_id', actor.churchId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return res.status(500).json({ error: 'read_failed' });

  const latestByAgent = new Map<string, (typeof runs)[number]>();
  const runCountByAgent = new Map<string, number>();
  for (const run of runs ?? []) {
    runCountByAgent.set(run.agent_key, (runCountByAgent.get(run.agent_key) ?? 0) + 1);
    if (!latestByAgent.has(run.agent_key)) latestByAgent.set(run.agent_key, run);
  }

  const agents = AGENT_REGISTRY.map(def => {
    const latest = latestByAgent.get(def.key);
    return {
      ...def,
      latest_run: latest ?? null,
      run_count_last_200: runCountByAgent.get(def.key) ?? 0,
      status: !def.implemented ? 'not_implemented' : latest ? latest.status : 'not_yet_run',
    };
  });

  return res.status(200).json({ agents });
}
