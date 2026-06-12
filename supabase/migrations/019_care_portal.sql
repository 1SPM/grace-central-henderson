-- GRACE CRM — Portal care wiring (Portal-CRM Alignment, Phase B)
-- Migration: 019_care_portal.sql
--
-- Adapts the (previously unused) anchor_* care tables for member-portal
-- help requests:
--   1. leader_id becomes nullable — a member's help request can sit
--      unassigned until triage matches a leader
--   2. category/priority columns — the portal's help-request taxonomy
--      (marriage, grief, crisis, …) drives admin triage ordering
--
-- RLS on anchor_conversations/anchor_messages remains service-role-only
-- (see migration 008); all reads/writes go through api/care/* routes.

ALTER TABLE anchor_conversations ALTER COLUMN leader_id DROP NOT NULL;

ALTER TABLE anchor_conversations ADD COLUMN IF NOT EXISTS category TEXT
  CHECK (category IN (
    'marriage', 'addiction', 'grief', 'faith-questions', 'crisis',
    'financial', 'anxiety-depression', 'parenting', 'general'
  ));
ALTER TABLE anchor_conversations ADD COLUMN IF NOT EXISTS priority TEXT
  NOT NULL DEFAULT 'medium'
  CHECK (priority IN ('low', 'medium', 'high', 'crisis'));

CREATE INDEX IF NOT EXISTS idx_anchor_conversations_priority
  ON anchor_conversations(church_id, priority, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_anchor_conversations_crisis
  ON anchor_conversations(church_id, crisis_flagged) WHERE crisis_flagged;

COMMENT ON COLUMN anchor_conversations.category IS
  'Portal help-request category. Drives leader matching and admin triage.';
