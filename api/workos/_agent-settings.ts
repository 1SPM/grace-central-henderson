/**
 * GET  /api/workos/agent-settings  — the church's per-agent instructions/tasks.
 * PUT  /api/workos/agent-settings  — set one agent's instructions/tasks.
 *
 * The agent registry itself (name, role, description, implemented) is
 * code — api/_lib/agentRegistry.ts. This is the one thing a pastor can
 * actually configure per agent: free-text instructions and a short task
 * list. Same split as api/workos/_areas.ts: code defines the shape, this
 * table records a human decision on top of it.
 *
 * Auth: agents.view to read, agents.manage to write — same gate the
 * existing "Run now" button already uses, now pastor-only (migration 068).
 * Every write is audited.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, arrayOfStr } from '../_lib/validation.js';
import { AGENT_REGISTRY, getAgentDefinition } from '../_lib/agentRegistry.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') return getAgentSettings(req, res, supabase);
  if (req.method === 'PUT') return putAgentSettings(req, res, supabase);
  return res.status(405).json({ error: 'method_not_allowed' });
}

async function getAgentSettings(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>,
) {
  const actor = await requirePermission(req, res, supabase, 'agents.view');
  if (!actor) return;

  const { data, error } = await supabase
    .from('agent_configs')
    .select('agent_key, instructions, tasks, updated_at')
    .eq('church_id', actor.churchId);

  if (error) {
    console.error('[workos/agent-settings] read failed', error);
    return res.status(500).json({ error: 'read_failed' });
  }

  const byKey = new Map((data ?? []).map(row => [row.agent_key, row]));
  const configs = AGENT_REGISTRY.map(def => {
    const row = byKey.get(def.key);
    return {
      agent_key: def.key,
      instructions: row?.instructions ?? null,
      tasks: row?.tasks ?? [],
      updated_at: row?.updated_at ?? null,
    };
  });

  return res.status(200).json({ configs });
}

async function putAgentSettings(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>,
) {
  const actor = await requirePermission(req, res, supabase, 'agents.manage');
  if (!actor) return;

  const body = readBody(req, res, {
    agent_key: str({ required: true, max: 50 }),
    instructions: str({ max: 4000 }),
    tasks: arrayOfStr({ maxLength: 30, maxItem: 300 }),
  });
  if (!body) return;

  if (!getAgentDefinition(body.agent_key)) {
    return res.status(400).json({ error: 'unknown_agent_key' });
  }

  const { data: before } = await supabase
    .from('agent_configs')
    .select('instructions, tasks')
    .eq('church_id', actor.churchId)
    .eq('agent_key', body.agent_key)
    .maybeSingle();

  const { data: saved, error } = await supabase
    .from('agent_configs')
    .upsert(
      {
        church_id: actor.churchId,
        agent_key: body.agent_key,
        instructions: body.instructions ?? null,
        tasks: body.tasks ?? [],
        updated_by_user_id: actor.userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'church_id,agent_key' },
    )
    .select('agent_key, instructions, tasks, updated_at')
    .single();

  if (error || !saved) {
    console.error('[workos/agent-settings] write failed', error);
    return res.status(500).json({ error: 'write_failed' });
  }

  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    action: 'agent_settings_updated',
    entityType: 'agent_config',
    entityId: body.agent_key,
    before: before ?? null,
    after: { instructions: saved.instructions, tasks: saved.tasks },
  });

  return res.status(200).json({ config: saved });
}
