-- ============================================================
-- 071 — Let `agent_actions` hold chat-originated proposals too
-- ============================================================
--
-- WHY
--
-- `agent_actions` was built (035) as the ledger for one door: an agent run
-- produces findings, findings become actions, a human decides them. Hence
-- `agent_run_id UUID NOT NULL`.
--
-- TD-061 is that the OTHER door — Ask GRACE — had no such lifecycle at all.
-- A staff member could have GRACE delete a person in one click, and in that
-- one case nothing was written anywhere: no audit row, and not even the
-- Interaction note the other chat actions leave, because the person the note
-- would attach to is the person being deleted.
--
-- The fix is not a second approvals system for chat. It is to let the
-- existing one carry chat proposals, so both doors share one ledger, one
-- Decision Queue, and one executor registry — which is the whole point of
-- the action catalog (api/_lib/actionCatalog.ts).
--
-- That requires two changes, both widening:
--
--   1. `agent_run_id` becomes nullable. A chat proposal has no agent run,
--      and inventing a synthetic one would corrupt agent-run analytics with
--      rows that never ran an agent.
--   2. `origin_surface` records which door proposed it, so "who asked for
--      this" survives. A CHECK keeps the two consistent: an agent-surface
--      action must have a run; a chat-surface one must not.
--
-- Existing rows are all agent-originated, so the backfill is unconditional
-- and the CHECK is satisfiable immediately.

-- ============================================
-- 1. Widen
-- ============================================

ALTER TABLE agent_actions ALTER COLUMN agent_run_id DROP NOT NULL;

ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS origin_surface TEXT;

-- Every row that exists today came from an agent run.
UPDATE agent_actions SET origin_surface = 'agent' WHERE origin_surface IS NULL;

ALTER TABLE agent_actions ALTER COLUMN origin_surface SET DEFAULT 'agent';
ALTER TABLE agent_actions ALTER COLUMN origin_surface SET NOT NULL;

-- ============================================
-- 2. Keep origin and provenance consistent
-- ============================================
--
-- Named so a violation reads clearly in an error: an agent action without a
-- run is an orphan, and a chat action WITH one is a mislabelled row that
-- would corrupt "what did the agents do" reporting.

ALTER TABLE agent_actions DROP CONSTRAINT IF EXISTS agent_actions_origin_run_consistent;
ALTER TABLE agent_actions ADD CONSTRAINT agent_actions_origin_run_consistent CHECK (
  (origin_surface = 'agent' AND agent_run_id IS NOT NULL)
  OR (origin_surface = 'chat' AND agent_run_id IS NULL)
);

-- Also record WHO proposed it. For agent rows this stays null (the agent is
-- named by its run); for chat rows it is the staff member who asked, which
-- is the other half of accountability from the human who later decides.
ALTER TABLE agent_actions ADD COLUMN IF NOT EXISTS proposed_by_user_id UUID
  REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_agent_actions_origin
  ON agent_actions(church_id, origin_surface, status);

COMMENT ON COLUMN agent_actions.origin_surface IS
  'Which door proposed this action: agent (a scanner run) or chat (a staff member via Ask GRACE). Constrained against agent_run_id so provenance cannot be misreported.';
COMMENT ON COLUMN agent_actions.proposed_by_user_id IS
  'For chat-originated actions, the staff member who asked for it. Null for agent-originated rows, which are attributed via their agent_run.';
