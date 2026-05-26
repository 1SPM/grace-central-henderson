/**
 * Fetches Financial Hub data from the API.
 *
 * Uses the Clerk session token via useAuthContext's getToken pattern.
 * Returns USD-converted numbers for display + the raw micro-USD totals
 * for any downstream math (UI prefers micro to avoid float drift on
 * recomputed deltas).
 */

import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-react';

export interface FinancialHubSummaryUsd {
  netUsd: number;
  grossUsd: number;
  refundUsd: number;
  feeUsd: number;
  netMicroUsd: number;
  grossMicroUsd: number;
  refundMicroUsd: number;
  feeMicroUsd: number;
  donationCount: number;
  uniqueDonors: number;
  bySource: Record<string, { creditUsd: number; debitUsd: number; creditMicroUsd: number; debitMicroUsd: number; count: number }>;
}

export interface FinancialHubTimelinePoint {
  date: string;
  creditUsd: number;
  netUsd: number;
  refundUsd: number;
  feeUsd: number;
  creditMicroUsd: number;
  netMicroUsd: number;
  refundMicroUsd: number;
  feeMicroUsd: number;
  donationCount: number;
}

export interface FinancialHubFund {
  fund: string;
  creditUsd: number;
  creditMicroUsd: number;
  count: number;
  percentOfTotal: number;
}

export interface FinancialHubComparison {
  current: FinancialHubSummaryUsd;
  prior: FinancialHubSummaryUsd;
  deltaNetUsd: number;
  deltaNetMicroUsd: number;
  deltaPercent: number | null;          // null when prior was $0 and current > 0
  deltaDonationCount: number;
}

export interface FinancialHubData {
  range: { from: string; to: string };
  summary: FinancialHubSummaryUsd;
  timeline: FinancialHubTimelinePoint[];
  funds: FinancialHubFund[];
  comparison: FinancialHubComparison | null;
}

export interface UseFinancialHubReturn {
  data: FinancialHubData | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useFinancialHub(params: {
  from: string;
  to: string;
  compare?: boolean;
}): UseFinancialHubReturn {
  const { getToken, isSignedIn } = useAuth();
  const [data, setData] = useState<FinancialHubData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  const refetch = useCallback(() => setReloadCounter((c) => c + 1), []);

  useEffect(() => {
    if (!isSignedIn) {
      setData(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error('not authenticated');

        const qs = new URLSearchParams({ from: params.from, to: params.to });
        if (params.compare) qs.set('compare', 'prior_period');

        const r = await fetch(`/api/financial-hub/summary?${qs}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          throw new Error((body as { error?: string }).error ?? `HTTP ${r.status}`);
        }
        const payload = (await r.json()) as FinancialHubData;
        if (!cancelled) setData(payload);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'fetch failed');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [params.from, params.to, params.compare, isSignedIn, getToken, reloadCounter]);

  return { data, isLoading, error, refetch };
}

// ---- Date helpers ------------------------------------------------------

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function defaultRange(days = 30): { from: string; to: string } {
  const today = new Date();
  const start = new Date(today.getTime() - (days - 1) * 86_400_000);
  return { from: isoDate(start), to: isoDate(today) };
}
