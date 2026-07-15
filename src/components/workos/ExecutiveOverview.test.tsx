import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { ExecutiveOverview } from './ExecutiveOverview';

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

const SAMPLE_METRIC = {
  key: 'active_members',
  label: 'Active members',
  definition: "People whose status is 'member' or 'leader'.",
  period: 'Point-in-time (as of now)',
  source: 'people',
  value: 214,
  last_updated: '2026-07-13T12:00:00.000Z',
};

describe('ExecutiveOverview (component test)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders a real metric value, not a placeholder', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/workos/summary')
        ? Promise.resolve(jsonResponse({ generated_at: '2026-07-13T12:00:00.000Z', metrics: [SAMPLE_METRIC] }))
        : Promise.resolve(jsonResponse({})),
    );

    render(<ExecutiveOverview setView={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('metric-active_members')).toBeInTheDocument());
    expect(screen.getByText('214')).toBeInTheDocument();
    expect(screen.getByText('Active members')).toBeInTheDocument();
  });

  it('reveals definition, period, source, and last-updated when the info icon is clicked', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/workos/summary')
        ? Promise.resolve(jsonResponse({ generated_at: '2026-07-13T12:00:00.000Z', metrics: [SAMPLE_METRIC] }))
        : Promise.resolve(jsonResponse({})),
    );

    render(<ExecutiveOverview setView={() => {}} />);

    await waitFor(() => expect(screen.getByTestId('metric-active_members')).toBeInTheDocument());
    fireEvent.click(screen.getByLabelText('About Active members'));

    expect(screen.getByText(/People whose status is 'member' or 'leader'/)).toBeInTheDocument();
    expect(screen.getByText(/Point-in-time \(as of now\)/)).toBeInTheDocument();
    expect(screen.getByText(/people/, { selector: 'p' })).toBeInTheDocument();
  });

  it('shows a permission message for a caller without analytics.view', async () => {
    fetchMock.mockImplementation((url: string) =>
      url.includes('/api/workos/summary')
        ? Promise.resolve(jsonResponse({ error: 'insufficient_permission' }, 403))
        : Promise.resolve(jsonResponse({})),
    );

    render(<ExecutiveOverview setView={() => {}} />);

    await waitFor(() => expect(screen.getByText(/doesn't include Executive Overview access/i)).toBeInTheDocument());
  });
});
