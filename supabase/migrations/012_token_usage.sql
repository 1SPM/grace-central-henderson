-- GRACE CRM — AI token usage + budget caps (Sprint 2)
-- Migration: 012_token_usage.sql
--
-- Resolves TD-007. Every AI inference call writes one row here; the
-- gateway (api/_lib/ai/gateway.ts) reads the rolling monthly total
-- before each call and refuses any tenant whose spend would exceed
-- their cap.
--
-- RLS posture (matches audit_logs, migration 010):
--   - RLS enabled
--   - SELECT scoped to own church
--   - No INSERT/UPDATE/DELETE policy → service-role only writes
--   - UPDATE/DELETE blocked by trigger; usage history is append-only
--
-- All statements idempotent (IF NOT EXISTS / DROP-then-CREATE).

-- ============================================
-- TOKEN USAGE
-- ============================================

CREATE TABLE IF NOT EXISTS token_usage (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id         UUID REFERENCES churches(id) ON DELETE SET NULL,

  -- WHICH MODEL
  provider          TEXT NOT NULL,                      -- 'gemini' | 'claude' | 'openai' | 'hermes'
  model             TEXT NOT NULL,                      -- e.g. 'gemini-2.0-flash', 'claude-3-5-sonnet'

  -- WHICH FEATURE (so we can attribute spend per product surface)
  feature           TEXT NOT NULL,                      -- e.g. 'ask-grace', 'draft-reply', 'member-care'

  -- USAGE
  prompt_tokens     INTEGER NOT NULL CHECK (prompt_tokens     >= 0),
  completion_tokens INTEGER NOT NULL CHECK (completion_tokens >= 0),
  total_tokens      INTEGER GENERATED ALWAYS AS (prompt_tokens + completion_tokens) STORED,

  -- COST in micro-dollars (1 USD = 1,000,000 micro). BIGINT so a single
  -- runaway call cannot overflow the per-row column.
  cost_micro_usd    BIGINT NOT NULL CHECK (cost_micro_usd >= 0),

  -- RESULT
  success           BOOLEAN NOT NULL,
  error_code        TEXT,                                -- 'quota_exceeded' | 'moderation_block' | upstream code
  latency_ms        INTEGER,

  -- CORRELATION
  request_id        TEXT,                                -- propagated from audit_logs
  actor_clerk_id    TEXT,                                -- who triggered the call

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot-path index: rolling-month sum per tenant. Used on every gateway call.
CREATE INDEX IF NOT EXISTS idx_token_usage_church_time
  ON token_usage(church_id, created_at DESC);

-- Per-feature drilldown
CREATE INDEX IF NOT EXISTS idx_token_usage_feature_time
  ON token_usage(church_id, feature, created_at DESC);

-- Anomaly cron — pulls last hour vs trailing 7-day window
CREATE INDEX IF NOT EXISTS idx_token_usage_time
  ON token_usage(created_at DESC);

-- ============================================
-- ROW-LEVEL SECURITY
-- ============================================

ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "token_usage read own church" ON token_usage;
CREATE POLICY "token_usage read own church"
  ON token_usage FOR SELECT
  USING (church_id IS NOT NULL AND church_id = public.get_church_id());

-- No INSERT/UPDATE/DELETE policy → service-role only writes.

-- Append-only guarantee
CREATE OR REPLACE FUNCTION public.token_usage_block_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'token_usage is append-only; UPDATE/DELETE are not permitted (op=%)', TG_OP;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_token_usage_no_update ON token_usage;
CREATE TRIGGER trig_token_usage_no_update
  BEFORE UPDATE OR DELETE ON token_usage
  FOR EACH ROW EXECUTE FUNCTION public.token_usage_block_mutation();

COMMENT ON TABLE token_usage IS
  'Append-only AI inference ledger. Written by api/_lib/ai/gateway.ts on every call. cost_micro_usd is the source of truth for tenant spend; pricing is calculated from per-model rates in api/_lib/ai/pricing.ts.';

-- ============================================
-- CHURCH AI BUDGETS
-- ============================================
-- Separate table (not churches.settings JSONB) so we get auditable
-- history of budget changes and can attach per-feature caps later
-- without schema migration.

CREATE TABLE IF NOT EXISTS church_ai_budgets (
  church_id              UUID PRIMARY KEY REFERENCES churches(id) ON DELETE CASCADE,

  -- Monthly cap in micro-USD. Default $50/mo = 50_000_000.
  monthly_cap_micro_usd  BIGINT NOT NULL DEFAULT 50000000 CHECK (monthly_cap_micro_usd >= 0),

  -- Hard cutoff multiplier (1.10 = block at 110% of cap; service role
  -- bypass is intentionally NOT possible). NUMERIC to allow 1.0 - 2.0.
  hard_cutoff_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.10
    CHECK (hard_cutoff_multiplier >= 1.0 AND hard_cutoff_multiplier <= 5.0),

  -- Audit
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by_clerk_id    TEXT
);

ALTER TABLE church_ai_budgets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_budgets read own church" ON church_ai_budgets;
CREATE POLICY "ai_budgets read own church"
  ON church_ai_budgets FOR SELECT
  USING (church_id = public.get_church_id());

-- Writes via service role only (admin-tool path).

COMMENT ON TABLE church_ai_budgets IS
  'Per-tenant AI spending caps. Defaults to $50/mo at creation; admin tool updates via service role. The gateway refuses calls past monthly_cap; hard-cuts past cap × hard_cutoff_multiplier.';
