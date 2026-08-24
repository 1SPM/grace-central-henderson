import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
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

  it('hides the Settings toggle for a caller without agents.manage', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({
          agents: [{ key: 'grace', name: 'Grace', role: 'WorkOS Orchestrator', description: 'x', implemented: true, latest_run: null, run_count_last_200: 0, status: 'not_yet_run' }],
        }));
      }
      return Promise.resolve(jsonResponse({ permissions: ['agents.view'] }));
    });

    render(<AgentCommandCentre />);

    await waitFor(() => expect(screen.getByText('Grace')).toBeInTheDocument());
    expect(screen.queryByTestId('agent-settings-toggle-grace')).not.toBeInTheDocument();
  });

  it('lets a master admin open Settings, edit instructions/tasks, and save', async () => {
    const putCalls: unknown[] = [];
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({
          agents: [{ key: 'grace', name: 'Grace', role: 'WorkOS Orchestrator', description: 'x', implemented: true, latest_run: null, run_count_last_200: 0, status: 'not_yet_run' }],
        }));
      }
      if (url.includes('/api/workos/agent-settings') && (!opts?.method || opts.method === 'GET')) {
        return Promise.resolve(jsonResponse({
          configs: [{ agent_key: 'grace', instructions: 'Watch for overdue approvals.', tasks: ['Check queue daily'], updated_at: '2026-08-01T00:00:00.000Z' }],
        }));
      }
      if (url.includes('/api/workos/agent-settings') && opts?.method === 'PUT') {
        const body = JSON.parse(opts.body as string);
        putCalls.push(body);
        return Promise.resolve(jsonResponse({ config: { agent_key: body.agent_key, instructions: body.instructions, tasks: body.tasks, updated_at: '2026-08-24T00:00:00.000Z' } }));
      }
      return Promise.resolve(jsonResponse({ permissions: ['agents.manage'] }));
    });

    render(<AgentCommandCentre />);
    await waitFor(() => expect(screen.getByText('Grace')).toBeInTheDocument());

    // Existing config summary shows collapsed before opening.
    await waitFor(() => expect(screen.getByText('Watch for overdue approvals.')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('agent-settings-toggle-grace'));

    const textarea = await screen.findByLabelText('Instructions');
    expect(textarea).toHaveValue('Watch for overdue approvals.');
    expect(screen.getByText('Check queue daily')).toBeInTheDocument();

    fireEvent.change(textarea, { target: { value: 'Watch for overdue approvals and escalate crisis items.' } });

    const taskInput = screen.getByPlaceholderText('Add a task…');
    fireEvent.change(taskInput, { target: { value: 'Escalate crisis flags same day' } });
    fireEvent.click(screen.getByLabelText('Add task'));
    expect(screen.getByText('Escalate crisis flags same day')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Save instructions & tasks'));

    await waitFor(() => expect(putCalls).toHaveLength(1));
    expect(putCalls[0]).toEqual({
      agent_key: 'grace',
      instructions: 'Watch for overdue approvals and escalate crisis items.',
      tasks: ['Check queue daily', 'Escalate crisis flags same day'],
    });
    // Panel closes after a successful save.
    await waitFor(() => expect(screen.queryByLabelText('Instructions')).not.toBeInTheDocument());
  });

  it('removes a task from the draft before saving', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({
          agents: [{ key: 'grace', name: 'Grace', role: 'WorkOS Orchestrator', description: 'x', implemented: true, latest_run: null, run_count_last_200: 0, status: 'not_yet_run' }],
        }));
      }
      if (url.includes('/api/workos/agent-settings') && (!opts?.method || opts.method === 'GET')) {
        return Promise.resolve(jsonResponse({
          configs: [{ agent_key: 'grace', instructions: null, tasks: ['Task A', 'Task B'], updated_at: null }],
        }));
      }
      return Promise.resolve(jsonResponse({ permissions: ['agents.manage'] }));
    });

    render(<AgentCommandCentre />);
    await waitFor(() => expect(screen.getByText('Grace')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('agent-settings-toggle-grace'));
    await screen.findByText('Task A');

    fireEvent.click(screen.getByLabelText('Remove task: Task A'));

    expect(screen.queryByText('Task A')).not.toBeInTheDocument();
    expect(screen.getByText('Task B')).toBeInTheDocument();
  });
});
