/**
 * Active staff of this church — the list behind every "who owns this?" picker.
 *
 * Separate from useMinistryAreas so a Work Order screen doesn't have to pull
 * the whole ministry map just to name a person.
 */
import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch } from '../lib/services/workos';

export interface StaffMember {
  user_id: string;
  name: string;
  title: string | null;
}

export function useChurchStaff() {
  const { getAuthToken } = useAuthContext();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await workosFetch<{ staff?: StaffMember[] }>('/api/workos/staff', getAuthToken);
      // An unreadable staff list must degrade to an empty picker, never crash
      // the screen it is embedded in.
      setStaff(Array.isArray(data?.staff) ? data.staff : []);
    } catch {
      setStaff([]);
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const nameFor = useCallback(
    (userId: string | null | undefined): string | null =>
      (userId ? staff.find(s => s.user_id === userId)?.name ?? null : null),
    [staff],
  );

  return { staff, isLoading, refresh, nameFor };
}
