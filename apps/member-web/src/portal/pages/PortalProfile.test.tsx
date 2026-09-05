import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { PortalProfile } from './PortalProfile';

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

const PROFILE = {
  id: 'person-1', first_name: 'Jordan', last_name: 'Rivera', email: 'jordan@example.invalid',
  phone: '555-0100', address: '1 Main St', city: 'Henderson', state: 'NV', zip: '89002',
  birth_date: null, photo_url: null,
};

describe('PortalProfile (profile editing + preference changes test)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  function setupFetch() {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (url === '/api/portal/profile' && method === 'GET') return Promise.resolve(jsonResponse({ profile: PROFILE }));
      if (url === '/api/portal/profile' && method === 'PATCH') {
        const body = JSON.parse(opts!.body as string);
        return Promise.resolve(jsonResponse({ profile: { ...PROFILE, ...body } }));
      }
      if (url === '/api/consents' && method === 'GET') return Promise.resolve(jsonResponse({ consents: [], preferences: null }));
      if (url === '/api/consents' && method === 'PATCH') return Promise.resolve(jsonResponse({ consent: { id: 'c1' } }));
      return Promise.resolve(jsonResponse({}));
    });
  }

  it('loads and displays the member\'s own profile fields', async () => {
    setupFetch();
    render(<PortalProfile />);
    await waitFor(() => expect(screen.getByDisplayValue('Jordan')).toBeInTheDocument());
    expect(screen.getByDisplayValue('Rivera')).toBeInTheDocument();
  });

  it('saves an edited field via PATCH /api/portal/profile', async () => {
    setupFetch();
    render(<PortalProfile />);
    await waitFor(() => expect(screen.getByDisplayValue('Jordan')).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText('First name'), { target: { value: 'Jordy' } });
    fireEvent.click(screen.getByText('Save changes'));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([u, o]) => u === '/api/portal/profile' && o?.method === 'PATCH');
      expect(patchCall).toBeDefined();
      expect(JSON.parse(patchCall![1].body as string)).toMatchObject({ first_name: 'Jordy' });
    });
    await waitFor(() => expect(screen.getByText('Saved')).toBeInTheDocument());
  });

  it('toggles a communication preference via PATCH /api/consents', async () => {
    setupFetch();
    render(<PortalProfile />);
    await waitFor(() => expect(screen.getByLabelText('Email updates')).toBeInTheDocument());

    fireEvent.click(screen.getByLabelText('Email updates'));

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(([u, o]) => u === '/api/consents' && o?.method === 'PATCH');
      expect(patchCall).toBeDefined();
      expect(JSON.parse(patchCall![1].body as string)).toMatchObject({ consent_type: 'email', status: 'granted' });
    });
  });

  it('never renders internal staff-only fields (e.g. status, tags, notes)', async () => {
    setupFetch();
    render(<PortalProfile />);
    await waitFor(() => expect(screen.getByDisplayValue('Jordan')).toBeInTheDocument());
    expect(screen.queryByLabelText(/status/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/tags/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/notes/i)).not.toBeInTheDocument();
  });
});
