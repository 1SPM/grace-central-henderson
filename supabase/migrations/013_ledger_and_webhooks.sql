-- GRACE CRM — Unified ledger + webhook idempotency + DLQ (Sprint 3)
-- Migration: 013_ledger_and_webhooks.sql
--
-- Three tables, one job: every financial event that touches the
-- platform leaves exactly one row in `ledger_entries`, regardless of
-- source (Stripe, i2c, manual reconciliation). Duplicates from upstream
-- (Stripe retries the same webhook) are caught at `webhook_events`
-- via UNIQUE(source, source_event_id) and never reach the ledger.
-- Failures land in `webhook_dlq` for operator replay.
--
-- ADR-005 commitments enforced here:
--   - ledger is append-only (RLS + trigger; UPDATE/DELETE rejected)
--   - source_event_id UNIQUE per source (idempotent at the journal too)
--   - mistakes are reversed by writing a correcting entry, not editing
--
-- RLS posture mirrors audit_logs (010) + token_usage (012):
--   - SELECT scoped to own church
--   - No INSERT/UPDATE/DELETE policy → service-role only writes
--   - Append-only trigger blocks UPDATE/DELETE even from service role

-- ============================================
-- WEBHOOK_EVENTS — idempotency tracker
-- ============================================
-- Every webhook delivery from any source is recorded here BEFORE the
-- per-source handler runs. If a duplicate arrives (Stripe retries),
-- the UNIQUE constraint kicks in and we return 200 without re-running
-- any handler.

CREATE TABLE IF NOT EXISTS webhook_events (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  source            TEXT NOT NULL,                  -- 'stripe' | 'i2c' | 'resend' | 'twilio' | ...
  source_event_id   TEXT NOT NULL,                  -- Stripe 'evt_...', etc
  event_type        TEXT NOT NULL,                  -- 'payment_intent.succeeded', etc

  -- The full payload as received (post sig-verification).
  -- Used by DLQ replay and audit. JSONB to allow indexed lookups.
  payload           JSONB NOT NULL,

  status            TEXT NOT NULL DEFAULT 'received'
                    CHECK (status IN ('received', 'processed', 'failed', 'skipped')),

  -- Latest error if status='failed'. Cleared on retry success.
  processing_error  TEXT,

  -- Tenant attribution — extracted from payload.metadata.church_id if present.
  -- NULLABLE because some early events (e.g. signup pre-tenant) may not have it.
  church_id         UUID REFERENCES churches(id) ON DELETE SET NULL,

  received_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at      TIMESTAMPTZ,

  -- THE IDEMPOTENCY GUARANTEE
  UNIQUE (source, source_event_id)
);

