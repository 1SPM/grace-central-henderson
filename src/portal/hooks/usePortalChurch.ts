import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch, WorkOsApiError } from '../../lib/services/workos';

export interface PortalChurchData {
  church: { name: string; address: string | null; city: string | null; state: string | null; zip: string | null; phone: string | null; email: string | null; website: string | null } | null;
  service_times: { day?: string; time?: string; label?: string }[];
  leadership: { id: string; name: string; photo_url: string | null; title: string; ministry: string | null; bio: string | null }[];
  announcements: { id: string; title: string; body: string | null; category: string; pinned: boolean; created_at: string }[];
  ministries: { id: string; name: string; description: string | null }[];
  groups: { id: string; name: string; description: string | null; meeting_day: string | null; meeting_time: string | null; location: string | null }[];
  events: { id: string; title: string; start_date: string; location: string | null; category: string }[];
}

export function usePortalChurch() {
  const { getAuthToken } = usePortalAuth();
  const [data, setData] = useState<PortalChurchData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const result = await workosFetch<PortalChurchData>('/api/portal/church', getAuthToken);
      setData(result);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) setForbidden(true);
      else setError(err instanceof Error ? err.message : 'Failed to load church information');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { data, isLoading, error, forbidden, refresh };
}
