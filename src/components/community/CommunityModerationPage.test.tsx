import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { CommunityModerationPage } from './CommunityModerationPage';

vi.mock('../../contexts/AuthContext', () => {
  // Stable getAuthToken reference — see useAgentCommandCentre.test.ts for
  // why a fresh function per render breaks the hook's memoization.
  const getAuthToken = async () => null;
  return { useAuthContext: () => ({ getAuthToken, isSignedIn: true, isLoaded: true }) };
});

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: 'OK', json: async () => body } as Response;
}

const PENDING_POST = { id: 'post-pending-1', post_type: 'blessing', body: 'Grateful for this church', created_at: '2026-01-01T00:00:00.000Z', author_name: 'Maya Thompson' };
const REPORTED_POST = { id: 'post-reported-1', post_type: 'praise', body: 'Questionable content', created_at: '2026-01-02T00:00:00.000Z', author_name: 'Someone Else', report_count: 2, report_reasons: ['spam'] };

describe('CommunityModerationPage', () => {
  const fetchMock = vi.fn();
  beforeEach(() => { vi.stubGlobal('fetch', fetchMock); fetchMock.mockReset(); });
  afterEach(() => vi.unstubAllGlobals());

  function setupFetch(overrides: Partial<{ pending: unknown[]; reported: unknown[] }> = {}) {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';
      if (url === '/api/community/queue' && method === 'GET') {
        return Promise.resolve(jsonResponse({ pending: overrides.pending ?? [PENDING_POST], reported: overrides.reported ?? [REPORTED_POST] }));
      }
      if (url.startsWith('/api/community/moderate') && method === 'PATCH') {
        return Promise.resolve(jsonResponse({ post: { id: 'moderated' } }));
      }
      return Promise.resolve(jsonResponse({}));
    });
  }

  it('renders both queues with report detail attached to the reported post', async () => {
    setupFetch();
    render(<CommunityModerationPage />);

    await waitFor(() => expect(screen.getByText('Grateful for this church')).toBeInTheDocument());
    expect(screen.getByText('Questionable content')).toBeInTheDocument();
    expect(screen.getByText(/2 reports — spam/i)).toBeInTheDocument();
  });

  it('shows the empty state per section when there is nothing to review', async () => {
    setupFetch({ pending: [], reported: [] });
    render(<CommunityModerationPage />);

    await waitFor(() => expect(screen.getByText(/queue is clear/i)).toBeInTheDocument());
    expect(screen.getByText(/no open reports/i)).toBeInTheDocument();
  });

  it('approves a pending post via PATCH /api/community/moderate?id=<post_id>', async () => {
    setupFetch();
    render(<CommunityModerationPage />);
    await waitFor(() => expect(screen.getByText('Grateful for this church')).toBeInTheDocument());

    const pendingSection = screen.getByText('Grateful for this church').closest('li')!;
    fireEvent.click(within(pendingSection).getByRole('button', { name: /approve/i }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u, o]) => typeof u === 'string' && u.startsWith('/api/community/moderate') && o?.method === 'PATCH');
      expect(call).toBeDefined();
      expect(call![0]).toBe(`/api/community/moderate?id=${PENDING_POST.id}`);
      expect(JSON.parse(call![1].body as string)).toEqual({ decision: 'approved' });
    });
  });

  it('removes a reported post via the Remove action', async () => {
    setupFetch();
    render(<CommunityModerationPage />);
    await waitFor(() => expect(screen.getByText('Questionable content')).toBeInTheDocument());

    const reportedSection = screen.getByText('Questionable content').closest('li')!;
    fireEvent.click(within(reportedSection).getByRole('button', { name: /remove/i }));

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(([u, o]) => typeof u === 'string' && u.startsWith('/api/community/moderate') && o?.method === 'PATCH');
      expect(call).toBeDefined();
      expect(call![0]).toBe(`/api/community/moderate?id=${REPORTED_POST.id}`);
      expect(JSON.parse(call![1].body as string)).toEqual({ decision: 'removed' });
    });
  });

  it('shows a permission message instead of the queue on a 403', async () => {
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ error: 'forbidden' }, 403)));
    render(<CommunityModerationPage />);

    await waitFor(() => expect(screen.getByText(/doesn't include community moderation access/i)).toBeInTheDocument());
    expect(screen.queryByText(/awaiting first review/i)).not.toBeInTheDocument();
  });
});