-- Hot-path: "is this event already known?" lookup is covered by the
-- UNIQUE index above. We add status-based indexes for DLQ + admin views.
CREATE INDEX IF NOT EXISTS idx_webhook_events_status_time
  ON webhook_events(status, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_source_time
  ON webhook_events(source, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_church_time
  ON webhook_events(church_id, received_at DESC) WHERE church_id IS NOT NULL;

ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_events read own church" ON webhook_events;
CREATE POLICY "webhook_events read own church"
  ON webhook_events FOR SELECT
  USING (church_id IS NOT NULL AND church_id = public.get_church_id());

COMMENT ON TABLE webhook_events IS
  'Idempotency tracker for every inbound webhook. Source+source_event_id is the dedup key. Status transitions: received → processed | failed | skipped. Written by api/_lib/webhooks/idempotency.ts.';

-- ============================================
-- WEBHOOK_DLQ — dead-letter queue for failures
-- ============================================
-- When a handler throws, we record the failure here with the linked
-- webhook_events row, an attempt count, and a next_retry_at. An
-- operator UI (api/admin/webhooks/...) drives replay; this table is
-- NOT auto-retried — we want a human in the loop on financial failures.

CREATE TABLE IF NOT EXISTS webhook_dlq (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_event_id    UUID NOT NULL REFERENCES webhook_events(id) ON DELETE CASCADE,
  source              TEXT NOT NULL,
  event_type          TEXT NOT NULL,
  church_id           UUID REFERENCES churches(id) ON DELETE SET NULL,

  error_message       TEXT NOT NULL,
  error_class         TEXT,                          -- exception name for grouping in Sentry
  error_stack         TEXT,                          -- truncated stack trace

  attempt_count       INTEGER NOT NULL DEFAULT 1 CHECK (attempt_count >= 1),
  first_failed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_attempt_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  next_retry_at       TIMESTAMPTZ,                   -- NULL = no retry scheduled

  resolved            BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at         TIMESTAMPTZ,
  resolved_by_clerk_id TEXT,
  resolution_note     TEXT
);

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_unresolved
  ON webhook_dlq(last_attempt_at DESC) WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_church
  ON webhook_dlq(church_id, last_attempt_at DESC) WHERE church_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_dlq_event
  ON webhook_dlq(webhook_event_id);

ALTER TABLE webhook_dlq ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "webhook_dlq read own church" ON webhook_dlq;
CREATE POLICY "webhook_dlq read own church"
  ON webhook_dlq FOR SELECT
  USING (church_id IS NOT NULL AND church_id = public.get_church_id());

COMMENT ON TABLE webhook_dlq IS
  'Failed webhook deliveries awaiting operator replay. NOT auto-retried — financial failures need a human. UI: /admin/webhooks. Replay: api/admin/webhooks/replay.';

-- ============================================
-- LEDGER_ENTRIES — append-only financial journal
-- ============================================
-- One row per financial event. The operational tables (`giving`,
-- `recurring_giving`, future i2c card-transaction tables) remain for
-- fast reads + business logic; this is the auditor-facing journal.
--
-- Mistakes are reversed by writing a CORRECTING entry (opposite
-- direction, link via metadata.corrects_entry_id), never by editing.
-- RLS + trigger enforce this structurally.

CREATE TABLE IF NOT EXISTS ledger_entries (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id           UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,

  -- WHERE the event originated
  source              TEXT NOT NULL CHECK (source IN ('stripe', 'i2c', 'manual', 'reconciliation')),
  source_event_id     TEXT NOT NULL,                 -- Stripe evt_id / i2c txn id / manual UUID

  -- WHAT happened
  kind                TEXT NOT NULL
                      CHECK (kind IN ('donation', 'refund', 'fee', 'payout', 'transfer', 'adjustment', 'correction')),
  direction           TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),

  -- HOW MUCH — always positive integer, direction tells you the sign.
  -- Micro-USD = 1/1_000_000 USD. BIGINT so a single large grant doesn't
  -- overflow ($9 quadrillion ceiling).
  amount_micro_usd    BIGINT NOT NULL CHECK (amount_micro_usd > 0),
  currency            TEXT NOT NULL DEFAULT 'USD',

  -- WHO / WHY
  description         TEXT,
  related_giving_id   UUID REFERENCES giving(id) ON DELETE SET NULL,
  related_person_id   UUID REFERENCES people(id) ON DELETE SET NULL,

  -- WHEN — in the SOURCE system. Distinguish from row created_at.
  occurred_at         TIMESTAMPTZ NOT NULL,

  -- ANYTHING ELSE — source-specific fields, correction links, etc.
  -- Examples: { "stripe_fee_micro_usd": 87000, "corrects_entry_id": "uuid" }
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- IDEMPOTENCY GUARANTEE at the journal level (defense in depth on
  -- top of webhook_events). Two upstream events with the same
  -- source_event_id cannot both land here.
  UNIQUE (source, source_event_id)
);

-- Hot path 1: tenant ledger view by date (admin dashboards)
CREATE INDEX IF NOT EXISTS idx_ledger_church_occurred
  ON ledger_entries(church_id, occurred_at DESC);

-- Hot path 2: reconciliation cron (sum per source per day)
CREATE INDEX IF NOT EXISTS idx_ledger_source_occurred
  ON ledger_entries(source, occurred_at DESC);

-- Drilldown: "all entries for this giving row"
CREATE INDEX IF NOT EXISTS idx_ledger_giving
  ON ledger_entries(related_giving_id) WHERE related_giving_id IS NOT NULL;

ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_entries read own church" ON ledger_entries;
CREATE POLICY "ledger_entries read own church"
  ON ledger_entries FOR SELECT
  USING (church_id = public.get_church_id());

-- No INSERT/UPDATE/DELETE policy → service-role only writes.

-- THE APPEND-ONLY ENFORCEMENT (matches token_usage pattern).
-- Even the service role cannot UPDATE or DELETE rows in this table.
CREATE OR REPLACE FUNCTION public.ledger_entries_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'ledger_entries is append-only; UPDATE/DELETE are not permitted (op=%, id=%). Write a correction entry instead.', TG_OP, OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_ledger_entries_no_mutation ON ledger_entries;
CREATE TRIGGER trig_ledger_entries_no_mutation
  BEFORE UPDATE OR DELETE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION public.ledger_entries_block_mutation();

COMMENT ON TABLE ledger_entries IS
  'Append-only financial journal. One row per accepted financial event from any source. Source+source_event_id is unique. Mistakes are reversed by writing a kind=correction entry with metadata.corrects_entry_id pointing at the original. Written by api/_lib/webhooks/ledger.ts.';
