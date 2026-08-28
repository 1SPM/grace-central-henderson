import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export interface AgentConfig {
  agent_key: string;
  instructions: string | null;
  tasks: string[];
  updated_at: string | null;
}

interface ConfigsResponse { configs: AgentConfig[] }
interface SaveResponse { config: AgentConfig }

// The settings endpoint's error codes are stable identifiers, not prose
// (see api/workos/_agent-settings.ts) — map the ones a user can plausibly
// hit to a message that tells them what to do next. Anything unmapped
// falls back to the raw code so a new server-side error is still visible,
// just ugly.
const SAVE_ERROR_MESSAGE: Record<string, string> = {
  unknown_agent_key: 'Unknown agent — refresh the page.',
  invalid_request: "Check the instructions and tasks — one of them didn't pass validation.",
  write_failed: 'Could not save changes. Try again in a moment.',
  service_not_configured: 'Agent settings are unavailable right now.',
};

function saveErrorMessage(err: unknown): string {
  if (err instanceof WorkOsApiError) {
    if (err.status === 403) return "Your role doesn't include permission to manage agent settings.";
    return SAVE_ERROR_MESSAGE[err.message] ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong saving these settings.';
}

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
  const [saveErrors, setSaveErrors] = useState<Map<string, string>>(new Map());

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

  const save = useCallback(async (agentKey: string, instructions: string, tasks: string[]): Promise<AgentConfig | null> => {
    setSavingKey(agentKey);
    setSaveErrors(prev => {
      if (!prev.has(agentKey)) return prev;
      const next = new Map(prev);
      next.delete(agentKey);
      return next;
    });
    try {
      const data = await workosFetch<SaveResponse>('/api/workos/agent-settings', getAuthToken, {
        method: 'PUT',
        body: JSON.stringify({ agent_key: agentKey, instructions, tasks }),
      });
      setConfigs(prev => new Map(prev).set(agentKey, data.config));
      return data.config;
    } catch (err) {
      setSaveErrors(prev => new Map(prev).set(agentKey, saveErrorMessage(err)));
      return null;
    } finally {
      setSavingKey(null);
    }
  }, [getAuthToken]);

  return { configs, isLoading, savingKey, saveErrors, save, refresh };
}
