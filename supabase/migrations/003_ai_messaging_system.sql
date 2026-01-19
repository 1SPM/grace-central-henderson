-- AI Messaging System Schema
-- Adds support for content calendar, message scheduling, and reply handling

-- ============================================
-- SCHEDULED MESSAGES
-- Stores all planned/scheduled outgoing messages
-- ============================================
CREATE TABLE scheduled_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Message content
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  subject VARCHAR(255),
  body TEXT NOT NULL,

  -- Scheduling
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'sent', 'failed', 'cancelled')),

  -- Source tracking
  source_type VARCHAR(30) NOT NULL CHECK (source_type IN ('manual', 'drip_campaign', 'birthday', 'anniversary', 'donation', 'follow_up', 'ai_generated')),
  source_agent VARCHAR(50),
  campaign_id UUID,

  -- AI metadata
  ai_generated BOOLEAN DEFAULT false,
  ai_prompt TEXT,

  -- Tracking
  external_message_id VARCHAR(255),
  error_message TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_messages_church_date ON scheduled_messages(church_id, scheduled_for);
CREATE INDEX idx_scheduled_messages_status ON scheduled_messages(status) WHERE status = 'scheduled';
CREATE INDEX idx_scheduled_messages_person ON scheduled_messages(person_id);

-- ============================================
-- MESSAGE ARCHIVE
-- Historical record of all sent messages
-- ============================================
CREATE TABLE message_archive (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  scheduled_message_id UUID REFERENCES scheduled_messages(id) ON DELETE SET NULL,

  -- Message details
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms')),
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  subject VARCHAR(255),
  body TEXT NOT NULL,

  -- Delivery info
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  replied_at TIMESTAMPTZ,

  -- Provider info
  provider VARCHAR(20) CHECK (provider IN ('resend', 'twilio')),
  external_id VARCHAR(255),

  -- Status
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed')),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_message_archive_church ON message_archive(church_id);
CREATE INDEX idx_message_archive_person ON message_archive(church_id, person_id);
CREATE INDEX idx_message_archive_sent ON message_archive(sent_at DESC);

-- ============================================
-- INBOUND MESSAGES
-- Stores replies and incoming messages
-- ============================================
CREATE TABLE inbound_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE SET NULL,

  -- Message content
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms')),
  from_address VARCHAR(255) NOT NULL,
  subject VARCHAR(255),
  body TEXT NOT NULL,

  -- AI classification
  ai_category VARCHAR(30) CHECK (ai_category IN ('question', 'thanks', 'concern', 'prayer_request', 'event_rsvp', 'unsubscribe', 'spam', 'other')),
  ai_sentiment VARCHAR(20) CHECK (ai_sentiment IN ('positive', 'neutral', 'negative', 'urgent')),
  ai_suggested_response TEXT,
  ai_confidence DECIMAL(3,2),

  -- Status
  status VARCHAR(20) DEFAULT 'new' CHECK (status IN ('new', 'read', 'replied', 'archived', 'flagged')),
  replied_at TIMESTAMPTZ,
  replied_by UUID REFERENCES users(id) ON DELETE SET NULL,

  -- Linking
  in_reply_to UUID REFERENCES message_archive(id) ON DELETE SET NULL,

  received_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_inbound_messages_church ON inbound_messages(church_id);
CREATE INDEX idx_inbound_messages_status ON inbound_messages(status) WHERE status = 'new';
CREATE INDEX idx_inbound_messages_person ON inbound_messages(person_id);

-- ============================================
-- DAILY DIGESTS
-- Stores AI-generated daily summaries
-- ============================================
CREATE TABLE daily_digests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Content
  digest_date DATE NOT NULL,
  priority_tasks JSONB NOT NULL DEFAULT '[]',
  people_to_contact JSONB NOT NULL DEFAULT '[]',
  messages_to_send JSONB NOT NULL DEFAULT '[]',
  birthdays_today JSONB NOT NULL DEFAULT '[]',
  follow_ups_due JSONB NOT NULL DEFAULT '[]',

  -- AI insights
  ai_summary TEXT,
  ai_recommendations JSONB DEFAULT '[]',

  -- Status
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  viewed_at TIMESTAMPTZ,

  UNIQUE(church_id, user_id, digest_date)
);

CREATE INDEX idx_daily_digests_lookup ON daily_digests(church_id, user_id, digest_date);

-- ============================================
-- DRIP CAMPAIGNS
-- Defines automated message sequences
-- ============================================
CREATE TABLE drip_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE NOT NULL,

  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(30) NOT NULL CHECK (trigger_type IN ('new_member', 'new_visitor', 'donation', 'event_registration', 'manual')),

  is_active BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_drip_campaigns_church ON drip_campaigns(church_id);

-- ============================================
-- DRIP CAMPAIGN STEPS
-- Individual messages in a drip sequence
-- ============================================
CREATE TABLE drip_campaign_steps (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE CASCADE NOT NULL,

  step_number INT NOT NULL,
  delay_days INT NOT NULL DEFAULT 0,
  delay_hours INT NOT NULL DEFAULT 0,

  channel VARCHAR(20) NOT NULL CHECK (channel IN ('email', 'sms', 'both')),
  subject VARCHAR(255),
  body TEXT NOT NULL,

  use_ai_personalization BOOLEAN DEFAULT false,
  ai_prompt TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(campaign_id, step_number)
);

CREATE INDEX idx_drip_steps_campaign ON drip_campaign_steps(campaign_id);

