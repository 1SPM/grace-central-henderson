/**
 * Unit tests for runErrorMessage — the pure error-code -> user message
 * mapper used by useAgentCommandCentre's runAgent catch. Covers each
 * branch directly rather than only indirectly through a component test.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { runErrorMessage, useAgentCommandCentre } from './useAgentCommandCentre';
import { WorkOsApiError } from '../lib/services/workos';

describe('runErrorMessage', () => {
  it('maps a known server error code to a human-readable message', () => {
    expect(runErrorMessage(new WorkOsApiError('agent_run_failed', 500, { error: 'agent_run_failed' })))
      .toBe('The run failed. Try again, or check with an administrator if it keeps happening.');
  });

  it('maps agent_not_implemented to a refresh instruction', () => {
    expect(runErrorMessage(new WorkOsApiError('agent_not_implemented', 501, { error: 'agent_not_implemented' })))
      .toBe("This agent isn't built yet — refresh the page to see current status.");
  });

  it('falls back to the raw code verbatim for an unmapped server error', () => {
    expect(runErrorMessage(new WorkOsApiError('some_new_server_error', 500, { error: 'some_new_server_error' })))
      .toBe('some_new_server_error');
  });

  it('overrides any code with a permission-specific message on 403', () => {
    expect(runErrorMessage(new WorkOsApiError('forbidden', 403, { error: 'forbidden' })))
      .toBe("Your role doesn't include permission to run agents.");
  });

  it('uses a plain Error message when the failure did not come from workosFetch', () => {
    expect(runErrorMessage(new TypeError('Failed to fetch'))).toBe('Failed to fetch');
  });

  it('falls back to a generic message for a non-Error throw', () => {
    expect(runErrorMessage('a string was thrown')).toBe('Something went wrong running this agent.');
  });
});

vi.mock('../contexts/AuthContext', () => {
  // Stable getAuthToken reference — a fresh function per render breaks
  // useCallback/useEffect memoization in the hook under test, causing an
  // infinite render loop that only manifests under test (see the same
  // note in AgentCommandCentre.test.tsx).
  const getAuthToken = async () => null;
  return { useAuthContext: () => ({ getAuthToken, isSignedIn: true, isLoaded: true }) };
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: 'OK', json: async () => body } as Response;
}

describe('useAgentCommandCentre — runAgent same-key race (adversarial-review finding)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('a slower run that fails after a faster run for the same key already succeeded must not resurrect a stale error', async () => {
    // Two overlapping runAgent('grace') calls, invoked directly (not through
    // a disabled button) to reproduce the interleaving the adversarial
    // review flagged as reachable outside the normal click-then-disable UI
    // path. Call #1 is slow and fails; call #2 is fast and succeeds.
    let resolveSlowRun!: (v: Response) => void;
    const slowRun = new Promise<Response>(resolve => { resolveSlowRun = resolve; });
    let runCalls = 0;

    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/agents/workos-registry')) return Promise.resolve(jsonResponse({ agents: [] }));
      if (url.includes('/api/agents/workos-run') && opts?.method === 'POST') {
        runCalls += 1;
        if (runCalls === 1) return slowRun;
        return Promise.resolve(jsonResponse({
          run: { id: 'run-fast', agent_key: 'grace', status: 'succeeded', started_at: null, finished_at: null, created_at: '2026-08-25T00:00:00.000Z', output: null, error: null, work_order_id: null },
          summary: 'ok',
          finding_count: 0,
        }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    const { result } = renderHook(() => useAgentCommandCentre());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    let slowResult: unknown;
    let fastResult: unknown;
    await act(async () => {
      const slowPromise = result.current.runAgent('grace').then(r => { slowResult = r; });
      const fastPromise = result.current.runAgent('grace').then(r => { fastResult = r; });
      await fastPromise;
      // The fast call has resolved (succeeded); the slow call is still
      // in flight. No error should be recorded yet.
      expect(result.current.runErrors.get('grace')).toBeUndefined();
      expect(result.current.runningKey).toBeNull();

      resolveSlowRun(jsonResponse({ error: 'agent_run_failed' }, 500));
      await slowPromise;
    });

    expect(fastResult).not.toBeNull();
    expect(slowResult).toBeNull();
    // The superseded slow failure must not overwrite the fast success.
    expect(result.current.runErrors.get('grace')).toBeUndefined();
    expect(result.current.runningKey).toBeNull();
  });
});
