import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export interface PrayerWallEntry {
  id: string;
  content: string;
  is_answered: boolean;
  created_at: string;
  author_name: string | null;
  is_anonymous: boolean;
}

export type PrayerVisibility = 'private_pastoral_care' | 'specific_care_team' | 'selected_group' | 'church_prayer_wall' | 'anonymous_prayer_wall';

export interface PrayerSubmitResult {
  request: { id: string; visibility: string; created_at: string };
  visibility_overridden: boolean;
  crisis_resource_message?: string;
}

export function usePortalPrayerWall() {
  const { getAuthToken } = usePortalAuth();
  const [entries, setEntries] = useState<PrayerWallEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState<PrayerSubmitResult | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<{ requests: PrayerWallEntry[] }>('/api/portal/prayer?scope=wall', getAuthToken);
      setEntries(result.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the prayer wall');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submit = useCallback(async (content: string, visibility: PrayerVisibility, groupId?: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await workosFetch<PrayerSubmitResult>('/api/portal/prayer', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ content, visibility, group_id: groupId }),
      });
      setLastResult(result);
      await refresh();
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your prayer request');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [getAuthToken, refresh]);

  return { entries, isLoading, error, isSubmitting, lastResult, refresh, submit };
}
