import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuditTimeline } from './AuditTimeline';

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

describe('AuditTimeline (audit-view test)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('renders merged audit and event entries, most recent first', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/audit/timeline')) {
        return Promise.resolve(jsonResponse({
          entries: [
            { id: 'evt-1', kind: 'event', timestamp: '2026-07-13T12:05:00.000Z', actor_user_id: 'u1', actor_person_id: null, label: 'work_order.created', entity_type: 'work_order', entity_id: 'wo-1', source_app: 'admin_dashboard', correlation_id: 'c1', detail: {} },
            { id: 'log-1', kind: 'audit', timestamp: '2026-07-13T12:00:00.000Z', actor_user_id: 'u1', actor_person_id: null, label: 'create work_order', entity_type: 'work_order', entity_id: 'wo-1', source_app: 'admin_dashboard', correlation_id: 'c1', detail: {} },
          ],
        }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<AuditTimeline />);

    const entries = await waitFor(() => screen.getAllByTestId('audit-entry'));
    expect(entries).toHaveLength(2);
    expect(entries[0]).toHaveTextContent('work_order.created');
    expect(entries[1]).toHaveTextContent('create work_order');
  });

  it('shows a permission message for a caller without audit.view (role-based visibility)', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/audit/timeline')) return Promise.resolve(jsonResponse({ error: 'insufficient_permission' }, 403));
      return Promise.resolve(jsonResponse({}));
    });

    render(<AuditTimeline />);

    await waitFor(() => expect(screen.getByText(/doesn't include audit-trail access/i)).toBeInTheDocument());
  });

  it('shows an empty state when there is nothing recorded yet', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/audit/timeline')) return Promise.resolve(jsonResponse({ entries: [] }));
      return Promise.resolve(jsonResponse({}));
    });

    render(<AuditTimeline />);

    await waitFor(() => expect(screen.getByText(/Nothing recorded yet/i)).toBeInTheDocument());
  });
});
