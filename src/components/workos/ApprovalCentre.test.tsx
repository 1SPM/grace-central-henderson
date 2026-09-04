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

  it('asks the server for pending approvals on first load, matching the filter it shows', async () => {
    // The dropdown opens on "Pending"; the first request has to say so, or
    // every decided row is listed under a filter that claims otherwise.
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/approvals')) return Promise.resolve(jsonResponse({ approvals: [PENDING_APPROVAL] }));
      return Promise.resolve(jsonResponse({ permissions: ['approvals.decide'] }));
    });

    render(<ApprovalCentre />);

    await waitFor(() => expect(screen.getByTestId('approval-card')).toBeInTheDocument());
    const firstList = fetchMock.mock.calls.find(([url]) => String(url).includes('/api/approvals'));
    expect(String(firstList![0])).toContain('status=pending');
  });

  it('explains a self-approval refusal in plain words instead of the error code', async () => {
    // C-13: the requester may not approve their own request. The server says
    // 403 { error: 'self_approval' }; the decider must not see "self_approval".
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/approvals') && opts?.method === 'PATCH') {
        return Promise.resolve(jsonResponse({ error: 'self_approval' }, 403));
      }
      if (url.includes('/api/approvals')) return Promise.resolve(jsonResponse({ approvals: [PENDING_APPROVAL] }));
      return Promise.resolve(jsonResponse({ permissions: ['approvals.decide'] }));
    });

    render(<ApprovalCentre />);

    await waitFor(() => expect(screen.getByTestId('approval-card')).toBeInTheDocument());
    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => expect(screen.getByText(/someone else has to approve it/i)).toBeInTheDocument());
    expect(screen.queryByText('self_approval')).not.toBeInTheDocument();
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

describe('requester attribution', () => {
  // A chat proposal carries a staff user id, and historically also an agent
  // label. Reading out the agent in that case credits a person's decision to
  // software — on the one screen whose whole job is saying who wanted this.
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  function renderWith(approval: Record<string, unknown>) {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/approvals')) return Promise.resolve(jsonResponse({ approvals: [approval] }));
      return Promise.resolve(jsonResponse({ permissions: ['approvals.decide'] }));
    });
    render(<ApprovalCentre />);
  }

  const chatProposal = {
    ...PENDING_APPROVAL,
    id: 'ap-chat',
    work_order_id: null,
    entity_type: 'agent_action',
    proposed_action: 'Delete Dana Reyes and their history',
    requested_by_user_id: 'user-1',
    requested_by_agent: 'grace_chat',
  };

  it('names a staff member when a human asked, even with an agent label present', async () => {
    renderWith(chatProposal);
    expect(await screen.findByText(/Requested by a staff member/)).toBeInTheDocument();
    expect(screen.queryByText(/agent: grace_chat/)).not.toBeInTheDocument();
  });

  it('still names the agent when nobody human asked', async () => {
    renderWith({ ...chatProposal, requested_by_user_id: null, requested_by_agent: 'verity' });
    expect(await screen.findByText(/agent: verity/)).toBeInTheDocument();
  });
});
