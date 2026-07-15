import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export interface AgentRunSummary {
  id: string;
  agent_key: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  output: { summary?: string; finding_count?: number } | null;
  error: string | null;
  work_order_id: string | null;
}

export interface AgentRegistryEntry {
  key: string;
  name: string;
  role: string;
  description: string;
  implemented: boolean;
  latest_run: AgentRunSummary | null;
  run_count_last_200: number;
  status: string;
}

interface RegistryResponse { agents: AgentRegistryEntry[] }
interface RunResponse { run: AgentRunSummary; summary: string; finding_count: number }

export function useAgentCommandCentre() {
  const { getAuthToken } = useAuthContext();
  const [agents, setAgents] = useState<AgentRegistryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [runningKey, setRunningKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<RegistryResponse>('/api/agents/workos-registry', getAuthToken);
      setAgents(data.agents);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Failed to load agent registry');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const runAgent = useCallback(async (agentKey: string): Promise<RunResponse | null> => {
    setRunningKey(agentKey);
    try {
      const data = await workosFetch<RunResponse>('/api/agents/workos-run', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ agent_key: agentKey }),
      });
      await refresh();
      return data;
    } finally {
      setRunningKey(null);
    }
  }, [getAuthToken, refresh]);

  return { agents, isLoading, error, forbidden, runningKey, refresh, runAgent };
}
