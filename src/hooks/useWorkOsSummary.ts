import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export interface WorkOsMetric {
  key: string;
  label: string;
  definition: string;
  period: string;
  source: string;
  drilldown?: { view: string; tab?: string };
  value: number;
  last_updated: string;
}

interface SummaryResponse {
  generated_at: string;
  metrics: WorkOsMetric[];
}

export function useWorkOsSummary() {
  const { getAuthToken } = useAuthContext();
  const [metrics, setMetrics] = useState<WorkOsMetric[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<SummaryResponse>('/api/workos/summary', getAuthToken);
      setMetrics(data.metrics);
      setGeneratedAt(data.generated_at);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load overview');
      }
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { metrics, generatedAt, isLoading, error, forbidden, refresh };
}
