import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { WorkOrderList } from './WorkOrderList';

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
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
  } as Response;
}

describe('WorkOrderList (component test)', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('shows an empty state when there are no Work Orders', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/work-orders')) return Promise.resolve(jsonResponse({ work_orders: [] }));
      if (url.includes('/api/workos/permissions')) return Promise.resolve(jsonResponse({ permissions: ['work_orders.manage'] }));
      return Promise.resolve(jsonResponse({}));
    });

    render(<WorkOrderList onOpen={() => {}} />);

    await waitFor(() => expect(screen.getByText(/No Work Orders yet/i)).toBeInTheDocument());
  });

  it('renders Work Orders returned by the API, each with a status badge', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/work-orders')) {
        return Promise.resolve(jsonResponse({
          work_orders: [
            { id: 'wo-1', title: 'Spring outreach follow-up plan', status: 'planning', priority: 'medium', ministry: 'Outreach', due_date: null },
          ],
        }));
      }
      if (url.includes('/api/workos/permissions')) return Promise.resolve(jsonResponse({ permissions: [] }));
      return Promise.resolve(jsonResponse({}));
    });

    render(<WorkOrderList onOpen={() => {}} />);

    await waitFor(() => expect(screen.getByText('Spring outreach follow-up plan')).toBeInTheDocument());
    expect(within(screen.getByTestId('work-order-row')).getByText('Planning')).toBeInTheDocument();
  });

  it('calls onOpen with the Work Order id when a row is clicked', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/work-orders')) {
        return Promise.resolve(jsonResponse({
          work_orders: [{ id: 'wo-42', title: 'Test row', status: 'draft', priority: 'low', ministry: null, due_date: null }],
        }));
      }
      return Promise.resolve(jsonResponse({ permissions: [] }));
    });

    const onOpen = vi.fn();
    render(<WorkOrderList onOpen={onOpen} />);

    await waitFor(() => expect(screen.getByTestId('work-order-row')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('work-order-row'));
    expect(onOpen).toHaveBeenCalledWith('wo-42');
  });

  it('hides "New Work Order" when the caller lacks work_orders.manage (role-visibility)', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/work-orders')) return Promise.resolve(jsonResponse({ work_orders: [] }));
      if (url.includes('/api/workos/permissions')) return Promise.resolve(jsonResponse({ permissions: ['work_orders.view'] }));
      return Promise.resolve(jsonResponse({}));
    });

    render(<WorkOrderList onOpen={() => {}} />);

    await waitFor(() => expect(screen.getByText(/No Work Orders yet/i)).toBeInTheDocument());
    expect(screen.queryByText('New Work Order')).not.toBeInTheDocument();
  });

  it('shows a permission message instead of the list when the API returns 403 (role-visibility)', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/work-orders')) return Promise.resolve(jsonResponse({ error: 'insufficient_permission' }, 403));
      return Promise.resolve(jsonResponse({ permissions: [] }));
    });

    render(<WorkOrderList onOpen={() => {}} />);

    await waitFor(() => expect(screen.getByText(/doesn't include Work Order access/i)).toBeInTheDocument());
  });
});
