/**
 * The shared attention vocabulary — one set of names for "how urgently
 * does a human need to look at this", used across every signal surface
 * (Action Bar, notification bell, and future consumers) instead of each
 * one inventing its own severity language.
 *
 * GRACE already has four PARALLEL status vocabularies that don't talk to
 * each other: StatusBadge variants, Decision Queue severity
 * (critical|high|normal), agent-finding severity+lifecycle, and
 * work-order status. This module does not replace any of them — each
 * still means what it always meant for its own domain — it gives them a
 * common target to classify INTO when a surface needs to decide how much
 * visual weight something gets. Classification stays per-surface (a
 * decision-queue item and a realtime notification don't carry the same
 * fields), but the four resulting buckets and their colors are shared.
 *
 * Rule of thumb for classifying into a bucket:
 *   urgent        — stop what you're doing (crisis, a critical-risk item)
 *   blocked       — a system is stuck, not a person's judgment call
 *   needs_review  — awaiting a human decision, not yet urgent
 *   informational — routine, no action implied
 *
 * "needs_review" must never be presented as already resolved, approved,
 * or agent-handled — it exists specifically to mark the human-review gap.
 */

export type AttentionState = 'informational' | 'needs_review' | 'blocked' | 'urgent';

/** src/components/ui/StatusBadge.tsx's variant vocabulary. */
export type AttentionBadgeVariant = 'urgent' | 'normal' | 'warning' | 'low';

const ATTENTION_RANK: Record<AttentionState, number> = {
  urgent: 0,
  blocked: 1,
  needs_review: 2,
  informational: 3,
};

/** Lower rank = more attention-worthy. Use to pick the worst of a set. */
export function attentionRank(attention: AttentionState): number {
  return ATTENTION_RANK[attention];
}

export function moreUrgent(a: AttentionState, b: AttentionState): AttentionState {
  return ATTENTION_RANK[a] <= ATTENTION_RANK[b] ? a : b;
}

/**
 * Maps an attention state onto StatusBadge's variant vocabulary. Reserves
 * the brand/red "urgent" tone for genuine urgency — see the color
 * discipline notes in NotificationCenter.tsx and DashboardPulse.tsx that
 * predate this module and that this mapping is written to preserve.
 */
export function attentionBadgeVariant(attention: AttentionState): AttentionBadgeVariant {
  switch (attention) {
    case 'urgent': return 'urgent';
    case 'blocked': return 'warning';
    case 'needs_review': return 'normal';
    case 'informational': return 'low';
  }
}
