import { describe, it, expect } from 'vitest';
import {
  bucketLedgerRows,
  detectReconciliationAnomalies,
  DEFAULT_RECONCILE_CONFIG,
} from './reconcile';

describe('reconcile — bucketLedgerRows', () => {
  it('groups rows by (church, date, source) and tracks credit/debit/fee separately', () => {
    const buckets = bucketLedgerRows([
      { church_id: 'c1', source: 'stripe', kind: 'donation', direction: 'credit', amount_micro_usd: 5_000_000, occurred_at: '2026-05-24T10:00:00Z' },
      { church_id: 'c1', source: 'stripe', kind: 'donation', direction: 'credit', amount_micro_usd: 3_000_000, occurred_at: '2026-05-24T15:00:00Z' },
      { church_id: 'c1', source: 'stripe', kind: 'fee',      direction: 'debit',  amount_micro_usd:   150_000, occurred_at: '2026-05-24T10:00:01Z' },
      { church_id: 'c2', source: 'stripe', kind: 'donation', direction: 'credit', amount_micro_usd:   500_000, occurred_at: '2026-05-24T10:00:00Z' },
      { church_id: 'c1', source: 'stripe', kind: 'donation', direction: 'credit', amount_micro_usd: 2_000_000, occurred_at: '2026-05-23T10:00:00Z' },
    ]);
    expect(buckets).toHaveLength(3);
    const c1_24 = buckets.find((b) => b.churchId === 'c1' && b.date === '2026-05-24');
    expect(c1_24).toBeDefined();
    expect(c1_24!.creditMicroUsd).toBe(8_000_000);
    expect(c1_24!.debitMicroUsd).toBe(150_000);
    expect(c1_24!.feeMicroUsd).toBe(150_000);
    expect(c1_24!.entryCount).toBe(3);
  });

  it('skips rows with missing occurred_at', () => {
    const buckets = bucketLedgerRows([
      { church_id: 'c1', source: 'stripe', kind: 'donation', direction: 'credit', amount_micro_usd: 100, occurred_at: '' },
    ]);
    expect(buckets).toHaveLength(0);
  });
});

describe('reconcile — detectReconciliationAnomalies', () => {
  const cfg = { spikeRatio: 5.0, minAbsoluteMicroUsd: 1_000_000 };

  it('returns empty when today is within range of trailing average', () => {
    const yesterday = [{ churchId: 'c1', date: '2026-05-24', source: 'stripe', creditMicroUsd: 5_000_000, debitMicroUsd: 0, feeMicroUsd: 0, entryCount: 1 }];
    const trailing = Array.from({ length: 7 }, (_, i) => ({
      churchId: 'c1', date: `2026-05-${17 + i}`, source: 'stripe',
      creditMicroUsd: 4_000_000, debitMicroUsd: 0, feeMicroUsd: 0, entryCount: 1,
    }));
    const anomalies = detectReconciliationAnomalies(yesterday, trailing, cfg);
    expect(anomalies).toEqual([]);
  });

  it('flags volume_spike when today ≥ 5× the trailing average', () => {
    const yesterday = [{ churchId: 'c1', date: '2026-05-24', source: 'stripe', creditMicroUsd: 50_000_000, debitMicroUsd: 0, feeMicroUsd: 0, entryCount: 1 }];
    const trailing = Array.from({ length: 7 }, (_, i) => ({
      churchId: 'c1', date: `2026-05-${17 + i}`, source: 'stripe',
      creditMicroUsd: 5_000_000, debitMicroUsd: 0, feeMicroUsd: 0, entryCount: 1,
    }));
    const anomalies = detectReconciliationAnomalies(yesterday, trailing, cfg);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe('volume_spike');
    expect(anomalies[0].detail).toMatch(/10\.0× trailing/);
  });

  it('flags no_history_spike when a tenant has no trailing data but credits today', () => {
    const yesterday = [{ churchId: 'c-new', date: '2026-05-24', source: 'stripe', creditMicroUsd: 5_000_000, debitMicroUsd: 0, feeMicroUsd: 0, entryCount: 1 }];
    const anomalies = detectReconciliationAnomalies(yesterday, [], cfg);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe('no_history_spike');
  });

  it('does NOT flag no_history when below absolute floor', () => {
    const yesterday = [{ churchId: 'c-new', date: '2026-05-24', source: 'stripe', creditMicroUsd: 500_000, debitMicroUsd: 0, feeMicroUsd: 0, entryCount: 1 }];
    const anomalies = detectReconciliationAnomalies(yesterday, [], cfg);
    expect(anomalies).toEqual([]);
  });

  it('flags fee_without_credit when debits ≥ 10× floor but credits = 0', () => {
    const yesterday = [{ churchId: 'c1', date: '2026-05-24', source: 'stripe', creditMicroUsd: 0, debitMicroUsd: 15_000_000, feeMicroUsd: 15_000_000, entryCount: 5 }];
    const trailing = [{ churchId: 'c1', date: '2026-05-23', source: 'stripe', creditMicroUsd: 1_000_000, debitMicroUsd: 0, feeMicroUsd: 0, entryCount: 1 }];
    const anomalies = detectReconciliationAnomalies(yesterday, trailing, cfg);
    expect(anomalies).toHaveLength(1);
    expect(anomalies[0].kind).toBe('fee_without_credit');
  });

  it('flags volume_drop when today ≤ avg / spikeRatio AND avg was healthy', () => {
    const yesterday = [{ churchId: 'c1', date: '2026-05-24', source: 'stripe', creditMicroUsd: 1_000_000, debitMicroUsd: 0, feeMicroUsd: 0, entryCount: 1 }];
    const trailing = Array.from({ length: 7 }, (_, i) => ({
      churchId: 'c1', date: `2026-05-${17 + i}`, source: 'stripe',
      creditMicroUsd: 10_000_000, debitMicroUsd: 0, feeMicroUsd: 0, entryCount: 1,
    }));
    const anomalies = detectReconciliationAnomalies(yesterday, trailing, cfg);
    expect(anomalies.some((a) => a.kind === 'volume_drop')).toBe(true);
  });

  it('respects DEFAULT_RECONCILE_CONFIG (5× / $1)', () => {
    expect(DEFAULT_RECONCILE_CONFIG.spikeRatio).toBe(5);
    expect(DEFAULT_RECONCILE_CONFIG.minAbsoluteMicroUsd).toBe(1_000_000);
  });
});
