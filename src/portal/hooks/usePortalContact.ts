import { useCallback, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export function usePortalContact() {
  const { getAuthToken } = usePortalAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (subject: string, message: string) => {
    setIsSubmitting(true);
    setError(null);
    try {
      return await workosFetch<{ task_id: string | null }>('/api/portal/contact', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ subject, message }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your message');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [getAuthToken]);

  return { submit, isSubmitting, error };
}
