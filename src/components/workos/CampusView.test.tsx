/**
 * CampusView's first test file. Scope: the room/agent panel's run-error
 * display (data-testid="campus-agent-run-error") and its "Run now" call
 * site — added alongside AgentCommandCentre's equivalent in PR #154 and
 * left untested there because CampusView itself had zero coverage.
 *
 * The canvas map (CampusRenderer) is not under test here: jsdom has no
 * real 2D canvas context (no `canvas` npm package installed), so
 * `canvas.getContext('2d')` returns null and CampusRenderer's own
 * constructor throws 'Canvas 2D unavailable', which CampusView already
 * catches into a loadError state — the room/agent side panel is driven
 * by independent React state (selectedRoom/selectedAgent) and renders
 * regardless of whether the canvas itself came up, so this is a
 * legitimate way to exercise the panel without a real canvas.
 *
 * useAgentCommandCentre is exercised for REAL (same fetch-mocking
 * convention as AgentCommandCentre.test.tsx) so this test proves the
 * actual hook wiring, not a hand-rolled substitute. The other three
 * hooks CampusView reads (permissions, decision queue, ministry areas)
 * are stubbed to fixed values — they are not what this file is testing.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { CampusView } from './CampusView';

vi.mock('../../contexts/AuthContext', () => {
  // Stable getAuthToken reference — a fresh function per render breaks
  // useCallback/useEffect memoization in useAgentCommandCentre, causing
  // an infinite render loop under test (same note as
  // AgentCommandCentre.test.tsx and useAgentCommandCentre.test.ts).
  const getAuthToken = async () => null;
  return { useAuthContext: () => ({ getAuthToken, isSignedIn: true, isLoaded: true }) };
});

vi.mock('../../ThemeContext', () => ({ useTheme: () => ({ theme: 'light' }) }));

const permState = vi.hoisted(() => ({ canManage: true }));
vi.mock('../../hooks/useWorkOsPermissions', () => ({
  useWorkOsPermissions: () => ({ has: (p: string) => (p === 'agents.manage' ? permState.canManage : true) }),
}));

// Mutable so the "desk count" test below can supply non-zero by_kind
// counts (mocks are hoisted module-level and shared across every test in
// this file).
const decisionQueueState = vi.hoisted(() => ({
  counts: { total: 0, critical: 0, by_kind: {} as Record<string, number> },
}));
vi.mock('../../hooks/useDecisionQueue', () => ({
  useDecisionQueue: () => ({ counts: decisionQueueState.counts, items: [], isLoading: false, error: null }),
}));

// Empty areas is a real, honest state (per this codebase's own "no
// fabricated activity" convention) — it just means agent room placement
// falls back to the static AGENT_SEATS map, which is what campusAssignments.ts
// seats 'grace' in ('fellowship'), matching the defaultRoom used below.
// Mutable so the "ministry-area override" test below can supply a non-empty
// areas array without its own vi.mock (mocks are hoisted module-level and
// shared across every test in this file).
const ministryAreasState = vi.hoisted(() => ({ areas: [] as unknown[], agents: [] as unknown[] }));
vi.mock('../../hooks/useMinistryAreas', () => ({
  useMinistryAreas: () => ministryAreasState,
}));

function jsonResponse(body: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, statusText: 'OK', json: async () => body } as Response;
}

const GRACE_AGENT = {
  key: 'grace',
  name: 'Grace',
  role: 'WorkOS Orchestrator',
  description: 'Scans Work Orders.',
  implemented: true,
  latest_run: null,
  run_count_last_200: 0,
  status: 'not_yet_run',
};

describe('CampusView — room/agent panel run-error display', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    permState.canManage = true;
    ministryAreasState.areas = [];
    decisionQueueState.counts = { total: 0, critical: 0, by_kind: {} };
    vi.stubGlobal('fetch', fetchMock);
    fetchMock.mockReset();
  });
  afterEach(() => { vi.unstubAllGlobals(); });

  it('shows the run error and re-enables the button when a run fails', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({ agents: [GRACE_AGENT] }));
      }
      if (url.includes('/api/agents/workos-run') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({ error: 'agent_run_failed' }, 500));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<CampusView setView={vi.fn()} defaultRoom="fellowship" />);

    await waitFor(() => expect(screen.getByTestId('campus-room-panel')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('campus-agent-seat-grace'));
    await waitFor(() => expect(screen.getByTestId('campus-agent-panel')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Run now'));

    await waitFor(() => expect(screen.getByTestId('campus-agent-run-error')).toHaveTextContent(
      'The run failed. Try again, or check with an administrator if it keeps happening.',
    ));
    expect(screen.getByText('Run now')).not.toBeDisabled();
  });

  it('shows the permission message when the server rejects a run as unauthorized (server-side 403, distinct from the client-side canManage gate)', async () => {
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({ agents: [GRACE_AGENT] }));
      }
      if (url.includes('/api/agents/workos-run') && opts?.method === 'POST') {
        return Promise.resolve(jsonResponse({ error: 'forbidden' }, 403));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<CampusView setView={vi.fn()} defaultRoom="fellowship" />);

    await waitFor(() => expect(screen.getByTestId('campus-room-panel')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('campus-agent-seat-grace'));
    await waitFor(() => expect(screen.getByTestId('campus-agent-panel')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Run now'));

    await waitFor(() => expect(screen.getByTestId('campus-agent-run-error')).toHaveTextContent(
      "Your role doesn't include permission to run agents.",
    ));
  });

  it('shows the honest "no agent seated" state for a room none of the registered agents occupy', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({ agents: [GRACE_AGENT] }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    // 'grace' is seated in 'fellowship' (campusAssignments.ts AGENT_SEATS) —
    // the sanctuary has no agent assigned in this fixture, and its
    // DEPARTMENTS binding has no nightCrew, so the panel must show the
    // honest empty state rather than fabricating activity.
    render(<CampusView setView={vi.fn()} defaultRoom="sanctuary" />);

    await waitFor(() => expect(screen.getByTestId('campus-room-panel')).toBeInTheDocument());
    expect(screen.getByText('No agent is seated here. That is the honest state, not a placeholder.')).toBeInTheDocument();
  });

  it('clears the run error on a successful retry', async () => {
    let runAttempt = 0;
    fetchMock.mockImplementation((url: string, opts?: RequestInit) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({ agents: [GRACE_AGENT] }));
      }
      if (url.includes('/api/agents/workos-run') && opts?.method === 'POST') {
        runAttempt += 1;
        if (runAttempt === 1) return Promise.resolve(jsonResponse({ error: 'agent_run_failed' }, 500));
        return Promise.resolve(jsonResponse({
          run: { id: 'run-1', agent_key: 'grace', status: 'succeeded', started_at: null, finished_at: null, created_at: '2026-08-25T00:00:00.000Z', output: null, error: null, work_order_id: null },
          summary: 'ok',
          finding_count: 0,
        }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<CampusView setView={vi.fn()} defaultRoom="fellowship" />);

    await waitFor(() => expect(screen.getByTestId('campus-room-panel')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('campus-agent-seat-grace'));
    await waitFor(() => expect(screen.getByTestId('campus-agent-panel')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Run now'));
    await waitFor(() => expect(screen.getByTestId('campus-agent-run-error')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Run now'));
    await waitFor(() => expect(screen.queryByTestId('campus-agent-run-error')).not.toBeInTheDocument());
  });

  it('seats an agent in its ministry-area room override instead of its AGENT_SEATS default', async () => {
    // 'grace' defaults to 'fellowship' (campusAssignments.ts AGENT_SEATS). A
    // ministry area that names 'grace' as its agent_key and 'lobby' as its
    // room_id is the real mechanism Settings -> Ministry Areas reassignment
    // uses in production (CampusView.tsx's roomByAgentKey, built from
    // areas[].agent_key/room_id, takes priority over the static seat).
    ministryAreasState.areas = [{
      key: 'test-area',
      name: 'Test Area',
      purpose: 'Exercises the ministry-area room override.',
      ministry: 'test',
      confidential: false,
      surfaces: [{ label: 'Test Surface', view: 'dashboard', hash: '#/dashboard', primary: true }],
      queueKinds: [],
      owner: null,
      default_role_key: 'ministry_leader',
      agent_key: 'grace',
      room_id: 'lobby',
      accent_color: '#000000',
      source: { owner: 'default', agent: 'assigned', room: 'assigned' },
      updated_at: null,
      open_work_orders: 0,
      unowned_work_orders: 0,
      next_event: null,
    }];
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({ agents: [GRACE_AGENT] }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<CampusView setView={vi.fn()} defaultRoom="lobby" />);

    await waitFor(() => expect(screen.getByTestId('campus-room-panel')).toBeInTheDocument());
    expect(screen.getByTestId('campus-agent-seat-grace')).toBeInTheDocument();
  });

  it('shows the desk count badge, summing Decision Queue counts for the room\'s area\'s queueKinds', async () => {
    // deskCount = areasInRoom.reduce over each area's queueKinds, looking
    // each kind up in useDecisionQueue().counts.by_kind (CampusView.tsx
    // ~line 174-177). Needs both a non-empty areasInRoom (via the
    // ministry-area override above) and a non-zero by_kind count for a
    // kind actually listed in the area's queueKinds — the current fixture
    // areas are otherwise empty, so this path is never hit without both.
    ministryAreasState.areas = [{
      key: 'test-area',
      name: 'Test Area',
      purpose: 'Exercises the desk-count badge.',
      ministry: 'test',
      confidential: false,
      surfaces: [{ label: 'Test Surface', view: 'dashboard', hash: '#/dashboard', primary: true }],
      queueKinds: ['agent_finding'],
      owner: null,
      default_role_key: 'ministry_leader',
      agent_key: 'grace',
      room_id: 'lobby',
      accent_color: '#000000',
      source: { owner: 'default', agent: 'assigned', room: 'assigned' },
      updated_at: null,
      open_work_orders: 0,
      unowned_work_orders: 0,
      next_event: null,
    }];
    decisionQueueState.counts = { total: 3, critical: 0, by_kind: { agent_finding: 3 } };
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({ agents: [GRACE_AGENT] }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<CampusView setView={vi.fn()} defaultRoom="lobby" />);

    await waitFor(() => expect(screen.getByTestId('campus-room-panel')).toBeInTheDocument());
    expect(screen.getByText('3 waiting')).toBeInTheDocument();
  });

  it('hides "Run now" for a caller without agents.manage', async () => {
    permState.canManage = false;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes('/api/agents/workos-registry')) {
        return Promise.resolve(jsonResponse({ agents: [GRACE_AGENT] }));
      }
      return Promise.resolve(jsonResponse({}));
    });

    render(<CampusView setView={vi.fn()} defaultRoom="fellowship" />);

    await waitFor(() => expect(screen.getByTestId('campus-room-panel')).toBeInTheDocument());
    fireEvent.click(screen.getByTestId('campus-agent-seat-grace'));
    await waitFor(() => expect(screen.getByTestId('campus-agent-panel')).toBeInTheDocument());

    expect(screen.queryByText('Run now')).not.toBeInTheDocument();
  });
});