-- ============================================
-- DRIP CAMPAIGN ENROLLMENTS
-- Tracks people enrolled in campaigns
-- ============================================
CREATE TABLE drip_campaign_enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID REFERENCES drip_campaigns(id) ON DELETE CASCADE NOT NULL,
  person_id UUID REFERENCES people(id) ON DELETE CASCADE NOT NULL,

  current_step INT NOT NULL DEFAULT 1,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'cancelled')),

  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  next_message_at TIMESTAMPTZ,

  UNIQUE(campaign_id, person_id)
);

CREATE INDEX idx_enrollments_campaign ON drip_campaign_enrollments(campaign_id);
CREATE INDEX idx_enrollments_next ON drip_campaign_enrollments(next_message_at) WHERE status = 'active';

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE scheduled_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_archive ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_digests ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaign_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_campaign_enrollments ENABLE ROW LEVEL SECURITY;

-- Policies for scheduled_messages
CREATE POLICY "Users can view scheduled_messages for their church" ON scheduled_messages
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert scheduled_messages for their church" ON scheduled_messages
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can update scheduled_messages for their church" ON scheduled_messages
  FOR UPDATE USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can delete scheduled_messages for their church" ON scheduled_messages
  FOR DELETE USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Policies for message_archive
CREATE POLICY "Users can view message_archive for their church" ON message_archive
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert message_archive for their church" ON message_archive
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Policies for inbound_messages
CREATE POLICY "Users can view inbound_messages for their church" ON inbound_messages
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can update inbound_messages for their church" ON inbound_messages
  FOR UPDATE USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can insert inbound_messages for their church" ON inbound_messages
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Policies for daily_digests
CREATE POLICY "Users can view their own daily_digests" ON daily_digests
  FOR SELECT USING (
    user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)
    OR church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text AND role = 'admin')
  );

CREATE POLICY "Users can insert daily_digests for their church" ON daily_digests
  FOR INSERT WITH CHECK (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Policies for drip_campaigns
CREATE POLICY "Users can view drip_campaigns for their church" ON drip_campaigns
  FOR SELECT USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

CREATE POLICY "Users can manage drip_campaigns for their church" ON drip_campaigns
  FOR ALL USING (
    church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
  );

-- Policies for drip_campaign_steps
CREATE POLICY "Users can view drip_campaign_steps for their campaigns" ON drip_campaign_steps
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

CREATE POLICY "Users can manage drip_campaign_steps for their campaigns" ON drip_campaign_steps
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

-- Policies for drip_campaign_enrollments
CREATE POLICY "Users can view enrollments for their campaigns" ON drip_campaign_enrollments
  FOR SELECT USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

CREATE POLICY "Users can manage enrollments for their campaigns" ON drip_campaign_enrollments
  FOR ALL USING (
    campaign_id IN (
      SELECT id FROM drip_campaigns
      WHERE church_id IN (SELECT church_id FROM users WHERE clerk_id = auth.uid()::text)
    )
  );

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to get pending scheduled messages
CREATE OR REPLACE FUNCTION get_pending_messages(p_church_id UUID)
RETURNS TABLE (
  id UUID,
  person_id UUID,
  person_name TEXT,
  channel VARCHAR(20),
  subject VARCHAR(255),
  body TEXT,
  scheduled_for TIMESTAMPTZ,
  source_type VARCHAR(30)
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    sm.id,
    sm.person_id,
    COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') as person_name,
    sm.channel,
    sm.subject,
    sm.body,
    sm.scheduled_for,
    sm.source_type
  FROM scheduled_messages sm
  LEFT JOIN people p ON sm.person_id = p.id
  WHERE sm.church_id = p_church_id
    AND sm.status = 'scheduled'
    AND sm.scheduled_for <= NOW()
  ORDER BY sm.scheduled_for ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get daily digest data
CREATE OR REPLACE FUNCTION get_daily_digest_data(p_church_id UUID, p_date DATE)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'birthdays', (
      SELECT json_agg(json_build_object(
        'id', id,
        'name', first_name || ' ' || last_name,
        'email', email,
        'phone', phone
      ))
      FROM people
      WHERE church_id = p_church_id
        AND EXTRACT(MONTH FROM birth_date) = EXTRACT(MONTH FROM p_date)
        AND EXTRACT(DAY FROM birth_date) = EXTRACT(DAY FROM p_date)
    ),
    'scheduled_messages', (
      SELECT json_agg(json_build_object(
        'id', sm.id,
        'person_name', COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
        'channel', sm.channel,
        'scheduled_for', sm.scheduled_for,
        'source_type', sm.source_type
      ))
      FROM scheduled_messages sm
      LEFT JOIN people p ON sm.person_id = p.id
      WHERE sm.church_id = p_church_id
        AND sm.status = 'scheduled'
        AND DATE(sm.scheduled_for) = p_date
    ),
    'pending_tasks', (
      SELECT json_agg(json_build_object(
        'id', t.id,
        'title', t.title,
        'priority', t.priority,
        'person_name', COALESCE(p.first_name || ' ' || p.last_name, NULL),
        'due_date', t.due_date
      ))
      FROM tasks t
      LEFT JOIN people p ON t.person_id = p.id
      WHERE t.church_id = p_church_id
        AND t.completed = false
        AND DATE(t.due_date) <= p_date
      ORDER BY t.priority DESC, t.due_date ASC
      LIMIT 20
    ),
    'new_inbound', (
      SELECT COUNT(*)
      FROM inbound_messages
      WHERE church_id = p_church_id
        AND status = 'new'
    )
  ) INTO result;

  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
