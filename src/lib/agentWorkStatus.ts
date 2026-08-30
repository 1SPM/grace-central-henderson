/**
 * Shared vocabulary for "AI work cards" — the label, badge color, and
 * boundary statement every agent-status surface should show, defined once.
 *
 * Two real surfaces render this today (AgentCommandCentre.tsx's per-agent
 * cards, MyWorkPanel.tsx's AgentActivityRow) and used to each hand-roll
 * their own copy of the label/variant maps — MyWorkPanel's was a silent
 * subset of AgentCommandCentre's, one edit away from drifting apart. This
 * is that shared definition.
 *
 * Deliberately NOT collapsed onto attentionPolicy.ts's four-state
 * AttentionState vocabulary: that module answers "how urgently does a
 * human need to look at this," which fits a decision-queue item or a
 * notification. An agent run's status answers a different question —
 * "did this execute, and how" — and StatusBadge's finer palette
 * (success/info/default distinct from each other) carries real signal
 * here that collapsing to four buckets would flatten. AgentWorkStatus
 * values are the actual `agent_runs.status` values verbatim — never
 * relabeled into a different vocabulary — because relabeling a real
 * status into an approximate word is exactly the kind of imprecision
 * these cards exist to avoid.
 */
import type { BadgeVariant } from '../components/ui/StatusBadge';

export type AgentWorkStatus =
  | 'not_implemented'
  | 'not_yet_run'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export const AGENT_WORK_STATUS_LABEL: Record<AgentWorkStatus, string> = {
  not_implemented: 'Not yet implemented',
  not_yet_run: 'Not yet run',
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Ran successfully',
  failed: 'Last run failed',
  cancelled: 'Cancelled',
};

export const AGENT_WORK_STATUS_VARIANT: Record<AgentWorkStatus, BadgeVariant> = {
  not_implemented: 'low',
  not_yet_run: 'default',
  queued: 'info',
  running: 'info',
  succeeded: 'success',
  failed: 'urgent',
  cancelled: 'low',
};

function isAgentWorkStatus(status: string): status is AgentWorkStatus {
  return status in AGENT_WORK_STATUS_LABEL;
}

/** Server-computed status arrives as a plain `string`; these two look it up
 * against the known vocabulary with the same graceful fallback the
 * call sites always had, just centralized instead of copy-pasted. */
export function agentWorkStatusLabel(status: string): string {
  return isAgentWorkStatus(status) ? AGENT_WORK_STATUS_LABEL[status] : status;
}

export function agentWorkStatusVariant(status: string): BadgeVariant {
  return isAgentWorkStatus(status) ? AGENT_WORK_STATUS_VARIANT[status] : 'default';
}

/**
 * The "clear boundary: what the AI did not do" line the product spec
 * requires per card. One sentence, reused verbatim everywhere an agent's
 * status is shown, rather than each surface writing (and inevitably
 * drifting on) its own version of the same claim. Accurate for every
 * agent in api/_lib/agentRegistry.ts: none can act outside its assigned
 * ministry area, and every consequential action — see
 * api/_lib/actionCatalog.ts's requiresApproval field — stops at a human
 * via agentActionExecutors.ts, never executes from the agent side alone.
 */
export const AGENT_WORK_BOUNDARY_STATEMENT =
  "Runs only within its assigned ministry area. Cannot send messages, alter records, or take a consequential action without a human's approval.";
