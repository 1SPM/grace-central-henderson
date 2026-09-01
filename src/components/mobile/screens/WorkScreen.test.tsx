import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { WorkScreen } from './WorkScreen';
import type { Task } from '../../../types';

vi.mock('../../../contexts/AuthContext', () => {
  const getAuthToken = async () => null;
  return { useAuthContext: () => ({ getAuthToken, isSignedIn: true, isLoaded: true }) };
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: 'OK', json: async () => body } as Response;
}

const isoToday = new Date().toISOString().slice(0, 10);

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'Follow up with Sarah Mitchell',
    dueDate: isoToday,
    completed: false,
    priority: 'high',
    category: 'follow-up',
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('WorkScreen', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  function mockApis({ approvalsStatus = 200 }: { approvalsStatus?: number } = {}) {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/api/workos/my-work')) {
        return Promise.resolve(
          jsonResponse({
            work_orders: [
              {
                id: 'wo1',
                title: 'Confirm volunteer leaders',
                status: 'in_progress',
                priority: 'high',
                ministry: 'sunday_service',
                due_date: isoToday,
                agent_activity: null,
              },
            ],
            areas: [],
          }),
        );
      }
      if (String(url).includes('/api/approvals')) {
        if (approvalsStatus !== 200) {
          return Promise.resolve(jsonResponse({ error: 'forbidden' }, approvalsStatus));
        }
        return Promise.resolve(
          jsonResponse({
            approvals: [
              {
                id: 'ap1',
                church_id: 'c1',
                work_order_id: null,
                entity_type: 'budget_request',
                entity_id: null,
                proposed_action: 'Approve budget request',
                requested_by_user_id: null,
                requested_by_agent: null,
                affected_resources: [],
                risk_level: 'medium',
                supporting_evidence: [],
                approver_user_id: null,
                decision: null,
                decision_notes: null,
                status: 'pending',
                requested_at: new Date().toISOString(),
                decided_at: null,
                related_party_flagged: false,
                related_party_reviewed_by_user_id: null,
                related_party_reviewed_at: null,
              },
            ],
          }),
        );
      }
      return Promise.resolve(jsonResponse({}, 404));
    });
  }

  it('interleaves tasks, work orders, and approvals in the queue', async () => {
    mockApis();
    render(<WorkScreen tasks={[task({})]} onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Approve budget request')).toBeInTheDocument());
    expect(screen.getByText('Follow up with Sarah Mitchell')).toBeInTheDocument();
    expect(screen.getByText('Confirm volunteer leaders')).toBeInTheDocument();
    expect(screen.getByText('High priority')).toBeInTheDocument();
  });

  it('omits approvals silently when the user is forbidden', async () => {
    mockApis({ approvalsStatus: 403 });
    render(<WorkScreen tasks={[task({})]} onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Confirm volunteer leaders')).toBeInTheDocument());
    expect(screen.queryByText('Approve budget request')).not.toBeInTheDocument();
    // No error surface — the section just doesn't exist for this user.
    expect(screen.queryByText(/forbidden|error/i)).not.toBeInTheDocument();
  });

  it('shows a clear empty state when there is no work', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (String(url).includes('/api/workos/my-work')) {
        return Promise.resolve(jsonResponse({ work_orders: [], areas: [] }));
      }
      return Promise.resolve(jsonResponse({ approvals: [] }));
    });
    render(<WorkScreen tasks={[]} onNavigate={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Your work queue is clear.')).toBeInTheDocument());
  });
});
