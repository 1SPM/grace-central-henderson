import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch, WorkOsApiError } from '../../lib/services/workos';

export interface PortalHomeData {
  greeting_name: string;
  upcoming_events: { id: string; title: string; start_date: string; location: string | null; category: string; my_rsvp: string | null }[];
  onboarding: { steps: { key: string; label: string; completed: boolean }[]; current_step: { key: string; label: string; completed: boolean } | null };
  group_activity: { count: number; groups: { id: string; name: string }[] };
  notifications: { id: string; title: string; body: string | null; created_at: string }[];
  volunteer_opportunities: { key: string; title: string; description: string }[];
  next_actions: { label: string; action: string }[];
}

export function usePortalHome() {
  const { getAuthToken } = usePortalAuth();
  const [data, setData] = useState<PortalHomeData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const result = await workosFetch<PortalHomeData>('/api/portal/home', getAuthToken);
      setData(result);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Failed to load your home page');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, isLoading, error, forbidden, refresh };
}
