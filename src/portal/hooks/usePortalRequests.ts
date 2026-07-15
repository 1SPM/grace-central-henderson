import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export interface PortalRequestStatus {
  id: string;
  title: string;
  request_type: string;
  status: 'Received' | 'Assigned' | 'In Progress' | 'Waiting for Information' | 'Completed';
  submitted_at: string;
  completed_at: string | null;
}

export function usePortalRequests() {
  const { getAuthToken } = usePortalAuth();
  const [requests, setRequests] = useState<PortalRequestStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<{ requests: PortalRequestStatus[] }>('/api/portal/requests', getAuthToken);
      setRequests(result.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your requests');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { requests, isLoading, error, refresh };
}
