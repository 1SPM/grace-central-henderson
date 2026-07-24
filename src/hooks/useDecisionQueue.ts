import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const REALTIME_DEBOUNCE_MS = 3_000;
const FALLBACK_POLL_MS = 60_000;

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
    const sb = supabase;
    const channel = sb
      .channel(`decision-queue-${churchId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'platform_events', filter: `church_id=eq.${churchId}` },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => refreshRef.current(), REALTIME_DEBOUNCE_MS);
        },
      )
      .subscribe();

    return () => {
      clearInterval(pollId);
      if (debounceTimer) clearTimeout(debounceTimer);
      void sb.removeChannel(channel);
    };
  }, [isLoaded, churchId]);

  return { items, counts, isLoading, error, refresh };
}
