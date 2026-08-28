/**
 * Nightly WorkOS agent sweep.
 *
 * Scheduled `30 6 * * *` in vercel.json — half an hour before the
 * `/api/cron/agents` lane, so the Decision Queue is already populated when
 * that lane's tasks and greetings land.
 *
 * Why this exists: the five implemented WorkOS agents are scanners for
 * work that has gone quiet — overdue tasks, blocked Work Orders, stale
 * approvals, unassigned care requests, ledger anomalies. Until now they
 * ran only when a human clicked "Run now" in the Agent Command Centre,
 * which meant nothing was ever caught unless someone was already looking.
 * A scanner you have to remember to trigger cannot answer "what's slipping
 * this week."
 *
 * What this does NOT change: the agents remain read-only. Every workflow
 * in agentWorkflows.ts records observations a human then acts on
 * elsewhere. Nothing here mutates product data. If a workflow later
 * proposes a real change (AgentFinding.requires_approval), that proposal
 * still stops at a human with approvals.decide — scheduling the scan does
 * not schedule the decision.
 *
 * Auth: Bearer CRON_SECRET only — see api/_lib/cronAuth.ts for why the
 * x-vercel-cron header is not trusted.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireCronAuth } from '../_lib/cronAuth.js';
import { recordCronRun } from '../_lib/cron-runs.js';
import { runAllWorkosAgentsForChurch, type WorkosAgentRunOutcome } from '../_lib/workosAgentRunner.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (requireCronAuth(req, res) !== null) return;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'supabase not configured' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const startedAt = new Date();

  const { data: churches, error: churchErr } = await supabase.from('churches').select('id');
  if (churchErr) {
    console.error('[workos-agents cron] list churches failed', churchErr);
    await recordCronRun(supabase, 'workos-agents', {
      ok: false,
      durationMs: Date.now() - startedAt.getTime(),
      summary: { error: 'list_churches_failed' },
    });
    return res.status(500).json({ error: 'list_churches_failed' });
  }

  const perChurch: Array<{ churchId: string; outcomes: WorkosAgentRunOutcome[] } | { churchId: string; error: string }> = [];
  let agentsRun = 0;
  let agentsFailed = 0;
  let findings = 0;

  for (const church of churches ?? []) {
    try {
      // One church's failure never aborts the sweep — a bad row in one
      // tenant must not cost every other tenant its nightly scan.
      const outcomes = await runAllWorkosAgentsForChurch(supabase, church.id, { kind: 'cron' }, startedAt);
      perChurch.push({ churchId: church.id, outcomes });
      agentsRun += outcomes.length;
      agentsFailed += outcomes.filter(o => o.status === 'failed').length;
      findings += outcomes.reduce((n, o) => n + (o.findingCount ?? 0), 0);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('[workos-agents cron] church failed', { churchId: church.id, message });
      perChurch.push({ churchId: church.id, error: message });
    }
  }

  const summary = {
    churches: (churches ?? []).length,
    agents_run: agentsRun,
    agents_failed: agentsFailed,
    findings,
  };
  await recordCronRun(supabase, 'workos-agents', {
    ok: agentsFailed === 0,
    durationMs: Date.now() - startedAt.getTime(),
    summary,
  });

  return res.status(200).json({ ...summary, per_church: perChurch });
}
