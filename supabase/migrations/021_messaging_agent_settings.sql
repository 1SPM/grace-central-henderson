-- GRACE CRM — Messaging agent config moves to Supabase (Phase 1 of
-- the agent wish-list roadmap).
-- Migration: 021_messaging_agent_settings.sql
--
-- The client Rules Engine agents (life-event, new-member, donation)
-- previously kept their config in browser localStorage, which meant:
--   - config didn't survive a device change
--   - the daily cron had no way to know what to run
--
-- This adds a JSONB column on church_agent_settings holding the same
-- AgentConfig JSON the Rules Engine UI manages, keyed by agent id:
--   { "life-event-agent": {...}, "new-member-agent": {...},
--     "donation-processing-agent": {...} }
--
-- Writes go through POST /api/agents/settings (service role) — RLS
-- posture stays SELECT-own-church / service-role writes, matching
-- migration 014.

ALTER TABLE church_agent_settings
  ADD COLUMN IF NOT EXISTS messaging_settings JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN church_agent_settings.messaging_settings IS
  'Client messaging agent config (life-event, new-member drip, donation thank-you) keyed by agent id. Saved by the Rules Engine UI via /api/agents/settings; read by the daily messaging cron (api/_lib/agents/messaging.ts). Empty object = messaging cron disabled for this church (opt-in).';
