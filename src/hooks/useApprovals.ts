import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';
import type { Approval, ApprovalDecision, ApprovalStatus } from '../types/shared-platform';

interface ListResponse { approvals: Approval[] }
/**
 * A decision on an agent-proposed action also carries the outcome of
 * actually performing it. An approved action whose executor refused
 * (the Work Order was assigned by hand meanwhile, the proposed owner left)
 * comes back as status 'failed' with a reason — the caller must surface
 * that, or the pastor sees a success badge over a no-op.
 */
export interface AgentActionOutcome { action_id: string; status: string; reason?: string }
interface DecideResponse { approval: Approval; agent_action?: AgentActionOutcome | null; audit_incomplete?: boolean }

/**
 * @param initialStatus what the first load asks for. The Approval Centre
 * opens on "Pending", so its first fetch must say so — mounting with an
 * unfiltered list() showed every decided row under a dropdown that read
 * Pending (2026-09-04 browser rehearsal: 16 decided rehearsal deletions
 * above the one live request).
 */
export function useApprovals(initialStatus?: ApprovalStatus) {
  const { getAuthToken } = useAuthContext();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  // What the list currently shows, so a decision refreshes the SAME view.
  // decide() used to re-list unfiltered, which put every decided row back
  // under a dropdown still reading "Pending" the moment one was approved.
  const lastFilters = useRef<{ status?: ApprovalStatus; workOrderId?: string } | undefined>(
    initialStatus ? { status: initialStatus } : undefined,
  );

  const list = useCallback(async (filters?: { status?: ApprovalStatus; workOrderId?: string }) => {
    lastFilters.current = filters;
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const params = new URLSearchParams();
      if (filters?.status) params.set('status', filters.status);
      if (filters?.workOrderId) params.set('work_order_id', filters.workOrderId);
      const qs = params.toString();
      const data = await workosFetch<ListResponse>(`/api/approvals${qs ? `?${qs}` : ''}`, getAuthToken);
      setApprovals(data.approvals);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Failed to load approvals');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void list(initialStatus ? { status: initialStatus } : undefined); }, [list, initialStatus]);

  const decide = useCallback(async (id: string, decision: ApprovalDecision, decisionNotes?: string) => {
    const data = await workosFetch<DecideResponse>(`/api/approvals?id=${encodeURIComponent(id)}`, getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ decision, decision_notes: decisionNotes }),
    });
    await list(lastFilters.current);
    return {
      approval: data.approval,
      agentAction: data.agent_action ?? null,
      auditIncomplete: data.audit_incomplete === true,
    };
  }, [getAuthToken, list]);

  const markRelatedPartyReviewed = useCallback(async (id: string) => {
    const data = await workosFetch<DecideResponse>(`/api/approvals?id=${encodeURIComponent(id)}`, getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ mark_related_party_reviewed: true }),
    });
    await list(lastFilters.current);
    return data.approval;
  }, [getAuthToken, list]);

  return { approvals, isLoading, error, forbidden, list, decide, markRelatedPartyReviewed };
}
