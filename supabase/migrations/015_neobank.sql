-- GRACE CRM — i2c neobank: KYC + cards + interchange (Sprint 6)
-- Migration: 015_neobank.sql
--
-- All behind the PostHog flag I2C_LIVE. When the flag is off, the
-- adapter at api/_lib/i2c/ returns mock data and these tables sit
-- empty. When the flag is on AND I2C_API_KEY is set, the adapter
-- calls real i2c sandbox/production and writes rows here.
--
-- Three tables:
--   kyc_verifications  — per-person identity verification state
--   cards              — issued cards (masked PAN, status, limits)
--   interchange_events — every card transaction, append-only journal
--                        analogous to ledger_entries
--
-- RLS posture mirrors ledger_entries (013):
--   - SELECT scoped to own church
--   - No INSERT/UPDATE/DELETE policy → service-role only writes
--   - interchange_events is append-only (RLS + trigger)

-- ============================================
-- KYC_VERIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS kyc_verifications (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id           UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  person_id           UUID REFERENCES people(id) ON DELETE SET NULL,

  -- IDENTITY
  full_name           TEXT NOT NULL,
  date_of_birth       DATE NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT,

  -- KYC STATE — driven by the i2c response. Don't add new states
  -- without verifying i2c supports them; the adapter maps from
  -- their codes.
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'in_review', 'approved', 'rejected', 'expired')),
  i2c_kyc_id          TEXT,                          -- upstream identifier when available
  rejection_reason    TEXT,

  submitted_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed_at         TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,                   -- KYC ages out per regulation

  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_church_status
  ON kyc_verifications(church_id, status, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_kyc_person
  ON kyc_verifications(person_id) WHERE person_id IS NOT NULL;

ALTER TABLE kyc_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kyc read own church" ON kyc_verifications;
CREATE POLICY "kyc read own church"
  ON kyc_verifications FOR SELECT
  USING (church_id = public.get_church_id());

COMMENT ON TABLE kyc_verifications IS
  'Identity verification state for cardholders. Driven by i2c sandbox/production responses; mock mode populates with deterministic test data.';

-- ============================================
-- CARDS
-- ============================================

CREATE TABLE IF NOT EXISTS cards (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id           UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  cardholder_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  kyc_verification_id UUID REFERENCES kyc_verifications(id) ON DELETE SET NULL,

  -- CARD IDENTITY — never store full PAN. masked_pan = '••••1234'.
  i2c_card_id         TEXT NOT NULL,                 -- upstream identifier
  masked_pan          TEXT NOT NULL,
  cardholder_name     TEXT NOT NULL,
  expiry_month        INTEGER NOT NULL CHECK (expiry_month BETWEEN 1 AND 12),
  expiry_year         INTEGER NOT NULL CHECK (expiry_year BETWEEN 2024 AND 2099),

  -- LIFECYCLE
  status              TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('pending', 'active', 'frozen', 'cancelled', 'expired')),

  -- LIMITS (micro-USD per period, matching ledger convention)
  daily_limit_micro_usd   BIGINT NOT NULL DEFAULT 500000000,    -- $500/day default
  monthly_limit_micro_usd BIGINT NOT NULL DEFAULT 5000000000,   -- $5,000/month default

  issued_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at        TIMESTAMPTZ,
  frozen_at           TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,

  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (i2c_card_id)
);

CREATE INDEX IF NOT EXISTS idx_cards_church_status
  ON cards(church_id, status, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_cards_cardholder
  ON cards(cardholder_person_id) WHERE cardholder_person_id IS NOT NULL;

ALTER TABLE cards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cards read own church" ON cards;
CREATE POLICY "cards read own church"
  ON cards FOR SELECT
  USING (church_id = public.get_church_id());

COMMENT ON TABLE cards IS
  'Issued debit/prepaid cards. Never stores full PAN (PCI scope). masked_pan = "••••1234". Limits in micro-USD per ledger convention.';

-- ============================================
-- INTERCHANGE_EVENTS
-- ============================================
-- Append-only journal of card activity. Analogous to ledger_entries
-- but specific to card swipes / ATM / settlements. Each event MAY
-- write a paired entry to ledger_entries (via the i2c webhook handler)
-- when the funds movement is settled.

CREATE TABLE IF NOT EXISTS interchange_events (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id           UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  card_id             UUID REFERENCES cards(id) ON DELETE SET NULL,

  -- EVENT IDENTITY
  i2c_event_id        TEXT NOT NULL,                 -- upstream event id, for idempotency
  event_type          TEXT NOT NULL
                      CHECK (event_type IN ('authorization', 'capture', 'refund', 'reversal', 'fee', 'declined')),
  direction           TEXT NOT NULL CHECK (direction IN ('debit', 'credit')),

  -- MONEY
  amount_micro_usd    BIGINT NOT NULL CHECK (amount_micro_usd > 0),
  currency            TEXT NOT NULL DEFAULT 'USD',

  -- CONTEXT
  merchant_name       TEXT,
  merchant_category   TEXT,                          -- MCC code text
  decline_reason      TEXT,                          -- when event_type='declined'

  -- LINK BACK TO LEDGER
  ledger_entry_id     UUID REFERENCES ledger_entries(id) ON DELETE SET NULL,

  occurred_at         TIMESTAMPTZ NOT NULL,
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- IDEMPOTENCY (same pattern as ledger_entries)
  UNIQUE (i2c_event_id)
);

CREATE INDEX IF NOT EXISTS idx_interchange_church_time
  ON interchange_events(church_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_interchange_card_time
  ON interchange_events(card_id, occurred_at DESC) WHERE card_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_interchange_type
  ON interchange_events(event_type, occurred_at DESC);

ALTER TABLE interchange_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "interchange read own church" ON interchange_events;
CREATE POLICY "interchange read own church"
  ON interchange_events FOR SELECT
  USING (church_id = public.get_church_id());

-- Append-only enforcement (matches ledger_entries pattern)
CREATE OR REPLACE FUNCTION public.interchange_events_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'interchange_events is append-only; UPDATE/DELETE are not permitted (op=%, id=%). Write a kind=reversal event instead.', TG_OP, OLD.id;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_interchange_events_no_mutation ON interchange_events;
CREATE TRIGGER trig_interchange_events_no_mutation
  BEFORE UPDATE OR DELETE ON interchange_events
  FOR EACH ROW EXECUTE FUNCTION public.interchange_events_block_mutation();

COMMENT ON TABLE interchange_events IS
  'Append-only journal of card activity (auth/capture/refund/decline). i2c_event_id is the dedup key. Settlement events optionally link to ledger_entries via ledger_entry_id.';
