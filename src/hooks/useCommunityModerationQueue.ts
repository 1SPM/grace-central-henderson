import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export interface ModerationQueuePost {
  id: string;
  post_type: string;
  body: string;
  created_at: string;
  author_name: string;
}

export interface ReportedQueuePost extends ModerationQueuePost {
  report_count: number;
  report_reasons: string[];
}

type Decision = 'approved' | 'rejected' | 'removed';

/**
 * The staff moderation queue (TD-051): posts awaiting first review, and
 * approved posts a member has since reported. Backed by the existing,
 * already-tested api/community/_queue.ts (read) and _moderate.ts (act) —
 * this hook is the first thing in src/ to call either.
 */
export function useCommunityModerationQueue() {
  const { getAuthToken } = useAuthContext();
  const [pending, setPending] = useState<ModerationQueuePost[]>([]);
  const [reported, setReported] = useState<ReportedQueuePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<{ pending: ModerationQueuePost[]; reported: ReportedQueuePost[] }>('/api/community/queue', getAuthToken);
      setPending(data.pending ?? []);
      setReported(data.reported ?? []);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Failed to load the moderation queue');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const decide = useCallback(async (postId: string, decision: Decision) => {
    setDecidingId(postId);
    try {
      await workosFetch(`/api/community/moderate?id=${encodeURIComponent(postId)}`, getAuthToken, {
        method: 'PATCH',
        body: JSON.stringify({ decision }),
      });
      await refresh();
    } finally {
      setDecidingId(null);
    }
  }, [getAuthToken, refresh]);

  return { pending, reported, isLoading, error, forbidden, decidingId, refresh, decide };
}
