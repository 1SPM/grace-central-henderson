-- GRACE — Agent findings lifecycle
-- Migration: 047_agent_findings.sql
--
-- Turns agent output (cron runner observations, Command Centre workflow
-- runs, and synchronous crisis events) into one accountable table with a
-- lifecycle: open -> triaged -> actioned -> resolved, or open -> dismissed
-- (with an optional suppression window so a dismissed condition doesn't
-- immediately re-fire). Reuses the existing agents.view / agents.manage
-- permission keys from migration 039 — no new permissions needed.
--
-- Idempotent throughout.

CREATE TABLE IF NOT EXISTS agent_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  agent_id TEXT NOT NULL,          -- 'member-care'…'crisis-escalation', workflow keys, 'event'
  source TEXT NOT NULL CHECK (source IN ('cron','workflow','event')),
  dedup_key TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT,
  severity TEXT NOT NULL DEFAULT 'normal'
    CHECK (severity IN ('critical','high','normal','info')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','triaged','actioned','resolved','dismissed')),
  subject_type TEXT,
  subject_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  work_order_id UUID REFERENCES work_orders(id),
  task_id UUID REFERENCES tasks(id),
  triaged_by_user_id UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  dismissed_reason TEXT,
  suppress_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_findings_dedup
  ON agent_findings(church_id, dedup_key, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_findings_status
  ON agent_findings(church_id, status);

ALTER TABLE agent_findings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON agent_findings;
CREATE POLICY "tenant_isolation" ON agent_findings FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE agent_findings IS
  'Accountable lifecycle for agent output (cron observations, Command Centre workflow runs, synchronous crisis events): open -> triaged -> actioned -> resolved, or open -> dismissed with an optional suppress_until window. Gated on the existing agents.view / agents.manage permission keys.';
