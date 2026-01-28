-- Agent Logging System
-- Provides persistent storage for AI agent execution logs and statistics

-- ============================================
-- AGENT LOGS
-- ============================================
CREATE TABLE agent_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  agent_id VARCHAR(100) NOT NULL,
  level VARCHAR(20) NOT NULL CHECK (level IN ('info', 'warning', 'error')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_logs_church ON agent_logs(church_id);
CREATE INDEX idx_agent_logs_agent ON agent_logs(agent_id);
CREATE INDEX idx_agent_logs_level ON agent_logs(level);
CREATE INDEX idx_agent_logs_created ON agent_logs(created_at DESC);

-- ============================================
-- AGENT STATS
-- ============================================
CREATE TABLE agent_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  agent_id VARCHAR(100) NOT NULL,
  total_actions INTEGER DEFAULT 0,
  successful_actions INTEGER DEFAULT 0,
  failed_actions INTEGER DEFAULT 0,
  last_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(church_id, agent_id)
);

CREATE INDEX idx_agent_stats_church ON agent_stats(church_id);

-- ============================================
-- AGENT EXECUTIONS (detailed run history)
-- ============================================
CREATE TABLE agent_executions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  church_id UUID REFERENCES churches(id) ON DELETE CASCADE,
  agent_id VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  dry_run BOOLEAN DEFAULT false,
  actions_executed INTEGER DEFAULT 0,
  actions_failed INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX idx_agent_executions_church ON agent_executions(church_id);
CREATE INDEX idx_agent_executions_agent ON agent_executions(agent_id);
CREATE INDEX idx_agent_executions_status ON agent_executions(status);

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to insert a log and auto-cleanup old logs
CREATE OR REPLACE FUNCTION insert_agent_log(
  p_church_id UUID,
  p_agent_id VARCHAR(100),
  p_level VARCHAR(20),
  p_message TEXT,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO agent_logs (church_id, agent_id, level, message, metadata)
  VALUES (p_church_id, p_agent_id, p_level, p_message, p_metadata)
  RETURNING id INTO v_log_id;

  -- Auto-cleanup: keep only last 1000 logs per church
  DELETE FROM agent_logs
  WHERE church_id = p_church_id
    AND id NOT IN (
      SELECT id FROM agent_logs
      WHERE church_id = p_church_id
      ORDER BY created_at DESC
      LIMIT 1000
    );

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update agent stats
CREATE OR REPLACE FUNCTION update_agent_stats(
  p_church_id UUID,
  p_agent_id VARCHAR(100),
  p_actions_executed INTEGER DEFAULT 0,
  p_actions_failed INTEGER DEFAULT 0
) RETURNS void AS $$
BEGIN
  INSERT INTO agent_stats (church_id, agent_id, total_actions, successful_actions, failed_actions, last_run_at)
  VALUES (
    p_church_id,
    p_agent_id,
    p_actions_executed + p_actions_failed,
    p_actions_executed,
    p_actions_failed,
    NOW()
  )
  ON CONFLICT (church_id, agent_id) DO UPDATE SET
    total_actions = agent_stats.total_actions + EXCLUDED.total_actions,
    successful_actions = agent_stats.successful_actions + EXCLUDED.successful_actions,
    failed_actions = agent_stats.failed_actions + EXCLUDED.failed_actions,
    last_run_at = NOW(),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================
ALTER TABLE agent_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_executions ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (via service role key)
CREATE POLICY "Service role can manage agent_logs"
  ON agent_logs FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage agent_stats"
  ON agent_stats FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role can manage agent_executions"
  ON agent_executions FOR ALL
  USING (true)
  WITH CHECK (true);
