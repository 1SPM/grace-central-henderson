import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export interface MinistryImpactStat {
  this_year: number | null;
  all_time: number | null;
  source: string;
  definition: string;
}

export interface MinistryImpactMetrics {
  gift_in_kind_value_distributed: MinistryImpactStat;
  care_requests_handled: MinistryImpactStat;
  households_served: MinistryImpactStat;
  individuals_served: MinistryImpactStat;
  data_freshness: string;
}

interface MinistryMetricsResponse {
  metrics: MinistryImpactMetrics;
}

export function useMinistryImpactMetrics() {
  const { getAuthToken } = useAuthContext();
  const [metrics, setMetrics] = useState<MinistryImpactMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<MinistryMetricsResponse>('/api/impact/ministry-metrics', getAuthToken);
      setMetrics(data.metrics ?? null);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load ministry impact metrics');
      }
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { metrics, isLoading, error, forbidden, refresh };
}
