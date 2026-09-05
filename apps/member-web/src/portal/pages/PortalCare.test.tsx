import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { PortalCare } from './PortalCare';

vi.mock('../PortalAuthContext', () => {
  // A stable getAuthToken reference is required — hooks under test build
  // useCallback/useEffect chains keyed on this function's identity
  // (see usePortalCare's `refresh` + `useEffect(() => void refresh(), [refresh])`).
  // A fresh arrow function returned on every render causes an infinite
  // effect loop ("Maximum update depth exceeded") that only manifests
  // under test, since the real PortalAuthContext memoizes getAuthToken.
  const getAuthToken = async () => null;
  return {
    usePortalAuth: () => ({ getAuthToken, isLoaded: true, isSignedIn: true, isDemo: true, memberFirstName: null }),
  };
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: 'OK', json: async () => body } as Response;
}

describe('PortalCare (care-access / visibility / anonymous-display / member-status test)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  function setupFetch(overrides: { wall?: unknown; careRequests?: unknown } = {}) {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (url === '/api/portal/care' && method === 'GET') return Promise.resolve(jsonResponse({ requests: overrides.careRequests ?? [] }));
      if (url === '/api/portal/care' && method === 'POST') {
        return Promise.resolve(jsonResponse({ request: { id: 'cr-1', category: 'general', status: 'Received', submitted_at: '2026-07-14T00:00:00.000Z' } }, 201));
      }
      if (url.startsWith('/api/portal/prayer?scope=wall')) return Promise.resolve(jsonResponse({ requests: overrides.wall ?? [] }));
      if (url === '/api/portal/prayer' && method === 'POST') {
        const body = JSON.parse(opts!.body as string);
        return Promise.resolve(jsonResponse({
          request: { id: 'pr-1', visibility: body.visibility, created_at: '2026-07-14T00:00:00.000Z' },
          visibility_overridden: false,
        }, 201));
      }
      return Promise.resolve(jsonResponse({}));
    });
  }

  it('submits a care request with the chosen category, contact method, and visibility (visibility test)', async () => {
    setupFetch();
    render(<PortalCare />);
    await waitFor(() => expect(screen.getByText('Request care')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'grief' } });
    fireEvent.change(screen.getByLabelText("What's going on?"), { target: { value: 'Lost a family member recently.' } });
    fireEvent.change(screen.getByLabelText('Who can see this request'), { target: { value: 'specific_care_team' } });
    fireEvent.click(screen.getByText('Submit request'));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u, o]) => u === '/api/portal/care' && o?.method === 'POST');
      expect(call).toBeDefined();
      expect(JSON.parse(call![1].body as string)).toMatchObject({
        category: 'grief',
        message: 'Lost a family member recently.',
        visibility: 'specific_care_team',
      });
    });
  });

  it('never exposes crisis_flagged, sentinel_review_status, or internal notes anywhere in the DOM (care-access test)', async () => {
    setupFetch({
      careRequests: [{ id: 'cr-1', category: 'general', status: 'Received', submitted_at: '2026-07-14T00:00:00.000Z', resolved_at: null }],
    });
    render(<PortalCare />);
    await waitFor(() => expect(screen.getByTestId('care-request-status-list')).toBeInTheDocument());

    expect(screen.queryByText(/crisis_flagged/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/sentinel/i)).not.toBeInTheDocument();
    expect(screen.getByText('Received')).toBeInTheDocument();
  });

  it('renders anonymous prayer-wall entries without an author name (anonymous-display test)', async () => {
    setupFetch({
      wall: [
        { id: 'w1', content: 'Praying for my family', is_answered: false, created_at: '2026-07-14T00:00:00.000Z', author_name: null, is_anonymous: true },
        { id: 'w2', content: 'Thankful for healing', is_answered: true, created_at: '2026-07-13T00:00:00.000Z', author_name: 'Jordan Rivera', is_anonymous: false },
      ],
    });
    render(<PortalCare />);
    await waitFor(() => expect(screen.getByTestId('prayer-wall-list')).toBeInTheDocument());
    const wall = within(screen.getByTestId('prayer-wall-list'));

    expect(wall.getByText(/Anonymous/)).toBeInTheDocument();
    expect(wall.getByText(/Jordan Rivera/)).toBeInTheDocument();
    expect(wall.queryByText(/w1.*author/i)).not.toBeInTheDocument();
  });

  it('shows the approved crisis resource message when the server flags a visibility override (escalation test)', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (url === '/api/portal/care' && method === 'GET') return Promise.resolve(jsonResponse({ requests: [] }));
      if (url.startsWith('/api/portal/prayer?scope=wall')) return Promise.resolve(jsonResponse({ requests: [] }));
      if (url === '/api/portal/prayer' && method === 'POST') {
        return Promise.resolve(jsonResponse({
          request: { id: 'pr-2', visibility: 'private_pastoral_care', created_at: '2026-07-14T00:00:00.000Z' },
          visibility_overridden: true,
          crisis_resource_message: 'If you are in immediate danger, please call or text 988 (Suicide & Crisis Lifeline) or call 911. Your message has been routed directly to pastoral care for human follow-up.',
        }, 201));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<PortalCare />);
    await waitFor(() => expect(screen.getByText('Share a prayer request')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText("What's on your heart today?"), { target: { value: 'I want to end my life' } });
    fireEvent.click(screen.getByText('Share prayer request'));

    await waitFor(() => expect(screen.getByText(/routed directly to pastoral care/i)).toBeInTheDocument());
    expect(screen.queryByText(/you will be fine|help is on the way/i)).not.toBeInTheDocument();
  });
});
