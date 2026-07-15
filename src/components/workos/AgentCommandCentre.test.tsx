import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AgentCommandCentre } from './AgentCommandCentre';

vi.mock('../../contexts/AuthContext', () => {
  // Stable getAuthToken reference — a fresh function per render breaks
  // useCallback/useEffect memoization in hooks under test, causing an
  // infinite render loop ("Maximum update depth exceeded") that only
  // manifests under test since the real AuthContext memoizes this.
  const getAuthToken = async () => null;
  return {
    useAuthContext: () => ({ getAuthToken, isSignedIn: true, isLoaded: true }),
  };
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: 'OK', json: async () => body } as Response;
}

describe('AgentCommandCentre (agent-run display test)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('shows "Not yet implemented" for a registered-but-unbuilt agent — never fabricated activity', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({
          agents: [
            { key: 'shepherd', name: 'Shepherd', role: 'Member Care', description: 'Care follow-ups.', implemented: false, latest_run: null, run_count_last_200: 0, status: 'not_implemented' },
          ],
        }));
      }
      return Promise.resolve(jsonResponse({ permissions: [] }));
    });

    render(<AgentCommandCentre />);

    await waitFor(() => expect(screen.getByText('Shepherd')).toBeInTheDocument());
    expect(screen.getByText('Not yet implemented')).toBeInTheDocument();
    expect(screen.getByText(/has not been built yet/i)).toBeInTheDocument();
  });

  it('shows a real recorded run summary for an implemented agent', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({
          agents: [
            {
              key: 'grace',
              name: 'Grace',
              role: 'WorkOS Orchestrator',
              description: 'Scans Work Orders.',
              implemented: true,
              latest_run: {
                id: 'run-1',
                agent_key: 'grace',
                status: 'succeeded',
                started_at: '2026-07-13T12:00:00.000Z',
                finished_at: '2026-07-13T12:00:02.000Z',
                created_at: '2026-07-13T12:00:00.000Z',
                output: { summary: 'Found 2 overdue tasks.', finding_count: 2 },
                error: null,
                work_order_id: null,
              },
              run_count_last_200: 3,
              status: 'succeeded',
            },
          ],
        }));
      }
      return Promise.resolve(jsonResponse({ permissions: ['agents.manage'] }));
    });

    render(<AgentCommandCentre />);

    await waitFor(() => expect(screen.getByText('Found 2 overdue tasks.')).toBeInTheDocument());
    expect(screen.getByText('Ran successfully')).toBeInTheDocument();
    expect(screen.getByText('Run now')).toBeInTheDocument();
  });

  it('hides "Run now" when the caller lacks agents.manage (role-visibility)', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({
          agents: [
            { key: 'grace', name: 'Grace', role: 'WorkOS Orchestrator', description: 'x', implemented: true, latest_run: null, run_count_last_200: 0, status: 'not_yet_run' },
          ],
        }));
      }
      return Promise.resolve(jsonResponse({ permissions: ['agents.view'] }));
    });

    render(<AgentCommandCentre />);

    await waitFor(() => expect(screen.getByText('Grace')).toBeInTheDocument());
    expect(screen.queryByText('Run now')).not.toBeInTheDocument();
  });
});
