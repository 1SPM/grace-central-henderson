-- GRACE — widen agent_findings.source to allow staff-initiated flags
-- Migration: 071_agent_findings_staff_flag_source.sql
--
-- api/workos/_my-work.ts lets a staff member flag an agent's work for
-- pastor review, inserting agent_findings with source: 'staff_flag'.
-- Migration 047's CHECK only allowed ('cron','workflow','event'), so
-- every one of those inserts fails the constraint and the route returns
-- a generic 500 (flag_failed) — the human-escalation path has been dead
-- since it shipped. Widen the CHECK to include 'staff_flag'.
--
-- Idempotent.

ALTER TABLE agent_findings DROP CONSTRAINT IF EXISTS agent_findings_source_check;
ALTER TABLE agent_findings ADD CONSTRAINT agent_findings_source_check
  CHECK (source IN ('cron','workflow','event','staff_flag'));

COMMENT ON COLUMN agent_findings.source IS
  'Who/what generated this finding: cron runner observation, Command Centre workflow run, synchronous crisis event, or a staff member flagging agent work via My Work.';
