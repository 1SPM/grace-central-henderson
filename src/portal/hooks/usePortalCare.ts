import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export interface CareRequestStatus {
  id: string;
  category: string;
  status: 'Received' | 'Assigned' | 'In Progress' | 'Waiting for Information' | 'Completed';
  submitted_at: string;
  resolved_at: string | null;
}

export interface CareSubmission {
  category: string;
  message: string;
  preferred_contact_method?: 'email' | 'sms' | 'phone' | 'either';
  requests_human_followup?: boolean;
  visibility?: 'private_pastoral_care' | 'specific_care_team';
}

export function usePortalCare() {
  const { getAuthToken } = usePortalAuth();
  const [requests, setRequests] = useState<CareRequestStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<{ requests: CareRequestStatus[] }>('/api/portal/care', getAuthToken);
      setRequests(result.requests);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your care requests');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const submit = useCallback(async (input: CareSubmission) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await workosFetch<{ request: CareRequestStatus }>('/api/portal/care', getAuthToken, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await refresh();
      return result.request;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your request');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [getAuthToken, refresh]);

  return { requests, isLoading, error, isSubmitting, refresh, submit };
}
