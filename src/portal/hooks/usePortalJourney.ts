import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export interface JourneyItem {
  id: string;
  item_type: 'goal' | 'saved_resource';
  title: string;
  description: string | null;
  status: 'active' | 'completed' | 'archived';
  created_at: string;
}

export interface PortalJourneyData {
  onboarding: { steps: { key: string; label: string; completed: boolean }[]; current_step: { key: string; label: string; completed: boolean } | null };
  goals: JourneyItem[];
  saved_resources: JourneyItem[];
  completed_milestones: { milestone_type: string; completed_at: string }[];
}

export function usePortalJourney() {
  const { getAuthToken } = usePortalAuth();
  const [data, setData] = useState<PortalJourneyData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<PortalJourneyData>('/api/portal/journey', getAuthToken);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your journey');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const addGoal = useCallback(async (title: string, description?: string) => {
    await workosFetch('/api/portal/journey', getAuthToken, {
      method: 'POST',
      body: JSON.stringify({ item_type: 'goal', title, description }),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  const saveResource = useCallback(async (title: string, referenceType?: string, referenceId?: string) => {
    await workosFetch('/api/portal/journey', getAuthToken, {
      method: 'POST',
      body: JSON.stringify({ item_type: 'saved_resource', title, reference_type: referenceType, reference_id: referenceId }),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  const setItemStatus = useCallback(async (id: string, status: JourneyItem['status']) => {
    await workosFetch(`/api/portal/journey?id=${encodeURIComponent(id)}`, getAuthToken, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  return { data, isLoading, error, refresh, addGoal, saveResource, setItemStatus };
}
