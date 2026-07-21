import { useState } from 'react';
import { CheckCircle2, ClipboardCheck, ShieldAlert } from 'lucide-react';
import { useApprovals } from '../../hooks/useApprovals';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { EmptyState } from '../ui/EmptyState';
import { StatusBadge } from '../ui/StatusBadge';
import type { ApprovalDecision } from '../../types/shared-platform';

const DECISIONS: { value: ApprovalDecision; label: string }[] = [
  { value: 'approve', label: 'Approve' },
  { value: 'approve_with_changes', label: 'Approve with changes' },
  { value: 'return_for_revision', label: 'Return for revision' },
  { value: 'reject', label: 'Reject' },
  { value: 'escalate', label: 'Escalate' },
];

const RISK_VARIANT: Record<string, 'success' | 'info' | 'warning' | 'urgent'> = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  critical: 'urgent',
};

export function ApprovalCentre() {
  const { approvals, isLoading, error, forbidden, list, decide, markRelatedPartyReviewed } = useApprovals();
  const { has } = useWorkOsPermissions();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<'pending' | 'decided' | ''>('pending');
  const [decisionError, setDecisionError] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  const canDecide = has('approvals.decide');

  async function handleFilterChange(next: 'pending' | 'decided' | '') {
    setStatusFilter(next);
    await list(next ? { status: next } : undefined);
  }

  async function handleDecide(id: string, decision: ApprovalDecision) {
    setDecisionError(null);
    try {
      await decide(id, decision, notes[id]);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Could not record the decision.');
    }
  }

  async function handleMarkReviewed(id: string) {
    setDecisionError(null);
    setReviewingId(id);
    try {
      await markRelatedPartyReviewed(id);
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Could not mark this reviewed.');
    } finally {
      setReviewingId(null);
    }
  }

  if (forbidden) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-dark-400">
        Your role doesn't include Approval Centre access. Contact a System Administrator if you believe this is wrong.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center gap-2 mb-4">
        <select
          value={statusFilter}
          onChange={e => void handleFilterChange(e.target.value as 'pending' | 'decided' | '')}
          className="rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-1.5 text-sm text-gray-700 dark:text-dark-200"
          aria-label="Filter approvals"
        >
          <option value="pending">Pending</option>
          <option value="decided">Decided</option>
          <option value="">All</option>
        </select>
      </div>

      {error && <p className="text-sm text-brand-600 dark:text-brand-400 mb-3">{error}</p>}
      {decisionError && <p className="text-sm text-brand-600 dark:text-brand-400 mb-3">{decisionError}</p>}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-dark-800 animate-pulse" />
          ))}
        </div>
      ) : approvals.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={22} />}
          title={statusFilter === 'pending' ? 'Nothing needs your approval right now' : 'No approvals found'}
          description="Approval requests appear here when a Work Order or agent proposes an action that needs sign-off."
        />
      ) : (
        <div className="space-y-3">
          {approvals.map(a => (
            <div key={a.id} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4" data-testid="approval-card">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{a.proposed_action}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                    Requested by {a.requested_by_agent ? `agent: ${a.requested_by_agent}` : 'a staff member'} · {new Date(a.requested_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <StatusBadge variant={RISK_VARIANT[a.risk_level] ?? 'default'}>Risk: {a.risk_level}</StatusBadge>
                  {a.related_party_flagged && !a.related_party_reviewed_at && (
                    <StatusBadge variant="warning"><ShieldAlert size={11} /> Related-party review needed</StatusBadge>
                  )}
                  {a.status === 'decided' && (
                    <StatusBadge variant="success"><CheckCircle2 size={11} /> {a.decision}</StatusBadge>
                  )}
                </div>
              </div>

              {a.related_party_flagged && !a.related_party_reviewed_at && canDecide && (
                <div className="mt-3">
                  <button
                    onClick={() => void handleMarkReviewed(a.id)}
                    disabled={reviewingId === a.id}
                    className="px-3 py-1.5 text-xs font-medium border border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 disabled:opacity-50"
                  >
                    {reviewingId === a.id ? 'Marking reviewed…' : 'Mark related-party review as complete'}
                  </button>
                </div>
              )}

              {a.status === 'pending' && canDecide && (
                <div className="mt-3 space-y-2">
                  <input
                    value={notes[a.id] ?? ''}
                    onChange={e => setNotes(prev => ({ ...prev, [a.id]: e.target.value }))}
                    placeholder="Decision notes (optional)"
                    className="w-full rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-1.5 text-xs text-gray-700 dark:text-dark-200"
                  />
                  <div className="flex flex-wrap gap-2">
                    {DECISIONS.map(d => (
                      <button
                        key={d.value}
                        onClick={() => void handleDecide(a.id, d.value)}
                        className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200 hover:bg-gray-50 dark:hover:bg-dark-800"
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {a.status === 'decided' && a.decision_notes && (
                <p className="text-xs text-gray-500 dark:text-dark-400 mt-2">Notes: {a.decision_notes}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
