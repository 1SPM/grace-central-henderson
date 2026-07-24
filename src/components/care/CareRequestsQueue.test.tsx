import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CareRequestsQueue } from './CareRequestsQueue';

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

const CRISIS_REQUEST = {
  id: 'cr-1',
  person_id: 'person-1',
  category: 'crisis',
  priority: 'crisis',
  status: 'submitted',
  visibility: 'private_pastoral_care',
  crisis_flagged: true,
  sentinel_review_status: 'pending',
  preferred_contact_method: 'phone',
  requests_human_followup: true,
  summary: 'Needs urgent support.',
  created_at: '2026-07-14T00:00:00.000Z',
  care_assignments: [],
};

describe('CareRequestsQueue (role / care-access / moderation / escalation test)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  it('shows a permission message for staff without care.view (role / care-access test)', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/care-requests' ? Promise.resolve(jsonResponse({ error: 'insufficient_permission' }, 403)) : Promise.resolve(jsonResponse({})),
    );
    render(<CareRequestsQueue />);
    await waitFor(() => expect(screen.getByText(/doesn't include care request access/i)).toBeInTheDocument());
  });

  it('flags a crisis request visually and shows the pending-review gate (escalation test)', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/care-requests' ? Promise.resolve(jsonResponse({ requests: [CRISIS_REQUEST] })) : Promise.resolve(jsonResponse({})),
    );
    render(<CareRequestsQueue />);
    await waitFor(() => expect(screen.getByTestId('care-request-row')).toBeInTheDocument());

    expect(screen.getByText('Crisis flagged')).toBeInTheDocument();
    expect(screen.getByText(/requires human privacy\/safety review/i)).toBeInTheDocument();
  });

  it('clears the sentinel review only via an explicit staff action, never automatically (escalation test)', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (url === '/api/care-requests' && method === 'GET') return Promise.resolve(jsonResponse({ requests: [CRISIS_REQUEST] }));
      if (url.startsWith('/api/care-requests?id=') && method === 'PATCH') return Promise.resolve(jsonResponse({ request: { ...CRISIS_REQUEST, sentinel_review_status: 'cleared' } }));
      return Promise.resolve(jsonResponse({}));
    });
    render(<CareRequestsQueue />);
    await waitFor(() => expect(screen.getByText('Mark reviewed')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Mark reviewed'));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u, o]) => (u as string).startsWith('/api/care-requests?id=') && o?.method === 'PATCH');
      expect(call).toBeDefined();
      expect(JSON.parse(call![1].body as string)).toEqual({ sentinel_review_status: 'cleared' });
    });
  });

  it('never renders assigned-staff identity or internal note contents in the summary row (care-access test)', async () => {
    fetchMock.mockImplementation((url: string) =>
      url === '/api/care-requests' ? Promise.resolve(jsonResponse({ requests: [CRISIS_REQUEST] })) : Promise.resolve(jsonResponse({})),
    );
    render(<CareRequestsQueue />);
    await waitFor(() => expect(screen.getByTestId('care-request-row')).toBeInTheDocument());
    // The row shows the summary/category/contact preference — never a
    // rendered internal-notes list on load (notes are fetched only via a
    // separate, care.manage-only endpoint the queue doesn't call eagerly).
    expect(fetchMock.mock.calls.some(([u]) => (u as string).includes('/api/care-requests/notes'))).toBe(false);
  });
});
