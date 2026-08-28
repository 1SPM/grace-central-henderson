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
import { actionRowForFinding, getWorkflow } from '../_lib/agentWorkflows.js';
import { isExecutableActionType } from '../_lib/agentActionExecutors.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';
import { persistWorkflowFindings } from '../_lib/agentWorkflowFindings.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const SCHEMA = {
  agent_key: str({ required: true, max: 40, pattern: /^[a-z-]+$/ }),
};

/**
 * One human-readable line for the Approval Centre and Decision Queue. A
 * pastor should be able to decide without opening the payload — an
 * approval that reads "assign_work_order_owner" is not a decision anyone
 * can make responsibly.
 */
function describeProposedAction(action: {
  action_type: string;
  target_entity_type: string | null;
  payload: Record<string, unknown>;
}): string {
  const p = action.payload ?? {};
  if (action.action_type === 'assign_work_order_owner') {
    const title = typeof p.work_order_title === 'string' ? p.work_order_title : 'an unowned Work Order';
    const owner = typeof p.owner_name === 'string' ? p.owner_name : 'the ministry owner';
    const ministry = typeof p.ministry === 'string' ? ` (${p.ministry})` : '';
    return `Assign ${owner} as owner of "${title}"${ministry}`;
  }
  const target = action.target_entity_type ? ` on ${action.target_entity_type}` : '';
  return `${action.action_type.replace(/_/g, ' ')}${target}`;
}

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
      // Still fail closed, but on a narrower and permanent condition: an
      // approval-requiring finding whose action_type has no executor
      // registered in agentActionExecutors.ts. Approving such a proposal
      // would silently do nothing, which is worse in a pastor's Decision
      // Queue than refusing at the source.
      const unexecutable = result.findings
        .filter(f => f.requires_approval && !isExecutableActionType(f.action_type))
        .map(f => f.action_type);
      if (unexecutable.length > 0) {
        throw new Error(
          `workflow '${body.agent_key}' proposed action type(s) with no executor: ${[...new Set(unexecutable)].join(', ')} — register one in agentActionExecutors.ts before proposing it`,
        );
      }

      // Observations execute immediately; an approval-requiring finding
      // is recorded as 'proposed' and never auto-executed (invariant
      // lives in actionRowForFinding + its unit tests). Note that
      // persistWorkflowFindings below is observation-only and does not
      // read requires_approval — see AgentFinding.requires_approval.
      // Observations are written in one shot. Proposals are written one at
      // a time, approval FIRST, so a partial failure can never leave a
      // 'proposed' action with no approvals row — an orphan invisible to
      // the Decision Queue is exactly the stranded-proposal problem this
      // pipeline exists to remove. Ordering it this way makes the worst
      // case a pending approval pointing at an action that was never
      // written, which the decide endpoint treats as a no-op.
      const observations = result.findings.filter(f => !f.requires_approval);
      const proposals = result.findings.filter(f => f.requires_approval);

      if (observations.length > 0) {
        const { error: obsErr } = await supabase.from('agent_actions').insert(
          observations.map(f => ({
            agent_run_id: run.id,
            church_id: actor.churchId,
            ...actionRowForFinding(f, new Date()),
          })),
        );
        if (obsErr) throw new Error(`agent_actions insert failed: ${obsErr.message}`);
      }

      for (const finding of proposals) {
        const row = actionRowForFinding(finding, new Date());
        const { data: approval, error: approvalErr } = await supabase
          .from('approvals')
          .insert({
            church_id: actor.churchId,
            entity_type: 'agent_action',
            entity_id: null, // set once the action row exists
            proposed_action: describeProposedAction({
              action_type: finding.action_type,
              target_entity_type: finding.target_entity_type,
              payload: finding.payload,
            }),
            requested_by_agent: body.agent_key,
            affected_resources: finding.target_entity_id
              ? [{ type: finding.target_entity_type, id: finding.target_entity_id }]
              : [],
            supporting_evidence: [{ agent_run_id: run.id, payload: finding.payload }],
            risk_level: 'low',
          })
          .select()
          .single();
        if (approvalErr || !approval) {
          throw new Error(`approval creation failed: ${approvalErr?.message ?? 'no row'}`);
        }

        const { data: action, error: actionErr } = await supabase
          .from('agent_actions')
          .insert({
            agent_run_id: run.id,
            church_id: actor.churchId,
            ...row,
            approval_id: approval.id,
          })
          .select('id')
          .single();
        if (actionErr || !action) {
          throw new Error(`agent_actions insert failed: ${actionErr?.message ?? 'no row'}`);
        }

        const { error: linkErr } = await supabase
          .from('approvals')
          .update({ entity_id: action.id })
          .eq('id', approval.id)
          .eq('church_id', actor.churchId);
        if (linkErr) {
          throw new Error(`approval link failed for action ${action.id}: ${linkErr.message}`);
        }
      }

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
