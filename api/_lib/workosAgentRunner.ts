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
import { actionRowForFinding, getWorkflow } from './agentWorkflows.js';
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
      // Same fail-closed posture as api/agents/_workos-run.ts: nothing
      // consumes 'proposed' agent_actions rows yet, so a workflow that
      // emits an approval-requiring finding would strand it in a table
      // nobody reads while the run reported success. Scheduling a scan
      // must not quietly widen what an agent is allowed to do.
      //
      // NOTE: PR #163 builds that consumer. When it lands, this guard
      // narrows to "no registered executor" and the HTTP endpoint should
      // be pointed at this runner so the two lanes share one path — see
      // the PR description. Until then the check is duplicated in both,
      // deliberately, rather than leaving the cron lane unguarded.
      const needingApproval = result.findings.filter(f => f.requires_approval);
      if (needingApproval.length > 0) {
        throw new Error(
          `workflow '${agentKey}' emitted ${needingApproval.length} requires_approval finding(s) but no approvals consumer exists for agent_actions`,
        );
      }

      const { error: actionsErr } = await supabase.from('agent_actions').insert(
        result.findings.map(f => ({
          agent_run_id: run.id,
          church_id: churchId,
          ...actionRowForFinding(f, now),
        })),
      );
      if (actionsErr) throw new Error(`agent_actions insert failed: ${actionsErr.message}`);

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
