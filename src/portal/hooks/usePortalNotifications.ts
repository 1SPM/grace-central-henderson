import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export interface PortalNotification {
  id: string;
  channel: string;
  title: string;
  body: string | null;
  status: string;
  read_at: string | null;
  created_at: string;
}

export function usePortalNotifications() {
  const { getAuthToken } = usePortalAuth();
  const [notifications, setNotifications] = useState<PortalNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<{ notifications: PortalNotification[] }>('/api/portal/notifications', getAuthToken);
      setNotifications(result.notifications);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load notifications');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const markRead = useCallback(async (id: string) => {
    await workosFetch(`/api/portal/notifications?id=${encodeURIComponent(id)}`, getAuthToken, { method: 'PATCH' });
    await refresh();
  }, [getAuthToken, refresh]);

  return { notifications, isLoading, error, refresh, markRead };
}
