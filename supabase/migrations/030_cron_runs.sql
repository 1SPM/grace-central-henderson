-- GRACE CRM — Cron run ledger.
-- Migration: 030_cron_runs.sql
--
-- Every scheduled job (vercel.json crons) writes one row per run so the
-- Settings → Automation tab and GET /api/automation/status can show the
-- pastor what GRACE did overnight, when, and whether it succeeded.
--
-- Writes are best-effort from the cron handlers (service role); a ledger
-- write failure never fails the job itself.
--
-- RLS posture: authenticated reads (rows carry no tenant data — only job
-- names and aggregate counts), service-role writes only.

CREATE TABLE IF NOT EXISTS cron_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job TEXT NOT NULL,            -- 'agents' | 'ai-anomaly' | 'reconcile-stripe' | 'send-pending-emails'
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ok BOOLEAN NOT NULL,
  duration_ms INTEGER,
  summary JSONB
);

CREATE INDEX IF NOT EXISTS idx_cron_runs_job_ran_at ON cron_runs (job, ran_at DESC);

ALTER TABLE cron_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cron_runs read authenticated" ON cron_runs;
CREATE POLICY "cron_runs read authenticated"
  ON cron_runs FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON TABLE cron_runs IS
  'One row per scheduled job run (agents, ai-anomaly, reconcile-stripe, send-pending-emails). Read by GET /api/automation/status for the Settings Automation tab. Best-effort writes from the cron handlers — never fails the job.';
