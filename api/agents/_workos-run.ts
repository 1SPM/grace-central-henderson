/**
 * POST /api/agents/workos-run
 * Body: { agent_key: string }
 *
 * Triggers a real, synchronous, server-side agent workflow (see
 * api/_lib/agentWorkflows.ts). Writes one agent_runs row and one
 * agent_actions row per finding. Returns 501 for a registered-but-not-
 * implemented agent — never fabricates a run.
 *
 * Auth: Clerk Bearer (or demo bootstrap), agents.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { getAgentDefinition } from '../_lib/agentRegistry.js';
import { runWorkosAgentForChurch } from '../_lib/workosAgentRunner.js';
import { getWorkflow } from '../_lib/agentWorkflows.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  agent_key: str({ required: true, max: 40, pattern: /^[a-z-]+$/ }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'agents.manage');
  if (!actor) return;

  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  const definition = getAgentDefinition(body.agent_key);
  if (!definition) return res.status(404).json({ error: 'unknown_agent' });

  const workflow = getWorkflow(body.agent_key);
  if (!workflow || !definition.implemented) {
    return res.status(501).json({ error: 'agent_not_implemented', agent_key: body.agent_key });
  }

  // The run itself is the shared path (api/_lib/workosAgentRunner.ts) so
  // this endpoint and the nightly cron can never diverge on what a run
  // writes. What stays here is what is genuinely specific to a human
  // request: the permission gate above, and the actor-attributed audit
  // trail below.
  const outcome = await runWorkosAgentForChurch(
    supabase,
    actor.churchId,
    body.agent_key,
    { kind: 'user', userId: actor.userId },
  );

  if (outcome.status === 'failed') {
    if (outcome.error === 'run_create_failed') return res.status(500).json({ error: 'run_create_failed' });
    console.error('[agents/workos-run] workflow failed', { agent_key: body.agent_key, error: outcome.error });
    return res.status(500).json({ error: 'agent_run_failed' });
  }

  // The run and its rows are already committed. Attribution must not be
  // able to undo that: a failed event/audit write is logged, not turned
  // into a 500 that tells the operator their successful run failed.
  // (Previously this sat inside the run's try/catch, so an event failure
  // marked the whole run 'failed' — the opposite of the truth.)
  try {
    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'agent.run.completed',
      sourceApp: 'workos',
      actorUserId: actor.userId,
      subjectType: 'agent_run',
      subjectId: outcome.runId!,
      payload: { agent_key: body.agent_key, finding_count: outcome.findingCount ?? 0 },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'agent_run',
      entityType: 'agent_run',
      entityId: outcome.runId!,
      after: { agent_key: body.agent_key, summary: outcome.summary, finding_count: outcome.findingCount ?? 0 },
      sourceApp: 'workos',
      correlationId,
      route: '/api/agents/workos-run',
      method: 'POST',
    });
  } catch (err) {
    console.error('[agents/workos-run] attribution write failed', { agent_key: body.agent_key, run_id: outcome.runId, err });
  }

  return res.status(200).json({
    run: { id: outcome.runId, agent_key: body.agent_key, status: 'succeeded' },
    summary: outcome.summary,
    finding_count: outcome.findingCount ?? 0,
  });
}
