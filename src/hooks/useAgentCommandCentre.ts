import { useCallback, useEffect, useRef, useState } from 'react';
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

// The run endpoint's error codes are stable identifiers, not prose (see
// api/agents/_workos-run.ts) — map the ones a user can plausibly hit to a
// message that tells them what to do next. Anything unmapped falls back
// to the raw code so a new server-side error is still visible, just ugly.
const RUN_ERROR_MESSAGE: Record<string, string> = {
  agent_not_implemented: "This agent isn't built yet — refresh the page to see current status.",
  unknown_agent: 'Unknown agent — refresh the page.',
  agent_run_failed: 'The run failed. Try again, or check with an administrator if it keeps happening.',
  run_create_failed: 'Could not start the run. Try again in a moment.',
  service_not_configured: 'Agent runs are unavailable right now.',
};

export function runErrorMessage(err: unknown): string {
  if (err instanceof WorkOsApiError) {
    if (err.status === 403) return "Your role doesn't include permission to run agents.";
    return RUN_ERROR_MESSAGE[err.message] ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong running this agent.';
}

export function useAgentCommandCentre() {
  const { getAuthToken } = useAuthContext();
  const [agents, setAgents] = useState<AgentRegistryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [runningKey, setRunningKey] = useState<string | null>(null);
  const [runErrors, setRunErrors] = useState<Map<string, string>>(new Map());
  // Per-key attempt counter so two overlapping runAgent calls for the SAME
  // key (fast double-click, keyboard repeat) can't let a slow, superseded
  // call's outcome overwrite a faster later call's outcome — e.g. an older
  // in-flight run finally failing after a newer run for the same agent has
  // already succeeded must not resurrect a stale error. A ref (not state)
  // because it's read-modify-write inside async callbacks and must never
  // trigger its own re-render.
  const runAttemptRef = useRef(new Map<string, number>());

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
    const attemptId = (runAttemptRef.current.get(agentKey) ?? 0) + 1;
    runAttemptRef.current.set(agentKey, attemptId);
    const isLatestAttempt = () => runAttemptRef.current.get(agentKey) === attemptId;

    setRunningKey(agentKey);
    setRunErrors(prev => {
      if (!prev.has(agentKey)) return prev;
      const next = new Map(prev);
      next.delete(agentKey);
      return next;
    });
    try {
      const data = await workosFetch<RunResponse>('/api/agents/workos-run', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ agent_key: agentKey }),
      });
      if (isLatestAttempt()) await refresh();
      return data;
    } catch (err) {
      if (isLatestAttempt()) setRunErrors(prev => new Map(prev).set(agentKey, runErrorMessage(err)));
      return null;
    } finally {
      if (isLatestAttempt()) setRunningKey(null);
    }
  }, [getAuthToken, refresh]);

  return { agents, isLoading, error, forbidden, runningKey, runErrors, refresh, runAgent };
}
