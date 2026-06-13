-- GRACE CRM — neo-banking account layer (wallet balance, transfers, impact routing)
-- Migration: 024_neobank_accounts.sql
--
-- Extends 015_neobank.sql with DDA-style accounts, transfer audit log,
-- per-member impact routes, and monthly impact allocations.

-- ============================================
-- CARD_ACCOUNTS — per-person DDA / sub-account
-- ============================================

CREATE TABLE IF NOT EXISTS card_accounts (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id                   UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  person_id                   UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  i2c_account_id              TEXT NOT NULL,
  account_name                TEXT NOT NULL DEFAULT 'GRACE Impact Card',
  account_number_last4        TEXT NOT NULL DEFAULT '0000',
  routing_number              TEXT,

  available_balance_micro_usd BIGINT NOT NULL DEFAULT 0 CHECK (available_balance_micro_usd >= 0),
  status                      TEXT NOT NULL DEFAULT 'active'
                              CHECK (status IN ('pending', 'active', 'frozen', 'closed')),

  last_synced_at              TIMESTAMPTZ,
  metadata                    JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (church_id, person_id),
  UNIQUE (i2c_account_id)
);

CREATE INDEX IF NOT EXISTS idx_card_accounts_church
  ON card_accounts(church_id, status);

ALTER TABLE card_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "card_accounts read own church" ON card_accounts;
CREATE POLICY "card_accounts read own church"
  ON card_accounts FOR SELECT
  USING (church_id = public.get_church_id());

COMMENT ON TABLE card_accounts IS
  'Per-member neo-banking account (DDA sub-account via i2c). Balance in micro-USD.';

-- ============================================
-- CARD_TRANSFERS — send/receive/ACH audit log
-- ============================================

CREATE TABLE IF NOT EXISTS card_transfers (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id           UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  person_id           UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  card_account_id     UUID REFERENCES card_accounts(id) ON DELETE SET NULL,

  direction           TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  transfer_type       TEXT NOT NULL CHECK (transfer_type IN ('member', 'ach', 'bank', 'give', 'receive')),
  counterparty_name   TEXT NOT NULL,
  counterparty_ref    TEXT,

  amount_micro_usd    BIGINT NOT NULL CHECK (amount_micro_usd > 0),
  memo                TEXT,
  status              TEXT NOT NULL DEFAULT 'pending'
                      CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  i2c_transfer_id     TEXT,
  failure_reason      TEXT,

  initiated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at        TIMESTAMPTZ,
  metadata            JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_card_transfers_church_person
  ON card_transfers(church_id, person_id, initiated_at DESC);

CREATE INDEX IF NOT EXISTS idx_card_transfers_status
  ON card_transfers(church_id, status);

ALTER TABLE card_transfers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "card_transfers read own church" ON card_transfers;
CREATE POLICY "card_transfers read own church"
  ON card_transfers FOR SELECT
  USING (church_id = public.get_church_id());

COMMENT ON TABLE card_transfers IS
  'Append-only transfer requests (Send/Receive/Give) routed through i2c.';

-- ============================================
-- IMPACT_ROUTES — member cause/fund routing
-- ============================================

CREATE TABLE IF NOT EXISTS impact_routes (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id       UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  person_id       UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  route_label     TEXT NOT NULL,
  route_fund      TEXT NOT NULL DEFAULT 'tithe',
  set_by          TEXT NOT NULL DEFAULT 'member'
                  CHECK (set_by IN ('member', 'staff', 'system')),
  effective_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata        JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_impact_routes_person_current
  ON impact_routes(church_id, person_id);

ALTER TABLE impact_routes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impact_routes read own church" ON impact_routes;
CREATE POLICY "impact_routes read own church"
  ON impact_routes FOR SELECT
  USING (church_id = public.get_church_id());

COMMENT ON TABLE impact_routes IS
  'Current Card Impact destination for a member (e.g. Food Pantry, Tithe).';

-- ============================================
-- IMPACT_ALLOCATIONS — monthly Card Impact credits
-- ============================================

CREATE TABLE IF NOT EXISTS impact_allocations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id           UUID NOT NULL REFERENCES churches(id) ON DELETE RESTRICT,
  person_id             UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,

  period_month          DATE NOT NULL,
  amount_micro_usd      BIGINT NOT NULL CHECK (amount_micro_usd >= 0),
  route_label           TEXT,
  source                TEXT NOT NULL DEFAULT 'interchange'
                        CHECK (source IN ('interchange', 'manual', 'adjustment')),

  metadata              JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (church_id, person_id, period_month, source)
);

CREATE INDEX IF NOT EXISTS idx_impact_allocations_church_month
  ON impact_allocations(church_id, period_month DESC);

ALTER TABLE impact_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impact_allocations read own church" ON impact_allocations;
CREATE POLICY "impact_allocations read own church"
  ON impact_allocations FOR SELECT
  USING (church_id = public.get_church_id());

COMMENT ON TABLE impact_allocations IS
  'Monthly Card Impact credited to member/church/cause from interchange fees.';
