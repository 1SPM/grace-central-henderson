/**
 * Dedup rule for agent_findings, shared by the cron runner and the
 * Command Centre workflow route so both apply the exact same logic.
 *
 * A new finding for a given (church_id, dedup_key) is skipped when:
 *   - an existing row with that key is still open/triaged/actioned (the
 *     condition hasn't been resolved yet — don't pile up duplicates), or
 *   - the most recently created row with that key is dismissed and its
 *     suppress_until is still in the future (the operator explicitly
 *     said "don't show me this again for a while").
 *
 * A dismissed row whose suppression has expired, or no existing rows at
 * all, allows a fresh finding through.
 */

export type AgentFindingStatus = 'open' | 'triaged' | 'actioned' | 'resolved' | 'dismissed';

export interface ExistingFindingForDedup {
  status: AgentFindingStatus;
  suppress_until: string | null;
  created_at: string;
}

const ACTIVE_STATUSES: ReadonlySet<AgentFindingStatus> = new Set(['open', 'triaged', 'actioned']);

export function shouldSkipFinding(existing: ExistingFindingForDedup[], now: Date): boolean {
  if (existing.some(row => ACTIVE_STATUSES.has(row.status))) return true;

  const dismissed = existing
    .filter(row => row.status === 'dismissed')
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  const mostRecentDismissed = dismissed[0];
  if (mostRecentDismissed?.suppress_until && new Date(mostRecentDismissed.suppress_until) > now) {
    return true;
  }

  return false;
}
