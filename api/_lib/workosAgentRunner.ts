/**
 * Shared execution path for the WorkOS agent workflows.
 *
 * Two callers drive the same five workflows: a human clicking "Run now"
 * (api/agents/_workos-run.ts) and the nightly cron
 * (api/cron/_workos-agents.ts). They must not drift — the whole point of
 * "one brain" is that the same action produces the same rows and the same
 * audit trail regardless of which door it came through. So the run
 * mechanics live here, and each caller supplies only what is genuinely
 * different: who triggered it, and how failures are surfaced.
 *
 * What is deliberately NOT here: authorization. The HTTP endpoint gates on
 * `agents.manage`; the cron gates on CRON_SECRET. Those are different
 * questions with different answers, and folding them together would make
 * it easy to accidentally grant one lane the other's reach.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { AGENT_REGISTRY } from './agentRegistry.js';
import { actionRowForFinding, getWorkflow, type AgentFinding } from './agentWorkflows.js';
import { isExecutableActionType } from './agentActionExecutors.js';
import { persistWorkflowFindings } from './agentWorkflowFindings.js';
import { emitPlatformEvent } from './platformEvents.js';

export interface WorkosAgentRunOutcome {
  agentKey: string;
  runId: string | null;
  status: 'succeeded' | 'failed';
  summary?: string;
  findingCount?: number;
  error?: string;
}

/**
 * Write a run's findings: observations as executed rows, proposals as
 * 'proposed' rows carried to a human by a linked approvals row.
 *
 * This lives here, not in the HTTP endpoint, because BOTH lanes must do it
 * identically. When it lived only in the endpoint, the cron lane silently
 * had a different (and by then stale) rule — a divergence that only shows
 * up at 06:30 when nobody is watching.
 */
async function writeFindings(
  supabase: SupabaseClient,
  churchId: string,
  agentKey: string,
  runId: string,
  findings: AgentFinding[],
  now: Date,
): Promise<void> {
  // Fail closed on a permanent condition: an approval-requiring finding
  // whose action_type has no executor registered in
  // agentActionExecutors.ts. Approving such a proposal would silently do
  // nothing, which is worse in a pastor's Decision Queue than refusing at
  // the source.
  const unexecutable = findings
    .filter(f => f.requires_approval && !isExecutableActionType(f.action_type))
    .map(f => f.action_type);
  if (unexecutable.length > 0) {
    throw new Error(
      `workflow '${agentKey}' proposed action type(s) with no executor: ${[...new Set(unexecutable)].join(', ')} — register one in agentActionExecutors.ts before proposing it`,
    );
  }

  // Observations are written in one shot. Proposals are written one at a
  // time, approval FIRST, so a partial failure can never leave a
  // 'proposed' action with no approvals row — an orphan invisible to the
  // Decision Queue is the stranded-proposal problem this pipeline exists
  // to remove.
  const observations = findings.filter(f => !f.requires_approval);
  const proposals = findings.filter(f => f.requires_approval);

  if (observations.length > 0) {
    const { error } = await supabase.from('agent_actions').insert(
      observations.map(f => ({
        agent_run_id: runId,
        church_id: churchId,
        ...actionRowForFinding(f, now),
      })),
    );
    if (error) throw new Error(`agent_actions insert failed: ${error.message}`);
  }

  for (const finding of proposals) {
    const row = actionRowForFinding(finding, now);
    const { data: approval, error: approvalErr } = await supabase
      .from('approvals')
      .insert({
        church_id: churchId,
        entity_type: 'agent_action',
        entity_id: null, // set once the action row exists
        proposed_action: describeProposedAction(finding),
        requested_by_agent: agentKey,
        affected_resources: finding.target_entity_id
          ? [{ type: finding.target_entity_type, id: finding.target_entity_id }]
          : [],
        supporting_evidence: [{ agent_run_id: runId, payload: finding.payload }],
        risk_level: 'low',
      })
      .select()
      .single();
    if (approvalErr || !approval) {
      throw new Error(`approval creation failed: ${approvalErr?.message ?? 'no row'}`);
    }

    const { data: action, error: actionErr } = await supabase
      .from('agent_actions')
      .insert({ agent_run_id: runId, church_id: churchId, ...row, approval_id: approval.id })
      .select('id')
      .single();
    if (actionErr || !action) {
      throw new Error(`agent_actions insert failed: ${actionErr?.message ?? 'no row'}`);
    }

    const { error: linkErr } = await supabase
      .from('approvals')
      .update({ entity_id: action.id })
      .eq('id', approval.id)
      .eq('church_id', churchId);
    if (linkErr) throw new Error(`approval link failed for action ${action.id}: ${linkErr.message}`);
  }
}

