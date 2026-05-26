-- GRACE CRM — Server-side agent enablement + run history (Sprint 5)
-- Migration: 014_agent_settings.sql
--
-- Existing agent infrastructure (migration 004) covers per-run logs
-- and stats. Sprint 5 adds:
--
--   church_agent_settings  — per-tenant enablement + thresholds for
--                            the three server-side agents (member-care,
--                            stewardship, operations). Defaults: all
--                            enabled, sensible thresholds.
--
-- Why a separate table from `agent_configs` (client-side)?
--   - Server agents are cron-driven, not user-driven. Their config
--     needs structured columns (typed thresholds) rather than
--     freeform localStorage JSON.
--   - Lets us add per-tenant per-agent CRON_DISABLED kill switches
--     without affecting the client-side agents.
--
-- RLS posture (matches Sprint 2's church_ai_budgets):
--   - SELECT scoped to own church (admin UI reads it)
--   - No INSERT/UPDATE/DELETE policy → service-role writes only

CREATE TABLE IF NOT EXISTS church_agent_settings (
  church_id UUID PRIMARY KEY REFERENCES churches(id) ON DELETE CASCADE,

  -- ENABLEMENT (default: all on; flip to false per-tenant to disable)
  member_care_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  stewardship_enabled  BOOLEAN NOT NULL DEFAULT TRUE,
  operations_enabled   BOOLEAN NOT NULL DEFAULT TRUE,

  -- MEMBER CARE thresholds
  -- Flag a member as "needs care" when last interaction > N days ago.
  member_care_inactive_days        INTEGER NOT NULL DEFAULT 30
    CHECK (member_care_inactive_days BETWEEN 7 AND 365),
  -- Notify on birthdays within N days.
  member_care_birthday_window_days INTEGER NOT NULL DEFAULT 7
    CHECK (member_care_birthday_window_days BETWEEN 0 AND 30),

  -- STEWARDSHIP thresholds
  -- Flag a regular giver as "lapsed" when no gift in N days.
  stewardship_lapsed_days          INTEGER NOT NULL DEFAULT 60
    CHECK (stewardship_lapsed_days BETWEEN 14 AND 365),
  -- Flag any single gift ≥ this (micro-USD; default = $1000 = 1_000_000_000).
  stewardship_large_gift_micro_usd BIGINT NOT NULL DEFAULT 1000000000
    CHECK (stewardship_large_gift_micro_usd > 0),
  -- Flag a first-time gift always (boolean — no threshold needed).
  stewardship_flag_first_time_gift BOOLEAN NOT NULL DEFAULT TRUE,

  -- OPERATIONS thresholds
  -- Flag an upcoming event without a leader assigned within N days.
  operations_event_no_leader_days  INTEGER NOT NULL DEFAULT 7
    CHECK (operations_event_no_leader_days BETWEEN 1 AND 60),

  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_clerk_id TEXT
);

ALTER TABLE church_agent_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "agent_settings read own church" ON church_agent_settings;
CREATE POLICY "agent_settings read own church"
  ON church_agent_settings FOR SELECT
  USING (church_id = public.get_church_id());

COMMENT ON TABLE church_agent_settings IS
  'Per-tenant settings for the three server-side agents (member-care, stewardship, operations). Cron at api/cron/agents.ts reads this to decide which agents to run + with what thresholds. Defaults are conservative — enabled with sensible thresholds — so a new tenant gets immediate value without configuration.';
