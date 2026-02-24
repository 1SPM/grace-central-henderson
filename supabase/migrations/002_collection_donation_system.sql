-- Collection & Donation Management System
-- Adds pledges, campaigns, donation batches, and recurring subscriptions
-- NOTE: All statements use IF NOT EXISTS / IF EXISTS for idempotent re-runs.

-- ============================================
-- CAMPAIGNS (Fundraising campaigns)
-- ============================================
CREATE TABLE IF NOT EXISTS campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  goal_amount DECIMAL(12, 2),
  start_date DATE NOT NULL,
  end_date DATE,
  fund VARCHAR(50) DEFAULT 'other',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_church ON campaigns(church_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_active ON campaigns(church_id, is_active);

-- ============================================
-- PLEDGES (Commitment tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS pledges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  frequency VARCHAR(20) DEFAULT 'one-time', -- one-time, weekly, monthly, quarterly, annually
  start_date DATE NOT NULL,
  end_date DATE,
  fund VARCHAR(50) DEFAULT 'tithe',
  status VARCHAR(20) DEFAULT 'active', -- active, completed, cancelled
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pledges_church ON pledges(church_id);
CREATE INDEX IF NOT EXISTS idx_pledges_person ON pledges(person_id);
CREATE INDEX IF NOT EXISTS idx_pledges_campaign ON pledges(campaign_id);
CREATE INDEX IF NOT EXISTS idx_pledges_status ON pledges(church_id, status);

-- ============================================
-- DONATION BATCHES (For in-person collections)
-- ============================================
CREATE TABLE IF NOT EXISTS donation_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  batch_date DATE NOT NULL,
  batch_name VARCHAR(255), -- e.g., "Sunday Morning Service 01/12/2025"
  status VARCHAR(20) DEFAULT 'open', -- open, closed, reconciled
  total_cash DECIMAL(10, 2) DEFAULT 0,
  total_checks DECIMAL(10, 2) DEFAULT 0,
  total_amount DECIMAL(10, 2) DEFAULT 0,
  check_count INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batches_church ON donation_batches(church_id);
CREATE INDEX IF NOT EXISTS idx_batches_date ON donation_batches(church_id, batch_date);
CREATE INDEX IF NOT EXISTS idx_batches_status ON donation_batches(church_id, status);

-- ============================================
-- BATCH ITEMS (Individual donations in a batch)
-- ============================================
CREATE TABLE IF NOT EXISTS batch_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  batch_id UUID REFERENCES donation_batches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  method VARCHAR(20) NOT NULL, -- cash, check
  fund VARCHAR(50) DEFAULT 'tithe',
  check_number VARCHAR(50),
  memo TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_batch_items_batch ON batch_items(batch_id);
CREATE INDEX IF NOT EXISTS idx_batch_items_person ON batch_items(person_id);

-- ============================================
-- RECURRING GIVING (Subscription tracking)
-- ============================================
CREATE TABLE IF NOT EXISTS recurring_giving (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  amount DECIMAL(10, 2) NOT NULL,
  frequency VARCHAR(20) NOT NULL, -- weekly, monthly, quarterly, annually
  fund VARCHAR(50) DEFAULT 'tithe',
  next_date DATE NOT NULL,
  stripe_subscription_id VARCHAR(255),
  stripe_customer_id VARCHAR(255),
  payment_method_last4 VARCHAR(4),
  payment_method_brand VARCHAR(20),
  status VARCHAR(20) DEFAULT 'active', -- active, paused, cancelled
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_church ON recurring_giving(church_id);
CREATE INDEX IF NOT EXISTS idx_recurring_person ON recurring_giving(person_id);
CREATE INDEX IF NOT EXISTS idx_recurring_status ON recurring_giving(church_id, status);
CREATE INDEX IF NOT EXISTS idx_recurring_next ON recurring_giving(church_id, next_date);

-- ============================================
-- GIVING STATEMENTS (Year-end tax statements)
-- ============================================
CREATE TABLE IF NOT EXISTS giving_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  year INTEGER NOT NULL,
  total_amount DECIMAL(12, 2) NOT NULL,
  by_fund JSONB DEFAULT '{}',
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  sent_method VARCHAR(20), -- email, print
  pdf_url TEXT
);

CREATE INDEX IF NOT EXISTS idx_statements_church ON giving_statements(church_id);
CREATE INDEX IF NOT EXISTS idx_statements_person ON giving_statements(person_id);
CREATE INDEX IF NOT EXISTS idx_statements_year ON giving_statements(church_id, year);

-- ============================================
-- Add batch_id and pledge_id to giving table
-- ============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'giving' AND column_name = 'batch_id') THEN
    ALTER TABLE giving ADD COLUMN batch_id UUID REFERENCES donation_batches(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'giving' AND column_name = 'pledge_id') THEN
    ALTER TABLE giving ADD COLUMN pledge_id UUID REFERENCES pledges(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'giving' AND column_name = 'campaign_id') THEN
    ALTER TABLE giving ADD COLUMN campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_giving_batch ON giving(batch_id);
CREATE INDEX IF NOT EXISTS idx_giving_pledge ON giving(pledge_id);
CREATE INDEX IF NOT EXISTS idx_giving_campaign ON giving(campaign_id);

-- ============================================
-- RLS Policies for new tables
-- ============================================
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE pledges ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_giving ENABLE ROW LEVEL SECURITY;
ALTER TABLE giving_statements ENABLE ROW LEVEL SECURITY;

-- Allow full access via service role key (used by the app)
-- Proper scoped policies are in 005_row_level_security.sql
DROP POLICY IF EXISTS "Service role full access" ON campaigns;
DROP POLICY IF EXISTS "Service role full access" ON pledges;
DROP POLICY IF EXISTS "Service role full access" ON donation_batches;
DROP POLICY IF EXISTS "Service role full access" ON batch_items;
DROP POLICY IF EXISTS "Service role full access" ON recurring_giving;
DROP POLICY IF EXISTS "Service role full access" ON giving_statements;

CREATE POLICY "Service role full access" ON campaigns FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pledges FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON donation_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON batch_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON recurring_giving FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON giving_statements FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Triggers for updated_at
-- ============================================
DROP TRIGGER IF EXISTS update_campaigns_updated_at ON campaigns;
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_pledges_updated_at ON pledges;
CREATE TRIGGER update_pledges_updated_at BEFORE UPDATE ON pledges
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_batches_updated_at ON donation_batches;
CREATE TRIGGER update_batches_updated_at BEFORE UPDATE ON donation_batches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS update_recurring_updated_at ON recurring_giving;
CREATE TRIGGER update_recurring_updated_at BEFORE UPDATE ON recurring_giving
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Helper function to calculate pledge fulfillment
-- ============================================
CREATE OR REPLACE FUNCTION calculate_pledge_fulfillment(pledge_uuid UUID)
RETURNS TABLE(
  total_pledged DECIMAL,
  total_given DECIMAL,
  percentage DECIMAL,
  remaining DECIMAL
) AS $$
DECLARE
  p pledges%ROWTYPE;
  total_pledged_amount DECIMAL;
  total_given_amount DECIMAL;
BEGIN
  SELECT * INTO p FROM pledges WHERE id = pledge_uuid;

  IF p.frequency = 'one-time' THEN
    total_pledged_amount := p.amount;
  ELSE
    -- Calculate based on frequency and date range
    total_pledged_amount := p.amount * (
      CASE p.frequency
        WHEN 'weekly' THEN CEIL((COALESCE(p.end_date, CURRENT_DATE) - p.start_date) / 7.0)
        WHEN 'monthly' THEN CEIL(EXTRACT(MONTH FROM AGE(COALESCE(p.end_date, CURRENT_DATE), p.start_date)) + 1)
        WHEN 'quarterly' THEN CEIL((EXTRACT(MONTH FROM AGE(COALESCE(p.end_date, CURRENT_DATE), p.start_date)) + 1) / 3.0)
        WHEN 'annually' THEN CEIL(EXTRACT(YEAR FROM AGE(COALESCE(p.end_date, CURRENT_DATE), p.start_date)) + 1)
        ELSE 1
      END
    );
  END IF;

  SELECT COALESCE(SUM(amount), 0) INTO total_given_amount
  FROM giving WHERE pledge_id = pledge_uuid;

  RETURN QUERY SELECT
    total_pledged_amount,
    total_given_amount,
    CASE WHEN total_pledged_amount > 0 THEN ROUND((total_given_amount / total_pledged_amount) * 100, 2) ELSE 0 END,
    GREATEST(total_pledged_amount - total_given_amount, 0);
END;
$$ LANGUAGE plpgsql;
