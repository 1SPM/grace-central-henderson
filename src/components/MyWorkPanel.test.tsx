import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MyWorkPanel } from './MyWorkPanel';

vi.mock('../contexts/AuthContext', () => {
  const getAuthToken = async () => null;
  return { useAuthContext: () => ({ getAuthToken, isSignedIn: true, isLoaded: true }) };
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: 'OK', json: async () => body } as Response;
}

describe('MyWorkPanel', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  it('shows an honest empty state when nothing is assigned', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ work_orders: [], areas: [] })));

    render(<MyWorkPanel />);

    await waitFor(() => expect(screen.getByText(/Nothing is assigned to you yet/i)).toBeInTheDocument());
  });

  it('shows an owned ministry area\'s agent activity, with no flag control when no agent supports it', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({
      work_orders: [],
      areas: [{ area_key: 'children', area_name: 'Children & Youth', agent_activity: null }],
    })));

    render(<MyWorkPanel />);

    await waitFor(() => expect(screen.getByText('Children & Youth')).toBeInTheDocument());
    expect(screen.getByText(/No agent supports this yet/i)).toBeInTheDocument();
    expect(screen.queryByTestId('flag-toggle-area:children')).not.toBeInTheDocument();
  });

  it('shows agent activity and a flag control for an agent-supported area', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({
      work_orders: [],
      areas: [{
        area_key: 'giving', area_name: 'Giving',
        agent_activity: { agent_key: 'steward', agent_name: 'Steward', status: 'succeeded', finished_at: '2026-08-01T00:00:00.000Z', summary: 'Reconciled July.', error: null },
      }],
    })));

    render(<MyWorkPanel />);

    await waitFor(() => expect(screen.getByText('Steward')).toBeInTheDocument());
    expect(screen.getByText('Reconciled July.')).toBeInTheDocument();
    expect(screen.getByTestId('flag-toggle-area:giving')).toBeInTheDocument();
  });

  it('lets a staff member flag agent activity for the pastor, and confirms it', async () => {
    let postBody: unknown = null;
    fetchMock.mockImplementation((_url: string, opts?: RequestInit) => {
      if (opts?.method === 'POST') {
        postBody = JSON.parse(opts.body as string);
        return Promise.resolve(jsonResponse({ ok: true }, 201));
      }
      return Promise.resolve(jsonResponse({
        work_orders: [],
        areas: [{
          area_key: 'giving', area_name: 'Giving',
          agent_activity: { agent_key: 'steward', agent_name: 'Steward', status: 'succeeded', finished_at: null, summary: null, error: null },
        }],
      }));
    });

    render(<MyWorkPanel />);
    await waitFor(() => expect(screen.getByText('Giving')).toBeInTheDocument());

    fireEvent.click(screen.getByTestId('flag-toggle-area:giving'));
    const textarea = screen.getByPlaceholderText('What does the pastor need to know?');
    fireEvent.change(textarea, { target: { value: 'This total looks wrong, please check.' } });
    fireEvent.click(screen.getByText('Flag for pastor'));

    await waitFor(() => expect(postBody).toEqual({ subject_type: 'ministry_area', area_key: 'giving', note: 'This total looks wrong, please check.' }));
    await waitFor(() => expect(screen.getByText(/Flagged for your Senior Pastor/i)).toBeInTheDocument());
  });

  it('disables the flag button until a note is entered', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({
      work_orders: [],
      areas: [{
        area_key: 'giving', area_name: 'Giving',
        agent_activity: { agent_key: 'steward', agent_name: 'Steward', status: 'running', finished_at: null, summary: null, error: null },
      }],
    })));

    render(<MyWorkPanel />);
    await waitFor(() => expect(screen.getByText('Giving')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('flag-toggle-area:giving'));

    expect(screen.getByText('Flag for pastor')).toBeDisabled();
  });

  it('shows a Work Order\'s agent activity and its own flag control', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({
      work_orders: [{
        id: 'wo-1', title: 'Reconcile July giving', status: 'in_progress', priority: 'high', ministry: 'Finance', due_date: null,
        agent_activity: { agent_key: 'verity', agent_name: 'Verity', status: 'failed', finished_at: null, summary: null, error: 'Missing bank statement.' },
      }],
      areas: [],
    })));

    render(<MyWorkPanel />);

    await waitFor(() => expect(screen.getByText('Reconcile July giving')).toBeInTheDocument());
    expect(screen.getByText('Missing bank statement.')).toBeInTheDocument();
    expect(screen.getByTestId('flag-toggle-wo:wo-1')).toBeInTheDocument();
  });
});
