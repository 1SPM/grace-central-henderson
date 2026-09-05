/**
 * Regression coverage for the production incident where Layout.tsx and
 * DecisionQueuePanel.tsx — both mounted at once on the dashboard — each
 * called useDecisionQueue() for the same churchId and independently tried
 * to `.channel('decision-queue-<id>').on('postgres_changes', ...).subscribe()`.
 * Supabase Realtime keys channels by topic name, so the second `.channel()`
 * call returned the SAME already-subscribed object and its `.on()` threw
 * ("cannot add postgres_changes callbacks ... after subscribe()"), which
 * crashed the whole authenticated app via the top-level ErrorBoundary.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useDecisionQueue } from './useDecisionQueue';

const churchId = 'church-regression-1';

interface MockChannel {
  topic: string;
  subscribed: boolean;
  callbacks: Array<() => void>;
  on: (event: string, filter: unknown, cb: () => void) => MockChannel;
  subscribe: () => MockChannel;
}

const { channels, removeChannelMock } = vi.hoisted(() => ({
  channels: new Map<string, MockChannel>(),
  removeChannelMock: vi.fn((channel: MockChannel) => {
    for (const [key, value] of channels) {
      if (value === channel) channels.delete(key);
    }
  }),
}));

vi.mock('../lib/supabase', () => {
  return {
    isSupabaseConfigured: () => true,
    supabase: {
      channel(topic: string): MockChannel {
        let ch = channels.get(topic);
        if (!ch) {
          ch = {
            topic,
            subscribed: false,
            callbacks: [],
            on(_event, _filter, cb) {
              if (ch!.subscribed) {
                throw new Error(`cannot add postgres_changes callbacks for realtime:${topic} after subscribe()`);
              }
              ch!.callbacks.push(cb);
              return ch!;
            },
            subscribe() {
              ch!.subscribed = true;
              return ch!;
            },
          };
          channels.set(topic, ch);
        }
        return ch;
      },
      removeChannel: removeChannelMock,
    },
  };
});

vi.mock('../contexts/AuthContext', () => {
  const getAuthToken = async () => null;
  return { useAuthContext: () => ({ getAuthToken, isLoaded: true, churchId }) };
});

function jsonResponse(body: unknown) {
  return { ok: true, status: 200, statusText: 'OK', json: async () => body } as Response;
}

describe('useDecisionQueue — shared realtime channel across simultaneous mounts', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    channels.clear();
    removeChannelMock.mockClear();
    fetchMock.mockReset();
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse({ items: [], counts: { total: 0, critical: 0, by_kind: {} } })));
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not throw when two consumers mount for the same churchId at once (Layout + DecisionQueuePanel)', async () => {
    const layout = renderHook(() => useDecisionQueue());
    const panel = renderHook(() => useDecisionQueue());

    await waitFor(() => expect(layout.result.current.isLoading).toBe(false));
    await waitFor(() => expect(panel.result.current.isLoading).toBe(false));

    // Accessing `.current` re-throws anything thrown during render — if the
    // second mount's `.on()` call had thrown, either waitFor above or these
    // reads would have already failed the test.
    expect(layout.result.current.error).toBeNull();
    expect(panel.result.current.error).toBeNull();

    // Only one real channel/subscription should have been created for the
    // shared topic — proof the second mount reused it instead of racing
    // its own `.channel().on().subscribe()`.
    expect(channels.size).toBe(1);
    expect(channels.get(`decision-queue-${churchId}`)?.callbacks.length).toBe(1);

    layout.unmount();
    panel.unmount();
  });

  it('fans a single realtime event out to every mounted consumer', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const layout = renderHook(() => useDecisionQueue());
      const panel = renderHook(() => useDecisionQueue());

      await vi.waitFor(() => expect(layout.result.current.isLoading).toBe(false));
      await vi.waitFor(() => expect(panel.result.current.isLoading).toBe(false));

      const callsBeforeEvent = fetchMock.mock.calls.length;

      const channel = channels.get(`decision-queue-${churchId}`);
      expect(channel).toBeDefined();
      channel!.callbacks.forEach((cb) => cb());

      await vi.advanceTimersByTimeAsync(3_000);

      // Both hook instances share one channel and one debounce timer per
      // subscription, so the underlying refetch fires once — but both
      // consumers' refresh() is wired to the same refreshRef, so this
      // proves the shared listener set actually notified this instance.
      expect(fetchMock.mock.calls.length).toBeGreaterThan(callsBeforeEvent);

      layout.unmount();
      panel.unmount();
    } finally {
      vi.useRealTimers();
    }
  });

  it('only tears down the channel once every consumer has unmounted (ref-counted cleanup)', async () => {
    const layout = renderHook(() => useDecisionQueue());
    const panel = renderHook(() => useDecisionQueue());

    await waitFor(() => expect(layout.result.current.isLoading).toBe(false));
    await waitFor(() => expect(panel.result.current.isLoading).toBe(false));

    layout.unmount();
    expect(removeChannelMock).not.toHaveBeenCalled();
    expect(channels.size).toBe(1);

    panel.unmount();
    expect(removeChannelMock).toHaveBeenCalledTimes(1);
    expect(channels.size).toBe(0);
  });
});
