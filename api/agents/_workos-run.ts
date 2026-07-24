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
import { getWorkflow } from '../_lib/agentWorkflows.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';
import { persistWorkflowFindings } from '../_lib/agentWorkflowFindings.js';

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

  const startedAt = new Date().toISOString();
  const { data: run, error: runInsertErr } = await supabase
    .from('agent_runs')
    .insert({
      church_id: actor.churchId,
      agent_key: body.agent_key,
      status: 'running',
      input: { triggered_by: actor.userId },
      started_at: startedAt,
    })
    .select()
    .single();
  if (runInsertErr || !run) return res.status(500).json({ error: 'run_create_failed' });

  try {
    const result = await workflow(supabase, actor.churchId);

    if (result.findings.length > 0) {
      await supabase.from('agent_actions').insert(
        result.findings.map(f => ({
          agent_run_id: run.id,
          church_id: actor.churchId,
          action_type: f.action_type,
          target_entity_type: f.target_entity_type,
          target_entity_id: f.target_entity_id,
          payload: f.payload,
          requires_approval: false,
          status: 'executed',
          executed_at: new Date().toISOString(),
        })),
      );
      // Additive: also persist each finding into the accountable
      // agent_findings lifecycle (independent of the agent_actions log
      // above, which is a run-history record, not a triage queue).
      await persistWorkflowFindings(supabase, actor.churchId, body.agent_key, result.findings);
    }

    const finishedAt = new Date().toISOString();
    const { data: updatedRun } = await supabase
      .from('agent_runs')
      .update({
        status: 'succeeded',
        output: { summary: result.summary, finding_count: result.findings.length },
        finished_at: finishedAt,
      })
      .eq('id', run.id)
      .select()
      .single();

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: actor.churchId,
      eventType: 'agent.run.completed',
      sourceApp: 'workos',
      actorUserId: actor.userId,
      subjectType: 'agent_run',
      subjectId: run.id,
      payload: { agent_key: body.agent_key, finding_count: result.findings.length },
    });
    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'agent_run',
      entityType: 'agent_run',
      entityId: run.id,
      after: { agent_key: body.agent_key, summary: result.summary, finding_count: result.findings.length },
      sourceApp: 'workos',
      correlationId,
      route: '/api/agents/workos-run',
      method: 'POST',
    });

    return res.status(200).json({ run: updatedRun ?? run, summary: result.summary, finding_count: result.findings.length });
  } catch (err) {
    await supabase
      .from('agent_runs')
      .update({ status: 'failed', error: err instanceof Error ? err.message : 'unknown_error', finished_at: new Date().toISOString() })
      .eq('id', run.id);
    console.error('[agents/workos-run] workflow failed', { agent_key: body.agent_key, error: err });
    return res.status(500).json({ error: 'agent_run_failed' });
  }
}
