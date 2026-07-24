import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export interface GiftInKindTransaction {
  id: string;
  category: string;
  transaction_type: 'contribution' | 'distribution';
  description: string | null;
  quantity: number | null;
  quantity_unit: string | null;
  estimated_value: number | null;
  occurred_at: string;
  created_at: string;
}

export interface GiftInKindNewTransaction {
  category: string;
  transaction_type: 'contribution' | 'distribution';
  description?: string;
  quantity?: number;
  quantity_unit?: string;
  estimated_value?: number;
  occurred_at?: string;
}

interface GiftInKindResponse {
  transactions: GiftInKindTransaction[];
  balances_by_category: Record<string, number>;
}

export function useGiftInKind() {
  const { getAuthToken } = useAuthContext();
  const [transactions, setTransactions] = useState<GiftInKindTransaction[]>([]);
  const [balances, setBalances] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<GiftInKindResponse>('/api/finance/gift-in-kind', getAuthToken);
      setTransactions(data.transactions ?? []);
      setBalances(data.balances_by_category ?? {});
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load gift-in-kind ledger');
      }
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  const record = useCallback(async (input: GiftInKindNewTransaction) => {
    await workosFetch('/api/finance/gift-in-kind', getAuthToken, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { transactions, balances, isLoading, error, forbidden, refresh, record };
}
