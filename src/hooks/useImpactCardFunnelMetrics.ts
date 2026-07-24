import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export interface ImpactCardMetric {
  value: number | null;
  source: string;
  definition: string;
  reporting_period: { start: string; end: string };
  calculation: string;
  assumptions: string;
  data_freshness: string;
  reconciliation_status: 'reconciled' | 'not_applicable' | 'exceptions_open' | 'not_yet_computed';
}

export type ImpactCardMetricKey =
  | 'application_count' | 'completion_count' | 'activation_count' | 'active_participation'
  | 'approved_aggregate_value_usd' | 'program_benefit' | 'onboarding_drop_off_rate'
  | 'support_cases' | 'reconciliation_status' | 'campaign_performance';

interface PermissionRequiredMarker { permission_required: true }
type MetricOrMarker = ImpactCardMetric | PermissionRequiredMarker;

interface FunnelMetricsResponse {
  reporting_period: { start: string; end: string };
  metrics: Record<ImpactCardMetricKey, MetricOrMarker>;
}

export function isPermissionRequired(m: MetricOrMarker): m is PermissionRequiredMarker {
  return 'permission_required' in m;
}

export function useImpactCardFunnelMetrics() {
  const { getAuthToken } = useAuthContext();
  const [metrics, setMetrics] = useState<Record<ImpactCardMetricKey, MetricOrMarker> | null>(null);
  const [reportingPeriod, setReportingPeriod] = useState<{ start: string; end: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<FunnelMetricsResponse>('/api/impact-card/funnel-metrics', getAuthToken);
      setMetrics(data.metrics);
      setReportingPeriod(data.reporting_period);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load Impact Card metrics');
      }
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { metrics, reportingPeriod, isLoading, error, forbidden, refresh };
}
