import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const REALTIME_DEBOUNCE_MS = 3_000;
const FALLBACK_POLL_MS = 60_000;

// useDecisionQueue is a shared data hook called from many places at once
// (Layout.tsx, DecisionQueuePanel, CampusView, AskGrace, BriefScreen) --
// unlike a component-scoped hook, several instances routinely mount for
// the SAME churchId simultaneously (e.g. Layout.tsx's own call plus
// DecisionQueuePanel's, both live on the dashboard). Supabase's realtime
// client keys channels by topic name, so two independent
// `.channel('decision-queue-X').on(...).subscribe()` calls for the same
// X don't create two channels -- the second `.channel()` call returns the
// SAME already-subscribed object, and its `.on()` throws ("cannot add
// postgres_changes callbacks ... after subscribe()"), taking down every
// consumer with an ErrorBoundary. This module-level registry makes the
// channel a singleton per churchId: the first mount creates and
// subscribes it, later mounts just add their own listener to the shared
// set, and the channel is only torn down once the last listener leaves.
interface DecisionQueueChannelEntry {
  channel: RealtimeChannel;
  listeners: Set<() => void>;
}
const channelRegistry = new Map<string, DecisionQueueChannelEntry>();

function subscribeToDecisionQueueChanges(churchId: string, onChange: () => void): () => void {
  let entry = channelRegistry.get(churchId);
  if (!entry) {
    if (!supabase) throw new Error('subscribeToDecisionQueueChanges called without a configured Supabase client');
    const sb = supabase;
    const listeners = new Set<() => void>();
    const channel = sb
      .channel(`decision-queue-${churchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'platform_events', filter: `church_id=eq.${churchId}` },
        () => listeners.forEach((fn) => fn()),
      )
      .subscribe();
    entry = { channel, listeners };
    channelRegistry.set(churchId, entry);
  }
  entry.listeners.add(onChange);

  return () => {
    const current = channelRegistry.get(churchId);
    if (!current) return;
    current.listeners.delete(onChange);
    if (current.listeners.size === 0) {
      channelRegistry.delete(churchId);
      void supabase?.removeChannel(current.channel);
    }
  };
}

// Mirrors DecisionQueueKind in api/_lib/decisionQueue.ts — kept as a
// separate local type rather than a cross-import, matching how every
// other WorkOS hook (e.g. useWorkOsSummary's WorkOsMetric) keeps its own
// response-shape type independent of the backend module.
export type DecisionQueueKind =
  | 'approval'
  | 'related_party_review'
  | 'crisis'
  | 'care_triage'
  | 'kyc_review'
  | 'failed_transfer'
  | 'invitation_stalled'
  | 'agent_finding';

export interface DecisionQueueItem {
  id: string;
  kind: DecisionQueueKind;
  title: string;
  detail?: string;
  severity: 'critical' | 'high' | 'normal';
  created_at: string;
  age_hours: number;
  href: string;
  required_permission: string;
  subject_type: string;
  subject_id: string;
}

export interface DecisionQueueCounts {
  total: number;
  critical: number;
  by_kind: Partial<Record<DecisionQueueKind, number>>;
}

interface DecisionQueueResponse {
  items: DecisionQueueItem[];
  counts: DecisionQueueCounts;
}

const EMPTY_COUNTS: DecisionQueueCounts = { total: 0, critical: 0, by_kind: {} };

export function useDecisionQueue() {
  const { getAuthToken, isLoaded, churchId } = useAuthContext();
  const [items, setItems] = useState<DecisionQueueItem[]>([]);
  const [counts, setCounts] = useState<DecisionQueueCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refreshRef = useRef<() => void>(() => {});

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await workosFetch<DecisionQueueResponse>('/api/workos/decision-queue', getAuthToken);
      setItems(data.items ?? []);
      setCounts(data.counts ?? EMPTY_COUNTS);
    } catch (err) {
      setError(err instanceof WorkOsApiError ? err.message : 'Failed to load the decision queue');
      setItems([]);
      setCounts(EMPTY_COUNTS);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => {
    refreshRef.current = () => { void refresh(); };
  }, [refresh]);

  useEffect(() => {
    if (!isLoaded) return;
    void refresh();
  }, [isLoaded, refresh]);

  // Realtime: a new platform_events row is a "something changed" signal
  // only — never parsed for content, just triggers a debounced refetch
  // through the normal authenticated route (which re-applies every
  // permission gate).
  //
  // The 60s poll runs UNCONDITIONALLY alongside the subscription — it
  // is the floor, not the mechanism. An RLS-filtered subscription
  // reports a healthy SUBSCRIBED status while delivering nothing (the
  // guaranteed state on the demo tenant, where no Clerk session means
  // the websocket authenticates as anon and platform_events' tenant
  // RLS blocks every message), so a poll gated on CHANNEL_ERROR never
  // engages exactly when it's needed. Realtime, when it works, just
  // makes updates arrive in ~5s instead of ≤60s.
  useEffect(() => {
    if (!isLoaded || !churchId) return;

    const pollId = setInterval(() => refreshRef.current(), FALLBACK_POLL_MS);

    if (!isSupabaseConfigured() || !supabase) {
      return () => clearInterval(pollId);
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribeToDecisionQueueChanges(churchId, () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => refreshRef.current(), REALTIME_DEBOUNCE_MS);
    });

    return () => {
      clearInterval(pollId);
      if (debounceTimer) clearTimeout(debounceTimer);
      unsubscribe();
    };
  }, [isLoaded, churchId]);

  return { items, counts, isLoading, error, refresh };
}
