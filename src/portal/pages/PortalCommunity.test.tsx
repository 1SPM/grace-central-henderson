import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PortalCommunity } from './PortalCommunity';

vi.mock('../PortalAuthContext', () => {
  // Stable getAuthToken reference — see PortalCare.test.tsx for why a
  // fresh function per render causes an infinite effect loop under test.
  const getAuthToken = async () => null;
  return {
    usePortalAuth: () => ({ getAuthToken, isLoaded: true, isSignedIn: true, isDemo: true, memberFirstName: null }),
  };
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: 'OK', json: async () => body } as Response;
}

const GROUP = { id: 'group-1', name: 'Young Adults', description: null, meeting_day: 'Tuesday', meeting_time: '7:00 PM', location: null, my_status: null };
const EVENT = { id: 'event-1', title: 'Fall Picnic', description: null, start_date: '2026-08-01T18:00:00.000Z', end_date: null, location: 'Main Lawn', category: 'event', my_rsvp: null };

describe('PortalCommunity (group requests / event RSVP / volunteer interest test)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  function setupFetch() {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (url === '/api/portal/groups' && method === 'GET') return Promise.resolve(jsonResponse({ groups: [GROUP] }));
      if (url === '/api/portal/groups' && method === 'POST') return Promise.resolve(jsonResponse({ membership: { id: 'm1', status: 'pending' }, task_id: 't1' }, 201));
      if (url === '/api/portal/events' && method === 'GET') return Promise.resolve(jsonResponse({ events: [EVENT] }));
      if (url === '/api/portal/events' && method === 'POST') return Promise.resolve(jsonResponse({ rsvp: { status: 'yes' } }));
      if (url === '/api/portal/volunteer' && method === 'POST') return Promise.resolve(jsonResponse({ interest: { id: 'v1' }, task_id: 't2' }, 201));
      if (url === '/api/portal/contact' && method === 'POST') return Promise.resolve(jsonResponse({ task_id: 't3' }, 201));
      if (url === '/api/portal/requests' && method === 'GET') return Promise.resolve(jsonResponse({ requests: [] }));
      return Promise.resolve(jsonResponse({}));
    });
  }

  it('requests to join a group via POST /api/portal/groups with the group id', async () => {
    setupFetch();
    render(<PortalCommunity />);
    await waitFor(() => expect(screen.getByText('Young Adults')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Request to join'));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u, o]) => u === '/api/portal/groups' && o?.method === 'POST');
      expect(call).toBeDefined();
      expect(JSON.parse(call![1].body as string)).toEqual({ group_id: 'group-1' });
    });
  });

  it('RSVPs to an event via POST /api/portal/events', async () => {
    setupFetch();
    render(<PortalCommunity />);
    await waitFor(() => expect(screen.getByText('Fall Picnic')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Going'));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u, o]) => u === '/api/portal/events' && o?.method === 'POST');
      expect(call).toBeDefined();
      expect(JSON.parse(call![1].body as string)).toMatchObject({ event_id: 'event-1', status: 'yes' });
    });
  });

  it('submits volunteer interest via POST /api/portal/volunteer', async () => {
    setupFetch();
    render(<PortalCommunity />);
    await waitFor(() => expect(screen.getByText("I'm interested")).toBeInTheDocument());

    fireEvent.click(screen.getByText("I'm interested"));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u, o]) => u === '/api/portal/volunteer' && o?.method === 'POST');
      expect(call).toBeDefined();
    });
    await waitFor(() => expect(screen.getByText(/Thanks — your interest has been sent/)).toBeInTheDocument());
  });

  it('sends a contact message via POST /api/portal/contact', async () => {
    setupFetch();
    render(<PortalCommunity />);
    await waitFor(() => expect(screen.getByPlaceholderText('Subject')).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText('Subject'), { target: { value: 'Question about Sunday' } });
    fireEvent.change(screen.getByPlaceholderText('How can we help?'), { target: { value: 'What time does service start?' } });
    fireEvent.click(screen.getByText('Send message'));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u, o]) => u === '/api/portal/contact' && o?.method === 'POST');
      expect(call).toBeDefined();
      expect(JSON.parse(call![1].body as string)).toMatchObject({ subject: 'Question about Sunday', message: 'What time does service start?' });
    });
  });

  it('does not render community-post or prayer-wall composer UI (disabled this phase)', async () => {
    setupFetch();
    render(<PortalCommunity />);
    await waitFor(() => expect(screen.getByText('Young Adults')).toBeInTheDocument());
    expect(screen.getByText(/coming soon/i)).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/what's on your heart/i)).not.toBeInTheDocument();
  });
});
