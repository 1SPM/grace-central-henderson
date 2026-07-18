import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

// Mirrors DecisionQueueKind in api/_lib/decisionQueue.ts — kept as a
// separate local type rather than a cross-import, matching how every
// other WorkOS hook (e.g. useWorkOsSummary's WorkOsMetric) keeps its own
// response-shape type independent of the backend module.
export type DecisionQueueKind =
  | 'approval'
  | 'related_party_review'
  | 'crisis'
  | 'care_triage'
  | 'kyc_review'
  | 'failed_transfer'
  | 'invitation_stalled'
  | 'agent_task';

export interface DecisionQueueItem {
  id: string;
  kind: DecisionQueueKind;
  title: string;
  detail?: string;
  severity: 'critical' | 'high' | 'normal';
  created_at: string;
  age_hours: number;
  href: string;
  required_permission: string;
  subject_type: string;
  subject_id: string;
}

export interface DecisionQueueCounts {
  total: number;
  critical: number;
  by_kind: Partial<Record<DecisionQueueKind, number>>;
}

interface DecisionQueueResponse {
  items: DecisionQueueItem[];
  counts: DecisionQueueCounts;
}

const EMPTY_COUNTS: DecisionQueueCounts = { total: 0, critical: 0, by_kind: {} };

export function useDecisionQueue() {
  const { getAuthToken, isLoaded } = useAuthContext();
  const [items, setItems] = useState<DecisionQueueItem[]>([]);
  const [counts, setCounts] = useState<DecisionQueueCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await workosFetch<DecisionQueueResponse>('/api/workos/decision-queue', getAuthToken);
      setItems(data.items ?? []);
      setCounts(data.counts ?? EMPTY_COUNTS);
    } catch (err) {
      setError(err instanceof WorkOsApiError ? err.message : 'Failed to load the decision queue');
      setItems([]);
      setCounts(EMPTY_COUNTS);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    if (!isLoaded) return;
    void refresh();
  }, [isLoaded, refresh]);

  return { items, counts, isLoading, error, refresh };
}
