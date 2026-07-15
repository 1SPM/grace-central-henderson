import { useCallback, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export function usePortalVolunteer() {
  const { getAuthToken } = usePortalAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastTaskId, setLastTaskId] = useState<string | null>(null);

  const submit = useCallback(async (area: string, message?: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      const result = await workosFetch<{ task_id: string | null }>('/api/portal/volunteer', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ area, message }),
      });
      setLastTaskId(result.task_id);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your interest');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [getAuthToken]);

  return { submit, isSubmitting, error, lastTaskId };
}
