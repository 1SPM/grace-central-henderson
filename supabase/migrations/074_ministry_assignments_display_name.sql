-- GRACE — per-church ministry area naming
-- Migration: 074_ministry_assignments_display_name.sql
--
-- Church-owned configuration scope item "ministry/department naming": a
-- church may prefer its own name for an area (e.g. "Kids Ministry"
-- instead of the coded default "Children & Youth"). Extends the existing
-- ministry_assignments override table — the exact link migration 066
-- already established (accountable human, agent, room) — rather than
-- creating a second per-church naming mechanism. A missing/NULL value
-- means "use the coded default", same as every other column here; setting
-- it to NULL again is how a pastor restores the default name.
--
-- Deliberately NOT touching the roles table's per-church name support
-- (migration 032 already schema-allows church_id-scoped roles) — that
-- table is RBAC-critical and hardened across migrations 056-068. Area
-- naming is purely cosmetic and carries none of that risk.
--
-- Idempotent.

ALTER TABLE ministry_assignments ADD COLUMN IF NOT EXISTS display_name TEXT;

ALTER TABLE ministry_assignments DROP CONSTRAINT IF EXISTS ministry_assignments_display_name_length;
ALTER TABLE ministry_assignments ADD CONSTRAINT ministry_assignments_display_name_length
  CHECK (display_name IS NULL OR (char_length(display_name) BETWEEN 1 AND 60));

COMMENT ON COLUMN ministry_assignments.display_name IS
  'Church-chosen override of this area''s display name. NULL = use the coded default in api/_lib/ministryAreas.ts.';

-- Rollback: drops the column and its check constraint. Destructive to any
-- display_name values already set — every church reverts to the coded
-- default name, with no way to recover what was there.
-- begin;
--   alter table ministry_assignments drop constraint if exists ministry_assignments_display_name_length;
--   alter table ministry_assignments drop column if exists display_name;
-- commit;
