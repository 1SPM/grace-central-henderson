import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ApprovalCentre } from './ApprovalCentre';

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

const PENDING_APPROVAL = {
  id: 'ap-1',
  work_order_id: 'wo-1',
  entity_type: 'work_order',
  proposed_action: 'Approve completion readiness for "GRACE Impact Card Pilot Readiness"',
  requested_by_user_id: 'user-1',
  requested_by_agent: null,
  risk_level: 'medium',
  status: 'pending',
  decision: null,
  decision_notes: null,
  requested_at: '2026-07-13T12:00:00.000Z',
  decided_at: null,
};

describe('ApprovalCentre (approval test)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders a pending approval with its proposed action, risk, and decision options', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/approvals')) return Promise.resolve(jsonResponse({ approvals: [PENDING_APPROVAL] }));
      return Promise.resolve(jsonResponse({ permissions: ['approvals.decide'] }));
    });

    render(<ApprovalCentre />);

    await waitFor(() => expect(screen.getByTestId('approval-card')).toBeInTheDocument());
    expect(screen.getByText(/Approve completion readiness/)).toBeInTheDocument();
    expect(screen.getByText('Risk: medium')).toBeInTheDocument();
    expect(screen.getByText('Approve')).toBeInTheDocument();
    expect(screen.getByText('Reject')).toBeInTheDocument();
    expect(screen.getByText('Escalate')).toBeInTheDocument();
  });

  it('submits a decision via PATCH when a decision button is clicked', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/approvals') && (!opts || opts.method === undefined)) {
        return Promise.resolve(jsonResponse({ approvals: [PENDING_APPROVAL] }));
      }
      if (url.includes('/api/approvals') && opts?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({ approval: { ...PENDING_APPROVAL, status: 'decided', decision: 'approve' } }));
      }
      return Promise.resolve(jsonResponse({ permissions: ['approvals.decide'] }));
    });

    render(<ApprovalCentre />);

    await waitFor(() => expect(screen.getByTestId('approval-card')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([, opts]) => opts?.method === 'PATCH');
      expect(patchCall).toBeDefined();
      expect(patchCall![0]).toContain('/api/approvals?id=ap-1');
      expect(JSON.parse(patchCall![1].body as string)).toMatchObject({ decision: 'approve' });
    });
  });

  it('does not show decision buttons when the caller only has approvals.view', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/approvals')) return Promise.resolve(jsonResponse({ approvals: [PENDING_APPROVAL] }));
      return Promise.resolve(jsonResponse({ permissions: ['approvals.view'] }));
    });

    render(<ApprovalCentre />);

    await waitFor(() => expect(screen.getByTestId('approval-card')).toBeInTheDocument());
    expect(screen.queryByText('Approve')).not.toBeInTheDocument();
  });
});
