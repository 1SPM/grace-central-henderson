-- GRACE — Finance ledgers + related-party governance flag
-- Migration: 044_finance_and_governance_extensions.sql
--
-- Three additions, extracted from reviewing a real church's audited
-- financial statement for ideas worth generalizing into the product:
--
--   1. gift_in_kind_transactions — a real ledger for donated food/
--      clothing/toys (contribution/distribution), so a church running a
--      food pantry or clothing closet has somewhere to record it instead
--      of nowhere. Staff-only (no person_id / member self-access).
--   2. expenses — GRACE has never tracked expenses, only income
--      (`giving`). This is a minimal ledger with a functional_category
--      split (program vs. general & administrative) specifically so a
--      program-expense-ratio KPI can be computed — not a general-ledger
--      replacement.
--   3. approvals gains a related-party-transaction flag. Heuristic,
--      human-reviewed, never auto-clearing — same convention as
--      care_requests.crisis_flagged / prayer_requests.crisis_flagged:
--      surface a disclosure question for a human, never a determination.
--
-- Idempotent throughout.

-- ============================================
-- 1. gift_in_kind_transactions
-- ============================================

CREATE TABLE IF NOT EXISTS gift_in_kind_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('food', 'clothing', 'toys', 'household', 'other')),
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('contribution', 'distribution')),
  description TEXT,
  quantity NUMERIC,
  quantity_unit TEXT,
  estimated_value NUMERIC CHECK (estimated_value >= 0),
  recorded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  occurred_at DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gift_in_kind_church_category ON gift_in_kind_transactions(church_id, category, occurred_at);

ALTER TABLE gift_in_kind_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON gift_in_kind_transactions;
CREATE POLICY "tenant_isolation" ON gift_in_kind_transactions FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE gift_in_kind_transactions IS
  'Donated-goods ledger (food/clothing/toys/household/other), tracked as contribution/distribution transactions so a running balance per category can be computed. Staff-only — no member self-access policy, matching the absence of a person_id column.';

-- ============================================
-- 2. expenses
-- ============================================

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  functional_category TEXT NOT NULL CHECK (functional_category IN ('program', 'g_and_a')),
  category TEXT NOT NULL,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  fund TEXT,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  recorded_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expenses_church_date ON expenses(church_id, expense_date);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON expenses;
CREATE POLICY "tenant_isolation" ON expenses FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE expenses IS
  'Minimal expense ledger, functionally split program vs. general & administrative, specifically to compute a program-expense-ratio KPI (a standard nonprofit transparency metric). Not a general-ledger replacement — no vendor/AP workflow, no accrual/lease/debt tracking. Staff-only.';
COMMENT ON COLUMN expenses.functional_category IS
  'program = directly attributable to a ministry program. g_and_a = general & administrative overhead. Mirrors the two-column split required on a nonprofit statement of functional expenses.';

-- ============================================
-- 3. approvals: related-party transaction flag
-- ============================================

ALTER TABLE approvals ADD COLUMN IF NOT EXISTS related_party_flagged BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS related_party_reviewed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE approvals ADD COLUMN IF NOT EXISTS related_party_reviewed_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_approvals_related_party ON approvals(church_id) WHERE related_party_flagged;

COMMENT ON COLUMN approvals.related_party_flagged IS
  'Set automatically when a proposed action names a counterparty whose name matches a current leadership user''s last name (see api/_lib/relatedPartyCheck.ts) — a coarse heuristic surfacing a disclosure question for a human, never a determination. Never cleared automatically; see related_party_reviewed_at.';
COMMENT ON COLUMN approvals.related_party_reviewed_at IS
  'Set when a staff member with approvals.decide explicitly marks a related_party_flagged approval as reviewed. NULL means still awaiting review even if the approval itself has since been decided.';

-- ============================================
-- 4. Permission keys: finance.gift_in_kind.*, finance.expenses.*
-- ============================================

INSERT INTO permissions (key, module, action, sensitivity, description) VALUES
  ('finance.gift_in_kind.view',   'finance', 'gift_in_kind.view',   'internal',   'View the gift-in-kind (donated goods) ledger and balances'),
  ('finance.gift_in_kind.manage', 'finance', 'gift_in_kind.manage', 'internal',   'Record gift-in-kind contributions and distributions'),
  ('finance.expenses.view',       'finance', 'expenses.view',       'restricted', 'View recorded expenses and the program/G&A ratio'),
  ('finance.expenses.manage',     'finance', 'expenses.manage',     'restricted', 'Record expenses')
ON CONFLICT (key) DO NOTHING;

DO $$
DECLARE
  grants JSONB := '{
    "system_administrator": ["finance.gift_in_kind.view","finance.gift_in_kind.manage","finance.expenses.view","finance.expenses.manage"],
    "finance":              ["finance.gift_in_kind.view","finance.gift_in_kind.manage","finance.expenses.view","finance.expenses.manage"],
    "executive_leadership": ["finance.gift_in_kind.view","finance.expenses.view"],
    "senior_pastor":        ["finance.gift_in_kind.view","finance.expenses.view"],
    "auditor":               ["finance.gift_in_kind.view","finance.expenses.view"]
  }'::jsonb;
  role_key TEXT;
  perm_key TEXT;
BEGIN
  FOR role_key IN SELECT jsonb_object_keys(grants) LOOP
    FOR perm_key IN SELECT jsonb_array_elements_text(grants -> role_key) LOOP
      INSERT INTO role_permissions (role_id, permission_id)
      SELECT r.id, p.id
      FROM roles r, permissions p
      WHERE r.key = role_key AND r.church_id IS NULL AND p.key = perm_key
      ON CONFLICT DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
