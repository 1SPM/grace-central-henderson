-- GRACE CRM — Grace inbox table + Realtime (Portal-CRM Alignment, Phase D)
-- Migration: 020_grace_inbox_realtime.sql
--
-- 1. grace_inbox_messages — used by api/agentmail/* and the Mail inbox
--    UI since Sprint 5 but never had a migration (TD: code-first table).
--    This formalizes the schema the code already reads/writes.
-- 2. Realtime publication for grace_inbox_messages and
--    member_activity_events so the admin dashboard gets live pushes
--    instead of 60s polling.

-- ============================================
-- GRACE_INBOX_MESSAGES
-- ============================================

CREATE TABLE IF NOT EXISTS grace_inbox_messages (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id          UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  person_id          UUID REFERENCES people(id) ON DELETE SET NULL,

  -- SOURCE IDENTITY (AgentMail today; other sources later)
  source             TEXT NOT NULL DEFAULT 'agentmail',
  source_message_id  TEXT NOT NULL,
  source_thread_id   TEXT,
  source_inbox_id    TEXT,

  -- CONTENT
  from_email         TEXT NOT NULL,
  subject            TEXT,
  preview            TEXT,
  body_text          TEXT,

  -- GRACE PROCESSING STATE
  parsed_actions     JSONB NOT NULL DEFAULT '[]'::JSONB,
  flag               TEXT CHECK (flag IN ('crisis')),
  auto_handled_at    TIMESTAMPTZ,
  auto_summary       TEXT,
  reply_sent_at      TIMESTAMPTZ,

  -- ADMIN UI STATE
  seen_at            TIMESTAMPTZ,
  dismissed_at       TIMESTAMPTZ,

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (source, source_message_id)
);

CREATE INDEX IF NOT EXISTS idx_grace_inbox_church_created
  ON grace_inbox_messages(church_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_grace_inbox_unseen
  ON grace_inbox_messages(church_id, created_at)
  WHERE seen_at IS NULL AND dismissed_at IS NULL;

ALTER TABLE grace_inbox_messages ENABLE ROW LEVEL SECURITY;

-- Staff read their church's inbox.
DROP POLICY IF EXISTS "grace inbox read own church" ON grace_inbox_messages;
CREATE POLICY "grace inbox read own church"
  ON grace_inbox_messages FOR SELECT
  USING (church_id = public.get_church_id());

-- Staff mark rows seen/dismissed from the client. INSERTs stay
-- service-role-only (AgentMail webhook).
DROP POLICY IF EXISTS "grace inbox update own church" ON grace_inbox_messages;
CREATE POLICY "grace inbox update own church"
  ON grace_inbox_messages FOR UPDATE
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE grace_inbox_messages IS
  'Inbound messages processed by Grace (AgentMail). Surfaced in the Mail inbox UI and injected into Ask Grace chat. Crisis-flagged rows are never auto-handled.';

-- ============================================
-- REALTIME PUBLICATION
-- ============================================
-- Supabase Realtime streams tables in the supabase_realtime
-- publication. Add the two tables the admin notification center
-- subscribes to. Idempotent: skip if already present.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'grace_inbox_messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE grace_inbox_messages;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'member_activity_events'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE member_activity_events;
    END IF;
  END IF;
END $$;
