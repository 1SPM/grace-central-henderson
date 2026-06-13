-- Church subscription billing columns (Stripe SaaS lifecycle)
-- Migration: 025_church_subscription.sql

ALTER TABLE churches
  ADD COLUMN IF NOT EXISTS subscription_plan TEXT NOT NULL DEFAULT 'starter'
    CHECK (subscription_plan IN ('starter', 'pro', 'enterprise')),
  ADD COLUMN IF NOT EXISTS subscription_status TEXT
    CHECK (subscription_status IS NULL OR subscription_status IN (
      'incomplete', 'trial', 'active', 'past_due', 'canceled', 'unpaid',
      'incomplete_expired'
    )),
  ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_churches_subscription
  ON churches(subscription_plan, subscription_status);

COMMENT ON COLUMN churches.subscription_plan IS 'SaaS plan slug — gates Financial Hub, agents, card program.';
COMMENT ON COLUMN churches.subscription_status IS 'Stripe subscription lifecycle; trial/active earn entitlements.';
