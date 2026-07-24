-- GRACE — Congregational Health snapshots
-- Migration: 048_health_snapshots.sql
--
-- Daily snapshot of church-level "north star" metrics (computed by
-- api/_lib/healthMetrics.ts) so the WorkOS Health Scorecard can show
-- real trend sparklines instead of only a point-in-time value. One row
-- per church per day; upserted by the nightly cron so re-running the
-- same day never creates a duplicate. Gated on the existing
-- analytics.view permission key — no new permissions needed.
--
-- Idempotent throughout.

CREATE TABLE IF NOT EXISTS health_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id UUID NOT NULL REFERENCES churches(id),
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(church_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_health_snapshots_church_date
  ON health_snapshots(church_id, snapshot_date DESC);

ALTER TABLE health_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON health_snapshots;
CREATE POLICY "tenant_isolation" ON health_snapshots FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE health_snapshots IS
  'Daily per-church snapshot of Congregational Health north-star metrics (computeHealthMetrics output), one row per (church_id, snapshot_date), upserted nightly so trend sparklines have real history.';
