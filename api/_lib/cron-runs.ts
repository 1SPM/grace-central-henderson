/**
 * Cron run ledger — best-effort write of one row per scheduled job run
 * into cron_runs (migration 030). Read back by GET /api/automation/status
 * for the Settings → Automation tab.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type CronJobName = 'agents' | 'ai-anomaly' | 'reconcile-stripe' | 'send-pending-emails';

export async function recordCronRun(
  supabase: SupabaseClient,
  job: CronJobName,
  input: { ok: boolean; durationMs: number; summary?: Record<string, unknown> },
): Promise<void> {
  try {
    await supabase.from('cron_runs').insert({
      job,
      ok: input.ok,
      duration_ms: Math.round(input.durationMs),
      summary: input.summary ?? null,
    });
  } catch (err) {
    // The ledger is observability, not correctness — never fail the job.
    console.warn(`[cron-runs] failed to record run for ${job}`, err);
  }
}
