import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export interface PortalGroup {
  id: string;
  name: string;
  description: string | null;
  meeting_day: string | null;
  meeting_time: string | null;
  location: string | null;
  my_status: 'pending' | 'active' | 'declined' | null;
}

export function usePortalGroups() {
  const { getAuthToken } = usePortalAuth();
  const [groups, setGroups] = useState<PortalGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<{ groups: PortalGroup[] }>('/api/portal/groups', getAuthToken);
      setGroups(result.groups);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load groups');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const requestToJoin = useCallback(async (groupId: string) => {
    setJoiningId(groupId);
    try {
      await workosFetch('/api/portal/groups', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ group_id: groupId }),
      });
      await refresh();
    } finally {
      setJoiningId(null);
    }
  }, [getAuthToken, refresh]);

  return { groups, isLoading, error, joiningId, refresh, requestToJoin };
}
