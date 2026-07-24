import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export type AgentFindingStatus = 'open' | 'triaged' | 'actioned' | 'resolved' | 'dismissed';

export interface AgentFinding {
  id: string;
  agent_id: string;
  source: 'cron' | 'workflow' | 'event';
  title: string;
  detail: string | null;
  severity: 'critical' | 'high' | 'normal' | 'info';
  status: AgentFindingStatus;
  subject_type: string | null;
  subject_id: string | null;
  payload: Record<string, unknown>;
  work_order_id: string | null;
  created_at: string;
  resolved_at: string | null;
  dismissed_reason: string | null;
  suppress_until: string | null;
}

export interface AgentPrecisionStats {
  generated: number;
  dismissed: number;
  actioned: number;
  resolved: number;
  dismissal_rate: number;
  median_hours_to_resolve: number | null;
}

interface FindingsResponse {
  findings: AgentFinding[];
  stats?: Record<string, AgentPrecisionStats>;
}

/**
 * Takes primitive filter values (not an options object) — an object
 * literal recreated each render would give refresh() an unstable
 * dependency and loop the effect below.
 */
export function useAgentFindings(status?: AgentFindingStatus, agentId?: string) {
  const { getAuthToken } = useAuthContext();
  const [findings, setFindings] = useState<AgentFinding[]>([]);
  const [stats, setStats] = useState<Record<string, AgentPrecisionStats>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const params = new URLSearchParams({ stats: '1' });
      if (status) params.set('status', status);
      if (agentId) params.set('agent_id', agentId);
      const data = await workosFetch<FindingsResponse>(`/api/agents/findings?${params.toString()}`, getAuthToken);
      setFindings(data.findings ?? []);
      setStats(data.stats ?? {});
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Failed to load agent findings');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken, status, agentId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const triage = useCallback(async (id: string) => {
    await workosFetch('/api/agents/findings', getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ id, action: 'triage' }),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  const dismiss = useCallback(async (id: string, dismissedReason?: string, suppressDays?: number) => {
    await workosFetch('/api/agents/findings', getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ id, action: 'dismiss', dismissed_reason: dismissedReason, suppress_days: suppressDays }),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  const resolve = useCallback(async (id: string) => {
    await workosFetch('/api/agents/findings', getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ id, action: 'resolve' }),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  const convertToWorkOrder = useCallback(async (id: string) => {
    const data = await workosFetch<{ finding: AgentFinding; work_order: { id: string } }>(
      '/api/agents/findings', getAuthToken, { method: 'POST', body: JSON.stringify({ id, action: 'convert_to_work_order' }) },
    );
    await refresh();
    return data;
  }, [getAuthToken, refresh]);

  return { findings, stats, isLoading, error, forbidden, refresh, triage, dismiss, resolve, convertToWorkOrder };
}
