import { useCallback, useEffect, useState } from 'react';
import { usePortalAuth } from '../PortalAuthContext';
import { workosFetch } from '../../lib/services/workos';

export interface GiftHistoryEntry {
  id: string;
  amount: number;
  fund: string;
  date: string;
  method: string;
  is_recurring: boolean;
  note: string | null;
  created_at: string;
}

export interface RecurringGiftEntry {
  id: string;
  amount: number;
  frequency: string;
  fund: string;
  next_date: string;
  payment_method_last4: string | null;
  payment_method_brand: string | null;
  status: 'active' | 'paused' | 'cancelled';
  created_at: string;
}

export interface PortalGivingData {
  giving_active: boolean;
  person_id: string;
  church_slug: string | null;
  church_name: string | null;
  gift_history: GiftHistoryEntry[];
  recurring_gifts: RecurringGiftEntry[];
  unsupported_functions: Record<string, string>;
}

export function usePortalGiving() {
  const { getAuthToken } = usePortalAuth();
  const [data, setData] = useState<PortalGivingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await workosFetch<PortalGivingData>('/api/portal/giving', getAuthToken);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load your giving history');
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  useEffect(() => { void refresh(); }, [refresh]);

  const cancelRecurring = useCallback(async (recurringGivingId: string) => {
    setIsCancelling(true);
    setError(null);
    try {
      await workosFetch('/api/portal/giving', getAuthToken, {
        method: 'POST',
        body: JSON.stringify({ action: 'cancel_recurring', recurring_giving_id: recurringGivingId }),
      });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel this recurring gift');
      throw err;
    } finally {
      setIsCancelling(false);
    }
  }, [getAuthToken, refresh]);

  return { data, isLoading, error, isCancelling, refresh, cancelRecurring };
}
