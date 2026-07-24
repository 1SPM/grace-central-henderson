import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export type NotificationCategory = 'crisis' | 'approvals' | 'finance' | 'agents' | 'digest';
export type NotificationChannel = 'email' | 'sms';

export interface NotificationPrefRow {
  category: NotificationCategory;
  channel: NotificationChannel;
  enabled: boolean;
}

interface PrefsResponse {
  prefs: NotificationPrefRow[];
  phone: string | null;
}

export function useNotificationPrefs() {
  const { getAuthToken } = useAuthContext();
  const [prefs, setPrefs] = useState<NotificationPrefRow[]>([]);
  const [phone, setPhone] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await workosFetch<PrefsResponse>('/api/workos/notification-prefs', getAuthToken);
      setPrefs(data.prefs ?? []);
      setPhone(data.phone ?? null);
    } catch (err) {
      setError(err instanceof WorkOsApiError ? err.message : 'Failed to load notification preferences');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const save = useCallback(async (nextPrefs: NotificationPrefRow[], nextPhone?: string) => {
    setIsSaving(true);
    setError(null);
    try {
      const data = await workosFetch<PrefsResponse>('/api/workos/notification-prefs', getAuthToken, {
        method: 'PUT',
        body: JSON.stringify({ prefs: nextPrefs, ...(nextPhone ? { phone: nextPhone } : {}) }),
      });
      setPrefs(data.prefs ?? nextPrefs);
      await refresh();
      return true;
    } catch (err) {
      setError(err instanceof WorkOsApiError ? err.message : 'Failed to save notification preferences');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [getAuthToken, refresh]);

  function isEnabled(category: NotificationCategory, channel: NotificationChannel): boolean {
    return prefs.find(p => p.category === category && p.channel === channel)?.enabled ?? false;
  }

  return { prefs, phone, isLoading, isSaving, error, refresh, save, isEnabled };
}
