/**
 * End-to-end workflow test (within the Vitest/RTL environment — no
 * browser automation harness is configured in this repo, so this is the
 * highest-fidelity "exercise the real component wiring" test available):
 * create the Impact Card Pilot Readiness Work Order, open its detail
 * view, mark a task complete, and generate a completion report — the
 * exact demonstration required by the WorkOS spec, driven through the
 * real WorkOsHub component tree with a mocked API layer standing in for
 * the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { WorkOsHub } from './WorkOsHub';

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

const PILOT_WORK_ORDER = {
  id: 'wo-pilot-1',
  church_id: 'church-1',
  title: 'GRACE Impact Card Pilot Readiness — 1,000-Member Pilot',
  description: 'Readiness checklist.',
  status: 'planning',
  priority: 'high',
  ministry: 'Impact Card Operations',
  sensitivity: 'restricted',
  owner_user_id: 'user-1',
  due_date: null,
};

const PILOT_TASKS = [
  { id: 't1', work_order_id: 'wo-pilot-1', title: 'Document inventory', status: 'pending', priority: 'medium', position: 0 },
  { id: 't2', work_order_id: 'wo-pilot-1', title: 'Product readiness', status: 'pending', priority: 'medium', position: 1 },
  { id: 't10', work_order_id: 'wo-pilot-1', title: 'Independent validation', status: 'pending', priority: 'high', position: 9 },
];

describe('WorkOS end-to-end: Impact Card Pilot Readiness demonstration', () => {
  const fetchMock = vi.fn();
  let taskOneStatus = 'pending';
  // The demonstration starts from an empty Work Order list; the list only
  // includes the pilot-readiness Work Order once the create POST fires —
  // mirrors the real API's behavior (nothing exists until it's created).
  let pilotWorkOrderCreated = false;

  beforeEach(() => {
    taskOneStatus = 'pending';
    pilotWorkOrderCreated = false;
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
    window.history.replaceState(null, '', '#/');

    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      const method = opts?.method ?? 'GET';

      if (url === '/api/workos/permissions') {
        return Promise.resolve(jsonResponse({ permissions: ['work_orders.view', 'work_orders.manage'] }));
      }
      if (url === '/api/work-orders/pilot-readiness' && method === 'POST') {
        pilotWorkOrderCreated = true;
        return Promise.resolve(jsonResponse({ work_order: PILOT_WORK_ORDER, tasks: PILOT_TASKS }, 201));
      }
      if (url === '/api/work-orders' && method === 'GET') {
        return Promise.resolve(jsonResponse({ work_orders: pilotWorkOrderCreated ? [PILOT_WORK_ORDER] : [] }));
      }
      if (url === `/api/work-orders?id=${PILOT_WORK_ORDER.id}` && method === 'GET') {
        return Promise.resolve(jsonResponse({
          work_order: PILOT_WORK_ORDER,
          tasks: PILOT_TASKS.map(t => (t.id === 't1' ? { ...t, status: taskOneStatus } : t)),
          dependencies: [],
          evidence: [],
        }));
      }
      if (url === `/api/work-orders/tasks?id=t1` && method === 'PATCH') {
        taskOneStatus = 'completed';
        return Promise.resolve(jsonResponse({ task: { ...PILOT_TASKS[0], status: 'completed' } }));
      }
      if (url === `/api/work-orders/completion-report?id=${PILOT_WORK_ORDER.id}` && method === 'GET') {
        return Promise.resolve(jsonResponse({
          report: {
            work_order_id: PILOT_WORK_ORDER.id,
            title: PILOT_WORK_ORDER.title,
            status: 'planning',
            generated_at: '2026-07-13T12:00:00.000Z',
            task_summary: { total: 3, completed: 1, in_progress: 0, blocked: 0, pending: 2, percent_complete: 33 },
            evidence_count: 0,
            tasks_missing_evidence: ['Document inventory'],
            approval_summary: { total: 0, pending: 0, decided_favorably: 0, decided_unfavorably: 0, latest_status: null },
            narrative: '1 of 3 tasks complete (33%). 1 completed task has no evidence attached.',
          },
          artifact: { id: 'artifact-1' },
          persisted: true,
        }));
      }
      return Promise.resolve(jsonResponse({}));
    });
  });

  afterEach(() => vi.unstubAllGlobals());

  it('creates the demonstration Work Order, opens it, completes a task, and generates a completion report', async () => {
    render(<WorkOsHub setView={() => {}} defaultTab="work-orders" />);

    // 1. Start on the Work Order list, empty.
    await waitFor(() => expect(screen.getByText(/No Work Orders yet/i)).toBeInTheDocument());

    // 2. Create the demonstration Work Order — a real POST, real DB rows per the API contract.
    fireEvent.click(screen.getByText('Create Impact Card Pilot Readiness Work Order'));

    // 3. Detail view opens automatically with the ten (here, three sampled) real tasks.
    await waitFor(() => expect(screen.getByText(PILOT_WORK_ORDER.title)).toBeInTheDocument());
    expect(screen.getByText('Document inventory')).toBeInTheDocument();
    expect(screen.getByText('Independent validation')).toBeInTheDocument();
    expect(screen.getByText('0 of 3 tasks complete')).toBeInTheDocument();

    // 4. Mark "Document inventory" complete via its status select.
    const taskRows = screen.getAllByTestId('work-order-task-row');
    const firstRow = taskRows.find(row => within(row).queryByText('Document inventory'));
    expect(firstRow).toBeTruthy();
    const select = within(firstRow!).getByLabelText('Status for Document inventory');
    fireEvent.change(select, { target: { value: 'completed' } });

    await waitFor(() => expect(screen.getByText('1 of 3 tasks complete')).toBeInTheDocument());

    // 5. Generate the completion report — a real, template-generated artifact.
    fireEvent.click(screen.getByText('Generate completion report'));

    await waitFor(() => expect(screen.getByTestId('completion-report')).toBeInTheDocument());
    expect(screen.getByText(/1 of 3 tasks complete \(33%\)/)).toBeInTheDocument();
    expect(screen.getByText(/no evidence attached/)).toBeInTheDocument();

    // Never claims a live financial-provider connection anywhere in the flow.
    expect(screen.queryByText(/connected to stripe/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/connected to i2c/i)).not.toBeInTheDocument();
  });
});
