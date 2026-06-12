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
 * Auth: x-vercel-cron header OR Bearer CRON_SECRET. Matches the
 * pattern from api/cron/ai-anomaly.ts and api/cron/reconcile-stripe.ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { listChurchesWithAgents, runAgentsForChurch, type RunResult } from '../_lib/agents/runner.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

function isAuthorized(req: VercelRequest): boolean {
  if (req.headers['x-vercel-cron']) return true;
  const auth = req.headers.authorization;
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  return false;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'supabase not configured' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const startedAt = new Date();

  let churches: string[];
  try {
    churches = await listChurchesWithAgents(supabase);
  } catch (err) {
    console.error('[agents cron] listChurches failed', err);
    return res.status(500).json({ error: 'list_churches_failed' });
  }

  const results: Array<RunResult | { churchId: string; error: string }> = [];
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
  }

  return res.status(200).json({
    ok: true,
    started_at: startedAt.toISOString(),
    duration_ms: Date.now() - startedAt.getTime(),
    churches_processed: churches.length,
    churches_succeeded: succeeded,
    churches_failed: failed,
    results,
  });
}
