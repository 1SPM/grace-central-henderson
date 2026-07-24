import { useCallback, useEffect, useState } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { workosFetch, WorkOsApiError } from '../lib/services/workos';

export interface ExpenseRow {
  id: string;
  functional_category: 'program' | 'g_and_a';
  category: string;
  amount: number;
  fund: string | null;
  expense_date: string;
  description: string | null;
  created_at: string;
}

export interface ExpenseRatio {
  program_total: number;
  g_and_a_total: number;
  total: number;
  program_ratio: number | null;
}

export interface NewExpense {
  functional_category: 'program' | 'g_and_a';
  category: string;
  amount: number;
  fund?: string;
  expense_date?: string;
  description?: string;
}

interface ExpensesResponse {
  expenses: ExpenseRow[];
  ratio: ExpenseRatio;
}

export function useExpenses() {
  const { getAuthToken } = useAuthContext();
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [ratio, setRatio] = useState<ExpenseRatio | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    setForbidden(false);
    try {
      const data = await workosFetch<ExpensesResponse>('/api/finance/expenses', getAuthToken);
      setExpenses(data.expenses ?? []);
      setRatio(data.ratio ?? null);
    } catch (err) {
      if (err instanceof WorkOsApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load expenses');
      }
    } finally {
      setIsLoading(false);
    }
  }, [getAuthToken]);

  const record = useCallback(async (input: NewExpense) => {
    await workosFetch('/api/finance/expenses', getAuthToken, {
      method: 'POST',
      body: JSON.stringify(input),
    });
    await refresh();
  }, [getAuthToken, refresh]);

  useEffect(() => { void refresh(); }, [refresh]);

  return { expenses, ratio, isLoading, error, forbidden, refresh, record };
}
