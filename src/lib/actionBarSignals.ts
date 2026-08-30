/**
 * Groups raw Decision Queue items into the compact chips the persistent
 * Action Bar renders. Pure derivation only — no new server types, no
 * invented data. Attention state is a deterministic mapping from the
 * queue's existing severity (plus one kind override for failed_transfer,
 * which is blocked-on-a-system rather than awaiting a judgment call) onto
 * the shared attention vocabulary in attentionPolicy.ts.
 */
import type { DecisionQueueItem, DecisionQueueKind } from '../hooks/useDecisionQueue';
import { type AttentionState, type AttentionBadgeVariant, attentionBadgeVariant, attentionRank } from './attentionPolicy';

export type { AttentionState };
export type ActionBarBadgeVariant = AttentionBadgeVariant;

export interface ActionBarSignal {
  kind: DecisionQueueKind;
  label: string;
  count: number;
  attention: AttentionState;
  badgeVariant: ActionBarBadgeVariant;
  href: string;
}

const KIND_LABELS: Record<DecisionQueueKind, string> = {
  approval: 'Approvals',
  related_party_review: 'Related-party review',
  crisis: 'Crisis care',
  care_triage: 'Care triage',
  kyc_review: 'KYC review',
  failed_transfer: 'Failed transfers',
  invitation_stalled: 'Stalled invitations',
  agent_finding: 'Agent findings',
};

function attentionForItem(item: DecisionQueueItem): AttentionState {
  if (item.kind === 'failed_transfer') return 'blocked';
  if (item.severity === 'critical') return 'urgent';
  if (item.severity === 'high') return 'needs_review';
  return 'informational';
}

/** Groups by kind, taking the most severe attention state and the
 * corresponding item's href to represent the whole group. Sorted
 * urgent -> blocked -> needs_review -> informational. */
export function buildActionBarSignals(items: DecisionQueueItem[]): ActionBarSignal[] {
  const byKind = new Map<DecisionQueueKind, { count: number; attention: AttentionState; href: string }>();

  for (const item of items) {
    const attention = attentionForItem(item);
    const existing = byKind.get(item.kind);
    if (!existing) {
      byKind.set(item.kind, { count: 1, attention, href: item.href });
      continue;
    }
    existing.count += 1;
    if (attentionRank(attention) < attentionRank(existing.attention)) {
      existing.attention = attention;
      existing.href = item.href;
    }
  }

  return Array.from(byKind.entries())
    .map(([kind, group]) => ({
      kind,
      label: KIND_LABELS[kind],
      count: group.count,
      attention: group.attention,
      badgeVariant: attentionBadgeVariant(group.attention),
      href: group.href,
    }))
    .sort((a, b) => attentionRank(a.attention) - attentionRank(b.attention));
}
