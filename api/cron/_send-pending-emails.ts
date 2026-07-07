/**
 * GET/POST /api/cron/send-pending-emails
 *
 * Drains the email_outbox. Picks up to 50 queued/failed-but-retriable
 * emails per run, sends via Resend, marks each row sent | failed | skipped.
 *
 * Vercel cron schedule: `0 8 * * *` (08:00 UTC daily, an hour after the
 * agents cron queues messaging emails). Per-email retry is bounded
 * to 5 attempts; after that the row stays 'failed' permanently with
 * last_error populated so an operator can inspect via Supabase Studio.
 *
 * Auth: CRON_SECRET header (matches the existing Sprint 2/3/5 crons).
 *
 * Idempotency: queueEmail() de-dups at insert time via the unique
 * index on idempotency_key. The drain itself is naturally idempotent —
 * once a row is 'sent', it's filtered out by the WHERE clause.
 *
 * When RESEND_API_KEY is absent, every row is marked 'skipped' with
 * reason='no_api_key'. The endpoint still returns 200 — this is the
 * default for environments without email configured.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { drainOutbox } from '../_lib/email/queue.js';
import { recordCronRun } from '../_lib/cron-runs.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'supabase_not_configured' });
  }

  // Cron auth — either Vercel's automated header or our CRON_SECRET match
  const cronHeader = req.headers['x-vercel-cron'] ?? req.headers.authorization;
  const expected = CRON_SECRET ? `Bearer ${CRON_SECRET}` : null;
  if (expected && cronHeader !== expected && req.headers['x-vercel-cron'] !== '1') {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const limit = Math.min(Math.max(Number(req.query.limit ?? 50), 1), 500);
  const startedAt = Date.now();

  try {
    const result = await drainOutbox(supabase, limit);
    await recordCronRun(supabase, 'send-pending-emails', {
      ok: true,
      durationMs: Date.now() - startedAt,
      summary: result as unknown as Record<string, unknown>,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    await recordCronRun(supabase, 'send-pending-emails', {
      ok: false,
      durationMs: Date.now() - startedAt,
      summary: { error: err instanceof Error ? err.message : 'unknown' },
    });
    return res.status(500).json({
      error: 'drain_failed',
      detail: err instanceof Error ? err.message : 'unknown',
    });
  }
}
