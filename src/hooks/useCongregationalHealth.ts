import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export interface HealthMetricValue {
  value: number | null;
  source: 'computed' | 'not_yet_computed';
  detail: string;
}

export interface CurrentHealthMetrics {
  visitor_conversion_90d: HealthMetricValue;
  recurring_coverage: HealthMetricValue;
  care_responsiveness: HealthMetricValue;
  group_participation: HealthMetricValue;
  portal_adoption: HealthMetricValue;
  engagement: HealthMetricValue & { at_risk_count: number };
}

export interface HealthSnapshotRow {
  snapshot_date: string;
  metrics: CurrentHealthMetrics;
}

export interface AtRiskMember {
  id: string;
  name: string;
  last_activity_at: string;
}

interface HealthResponse {
  current: CurrentHealthMetrics;
  snapshots: HealthSnapshotRow[];
  at_risk: AtRiskMember[];
}

export function useCongregationalHealth() {
  const { getAuthToken } = useAuthContext();
  const [current, setCurrent] = useState<CurrentHealthMetrics | null>(null);
  const [snapshots, setSnapshots] = useState<HealthSnapshotRow[]>([]);
  const [atRisk, setAtRisk] = useState<AtRiskMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<HealthResponse>('/api/impact/health', getAuthToken);
      setCurrent(data.current ?? null);
      setSnapshots(data.snapshots ?? []);
      setAtRisk(data.at_risk ?? []);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load congregational health');
      }
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { current, snapshots, atRisk, isLoading, error, forbidden, refresh };
}
