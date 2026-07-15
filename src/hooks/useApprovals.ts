import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';
import type { Approval, ApprovalDecision, ApprovalStatus } from '../types/shared-platform';

interface ListResponse { approvals: Approval[] }
interface DecideResponse { approval: Approval }

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
    return data.approval;
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
