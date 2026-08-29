import { useCallback, useEffect, useState } from 'react';
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

export function useApprovals() {
  const { getAuthToken } = useAuthContext();
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const list = useCallback(async (filters?: { status?: ApprovalStatus; workOrderId?: string }) => {
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

  useEffect(() => { void list(); }, [list]);

  const decide = useCallback(async (id: string, decision: ApprovalDecision, decisionNotes?: string) => {
    const data = await workosFetch<DecideResponse>(`/api/approvals?id=${encodeURIComponent(id)}`, getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ decision, decision_notes: decisionNotes }),
    });
    await list();
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
    await list();
    return data.approval;
  }, [getAuthToken, list]);

  return { approvals, isLoading, error, forbidden, list, decide, markRelatedPartyReviewed };
}
