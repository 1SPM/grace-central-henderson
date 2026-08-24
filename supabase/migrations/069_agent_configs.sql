-- 069_agent_configs.sql
--
-- Per-church configuration for the agents in api/_lib/agentRegistry.ts —
-- what the pastor tells an agent to do, distinct from what agents.ts says
-- an agent IS. The registry (name, role, description, implemented) stays
-- code, the same church for every tenant; this table is the one thing a
-- pastor can actually set: free-text instructions and a short task list,
-- per agent, per church. Same split as ministry_assignments overlaying
-- MINISTRY_AREAS — code defines the shape, this table records a decision.
--
-- A missing row means "no instructions set yet" — shown honestly in the
-- UI, never backfilled with a plausible-sounding default.

CREATE TABLE IF NOT EXISTS agent_configs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  church_id          UUID NOT NULL REFERENCES churches(id) ON DELETE CASCADE,
  -- Matches AgentDefinition.key in api/_lib/agentRegistry.ts. Text, not an
  -- enum: the agent list is versioned in code, and an unknown key here is
  -- ignored by the API rather than breaking a deploy.
  agent_key          TEXT NOT NULL,
  instructions       TEXT,
  tasks              TEXT[] NOT NULL DEFAULT '{}',
  updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (church_id, agent_key)
);

CREATE INDEX IF NOT EXISTS idx_agent_configs_church ON agent_configs(church_id);

ALTER TABLE agent_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation" ON agent_configs;
CREATE POLICY "tenant_isolation" ON agent_configs FOR ALL
  USING (church_id = public.get_church_id())
  WITH CHECK (church_id = public.get_church_id());

COMMENT ON TABLE agent_configs IS
  'Per-church agent instructions and task list, set by the pastor. Agent identity/capability stays in code (api/_lib/agentRegistry.ts); this is the configurable overlay. Absent row = no instructions set yet.';
COMMENT ON COLUMN agent_configs.instructions IS
  'Free-text guidance for this agent — what the pastor wants it to focus on or avoid. NULL is a real, honestly-shown state, not backfilled.';
COMMENT ON COLUMN agent_configs.tasks IS
  'Short discrete task/responsibility strings for this agent, pastor-authored. Empty array is the default, shown as such.';
