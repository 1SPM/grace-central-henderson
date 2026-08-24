import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch } from '../lib/services/workos';

export interface AgentConfig {
  agent_key: string;
  instructions: string | null;
  tasks: string[];
  updated_at: string | null;
}

interface ConfigsResponse { configs: AgentConfig[] }
interface SaveResponse { config: AgentConfig }

/**
 * Per-agent instructions/tasks — the pastor's own configuration layered
 * on top of the static agent registry. A missing config for a given key
 * just means "nothing set yet," same honesty rule as ministry areas.
 */
export function useAgentSettings() {
  const { getAuthToken } = useAuthContext();
  const [configs, setConfigs] = useState<Map<string, AgentConfig>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await workosFetch<ConfigsResponse>('/api/workos/agent-settings', getAuthToken);
      setConfigs(new Map(data.configs.map(c => [c.agent_key, c])));
    } catch {
      setConfigs(new Map());
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback(async (agentKey: string, instructions: string, tasks: string[]) => {
    setSavingKey(agentKey);
    try {
      const data = await workosFetch<SaveResponse>('/api/workos/agent-settings', getAuthToken, {
        method: 'PUT',
        body: JSON.stringify({ agent_key: agentKey, instructions, tasks }),
      });
      setConfigs(prev => new Map(prev).set(agentKey, data.config));
      return data.config;
    } finally {
      setSavingKey(null);
    }
  }, [getAuthToken]);

  return { configs, isLoading, savingKey, save, refresh };
}