/**
 * One human-readable line for the Approval Centre and Decision Queue. A
 * pastor should be able to decide without opening the payload — an
 * approval that reads "assign_work_order_owner" is not a decision anyone
 * can make responsibly.
 */
export function describeProposedAction(finding: {
  action_type: string;
  target_entity_type: string | null;
  payload: Record<string, unknown>;
}): string {
  const p = finding.payload ?? {};
  if (finding.action_type === 'assign_work_order_owner') {
    const title = typeof p.work_order_title === 'string' ? p.work_order_title : 'an unowned Work Order';
    const owner = typeof p.owner_name === 'string' ? p.owner_name : 'the ministry owner';
    const ministry = typeof p.ministry === 'string' ? ` (${p.ministry})` : '';
    return `Assign ${owner} as owner of "${title}"${ministry}`;
  }
  const target = finding.target_entity_type ? ` on ${finding.target_entity_type}` : '';
  return `${finding.action_type.replace(/_/g, ' ')}${target}`;
}

/** Every registry agent that has a runnable workflow. */
export function implementedAgentKeys(): string[] {
  return AGENT_REGISTRY.filter(a => a.implemented && getWorkflow(a.key)).map(a => a.key);
}

/**
 * Run one agent for one church, recording a real agent_runs row either way.
 *
 * `triggeredBy` is written into the run's `input` so history distinguishes
 * a scheduled sweep from a person clicking the button — the same run table
 * serves both, and "who set this off" is the first question anyone asks of
 * an agent's output.
 */
export async function runWorkosAgentForChurch(
  supabase: SupabaseClient,
  churchId: string,
  agentKey: string,
  triggeredBy: { kind: 'user'; userId: string } | { kind: 'cron' },
  now: Date = new Date(),
): Promise<WorkosAgentRunOutcome> {
  const workflow = getWorkflow(agentKey);
  if (!workflow) {
    return { agentKey, runId: null, status: 'failed', error: 'agent_not_implemented' };
  }

  const { data: run, error: runInsertErr } = await supabase
    .from('agent_runs')
    .insert({
      church_id: churchId,
      agent_key: agentKey,
      status: 'running',
      input: triggeredBy.kind === 'user'
        ? { triggered_by: triggeredBy.userId }
        : { triggered_by: 'cron' },
      started_at: now.toISOString(),
    })
    .select()
    .single();
  if (runInsertErr || !run) {
    return { agentKey, runId: null, status: 'failed', error: 'run_create_failed' };
  }

  try {
    const result = await workflow(supabase, churchId);

    if (result.findings.length > 0) {
      await writeFindings(supabase, churchId, agentKey, run.id, result.findings, now);
      await persistWorkflowFindings(supabase, churchId, agentKey, result.findings);
    }

    const { data: updated } = await supabase
      .from('agent_runs')
      .update({
        status: 'succeeded',
        output: { summary: result.summary, finding_count: result.findings.length },
        finished_at: new Date().toISOString(),
      })
      .eq('id', run.id)
      .select()
      .single();

    return {
      agentKey,
      runId: (updated ?? run).id,
      status: 'succeeded',
      summary: result.summary,
      findingCount: result.findings.length,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown_error';
    await supabase
      .from('agent_runs')
      .update({ status: 'failed', error: message, finished_at: new Date().toISOString() })
      .eq('id', run.id);
    return { agentKey, runId: run.id, status: 'failed', error: message };
  }
}

/**
 * Run every implemented agent for one church.
 *
 * One agent's failure never aborts the others: a scan that dies on a bad
 * row in giving should not cost the church its care-request sweep. Each
 * outcome is returned so the caller can record the whole picture.
 */
export async function runAllWorkosAgentsForChurch(
  supabase: SupabaseClient,
  churchId: string,
  triggeredBy: { kind: 'user'; userId: string } | { kind: 'cron' },
  now: Date = new Date(),
): Promise<WorkosAgentRunOutcome[]> {
  const outcomes: WorkosAgentRunOutcome[] = [];
  for (const agentKey of implementedAgentKeys()) {
    outcomes.push(await runWorkosAgentForChurch(supabase, churchId, agentKey, triggeredBy, now));
  }

  const failed = outcomes.filter(o => o.status === 'failed');
  await emitPlatformEvent(supabase, {
    churchId,
    eventType: 'agent.sweep.completed',
    sourceApp: 'workos',
    subjectType: 'church',
    subjectId: churchId,
    payload: {
      triggered_by: triggeredBy.kind,
      agents_run: outcomes.length,
      failed: failed.length,
      finding_count: outcomes.reduce((n, o) => n + (o.findingCount ?? 0), 0),
    },
  }).catch(() => { /* telemetry must never fail a sweep */ });

  return outcomes;
}
