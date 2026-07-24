/**
 * Daily agent runner cron.
 *
 * Scheduled `0 7 * * *` in vercel.json (07:00 UTC — early-morning
 * pastoral prep for most US timezones).
 *
 * For each church with at least one agent enabled, runs the agent
 * pipeline and persists observations. Per-church failures are
 * captured into the summary; one bad church doesn't abort the run.
 *
 * Auth: Bearer CRON_SECRET only — see api/_lib/cronAuth.ts for why the
 * x-vercel-cron header is not trusted.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { listChurchesWithAgents, runAgentsForChurch, type RunResult } from '../_lib/agents/runner.js';
import { runMessagingAgentsForChurch, type MessagingRunResult } from '../_lib/agents/messaging.js';
import { snapshotHealthForChurch } from '../_lib/healthSnapshot.js';
import { recordCronRun } from '../_lib/cron-runs.js';
import { requireCronAuth } from '../_lib/cronAuth.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (requireCronAuth(req, res) !== null) return;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'supabase not configured' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const startedAt = new Date();

  let churches: string[];
  try {
    churches = await listChurchesWithAgents(supabase);
  } catch (err) {
    console.error('[agents cron] listChurches failed', err);
    await recordCronRun(supabase, 'agents', {
      ok: false,
      durationMs: Date.now() - startedAt.getTime(),
      summary: { error: 'list_churches_failed' },
    });
    return res.status(500).json({ error: 'list_churches_failed' });
  }

  const results: Array<RunResult | { churchId: string; error: string }> = [];
  const messagingResults: Array<MessagingRunResult | { churchId: string; error: string }> = [];
  let succeeded = 0;
  let failed = 0;

  for (const churchId of churches) {
    try {
      const r = await runAgentsForChurch(supabase, churchId, startedAt);
      results.push(r);
      succeeded += 1;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[agents cron] church failed', { churchId, msg });
      results.push({ churchId, error: msg });
      failed += 1;
    }

    // Messaging agents (life-event greetings, new-member drip, donation
    // thank-yous) queue into email_outbox; the send-pending-emails cron
    // drains it an hour later. Failures here don't fail the church run.
    try {
      const m = await runMessagingAgentsForChurch(supabase, churchId, startedAt);
      messagingResults.push(m);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[agents cron] messaging failed', { churchId, msg });
      messagingResults.push({ churchId, error: msg });
    }
  }

  await recordCronRun(supabase, 'agents', {
    ok: failed === 0,
    durationMs: Date.now() - startedAt.getTime(),
    summary: {
      churches_processed: churches.length,
      churches_succeeded: succeeded,
      churches_failed: failed,
      observations_written: results.reduce((n, r) => n + ('observationsWritten' in r ? r.observationsWritten : 0), 0),
    },
  });

  // Congregational Health snapshot: every church gets a daily snapshot,
  // not just the ones with agents enabled — health metrics don't depend
  // on agent settings. Same cron trigger, its own cron_runs job record.
  const { data: allChurchRows } = await supabase.from('churches').select('id').limit(5000);
  const allChurchIds = (allChurchRows as Array<{ id: string }> | null)?.map(c => c.id) ?? [];
  let healthSucceeded = 0;
  let healthFailed = 0;
  for (const churchId of allChurchIds) {
    try {
      await snapshotHealthForChurch(supabase, churchId, startedAt);
      healthSucceeded += 1;
    } catch (err) {
      console.error('[health cron] church failed', { churchId, err: err instanceof Error ? err.message : String(err) });
      healthFailed += 1;
    }
  }
  await recordCronRun(supabase, 'health', {
    ok: healthFailed === 0,
    durationMs: Date.now() - startedAt.getTime(),
    summary: {
      churches_processed: allChurchIds.length,
      churches_succeeded: healthSucceeded,
      churches_failed: healthFailed,
    },
  });

  return res.status(200).json({
    ok: true,
    started_at: startedAt.toISOString(),
    duration_ms: Date.now() - startedAt.getTime(),
    churches_processed: churches.length,
    churches_succeeded: succeeded,
    churches_failed: failed,
    results,
    messaging_results: messagingResults,
    health_snapshot: { churches_processed: allChurchIds.length, succeeded: healthSucceeded, failed: healthFailed },
  });
}
