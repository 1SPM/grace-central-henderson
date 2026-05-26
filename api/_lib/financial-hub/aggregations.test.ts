import { describe, it, expect } from 'vitest';
import {
  summarize,
  dailyTimeline,
  enumerateDates,
  fundBreakdown,
  topGivers,
  comparePeriods,
  type LedgerRow,
} from './aggregations';

function row(overrides: Partial<LedgerRow>): LedgerRow {
  return {
    source: 'stripe',
    kind: 'donation',
    direction: 'credit',
    amount_micro_usd: 1_000_000,
    occurred_at: '2026-05-24T12:00:00Z',
    related_person_id: 'p1',
    metadata: {},
    ...overrides,
  };
}

describe('financial-hub/aggregations — summarize', () => {
  it('zeros for empty input', () => {
    const s = summarize([]);
    expect(s.netMicroUsd).toBe(0);
    expect(s.donationCount).toBe(0);
    expect(s.uniqueDonors).toBe(0);
    expect(s.bySource).toEqual({});
  });

  it('sums credits as gross and counts donations + donors', () => {
    const s = summarize([
      row({ amount_micro_usd: 5_000_000, related_person_id: 'p1' }),
      row({ amount_micro_usd: 3_000_000, related_person_id: 'p1' }),
      row({ amount_micro_usd: 2_000_000, related_person_id: 'p2' }),
    ]);
    expect(s.grossMicroUsd).toBe(10_000_000);
    expect(s.netMicroUsd).toBe(10_000_000);
    expect(s.donationCount).toBe(3);
    expect(s.uniqueDonors).toBe(2);
  });

  it('subtracts refunds and fees from net', () => {
    const s = summarize([
      row({ amount_micro_usd: 10_000_000 }),
      row({ direction: 'debit', kind: 'refund', amount_micro_usd: 1_000_000 }),
      row({ direction: 'debit', kind: 'fee', amount_micro_usd: 300_000 }),
    ]);
    expect(s.grossMicroUsd).toBe(10_000_000);
    expect(s.refundMicroUsd).toBe(1_000_000);
    expect(s.feeMicroUsd).toBe(300_000);
    expect(s.netMicroUsd).toBe(8_700_000);
  });

  it('handles missing related_person_id (anonymous donor) for count but not uniqueness', () => {
    const s = summarize([
      row({ related_person_id: null }),
      row({ related_person_id: null }),
    ]);
    expect(s.donationCount).toBe(2);
    expect(s.uniqueDonors).toBe(0);
  });

  it('bySource breaks down per source with counts', () => {
    const s = summarize([
      row({ source: 'stripe', amount_micro_usd: 5_000_000 }),
      row({ source: 'stripe', amount_micro_usd: 3_000_000 }),
      row({ source: 'i2c', amount_micro_usd: 1_000_000 }),
      row({ source: 'i2c', direction: 'debit', kind: 'fee', amount_micro_usd: 50_000 }),
    ]);
    expect(s.bySource.stripe).toEqual({ creditMicroUsd: 8_000_000, debitMicroUsd: 0, count: 2 });
    expect(s.bySource.i2c).toEqual({ creditMicroUsd: 1_000_000, debitMicroUsd: 50_000, count: 2 });
  });

  it('ignores non-numeric amounts safely', () => {
    const s = summarize([row({ amount_micro_usd: Number('not-a-number') })]);
    expect(s.netMicroUsd).toBe(0);
    expect(s.grossMicroUsd).toBe(0);
  });
});

describe('financial-hub/aggregations — enumerateDates', () => {
  it('inclusive range', () => {
    expect(enumerateDates('2026-05-24', '2026-05-26')).toEqual([
      '2026-05-24', '2026-05-25', '2026-05-26',
    ]);
  });

  it('single-day range', () => {
    expect(enumerateDates('2026-05-24', '2026-05-24')).toEqual(['2026-05-24']);
  });

  it('end before start returns empty', () => {
    expect(enumerateDates('2026-05-24', '2026-05-23')).toEqual([]);
  });

  it('invalid dates return empty', () => {
    expect(enumerateDates('not-a-date', '2026-05-23')).toEqual([]);
  });
});

describe('financial-hub/aggregations — dailyTimeline', () => {
  it('buckets rows by UTC day and fills zero-days', () => {
    const points = dailyTimeline(
      [
        row({ amount_micro_usd: 5_000_000, occurred_at: '2026-05-24T10:00:00Z' }),
        row({ amount_micro_usd: 3_000_000, occurred_at: '2026-05-24T20:00:00Z' }),
        row({ amount_micro_usd: 1_000_000, occurred_at: '2026-05-26T05:00:00Z' }),
        row({ direction: 'debit', kind: 'fee', amount_micro_usd: 100_000, occurred_at: '2026-05-24T10:00:01Z' }),
      ],
      '2026-05-24',
      '2026-05-26',
    );
    expect(points).toHaveLength(3);
    expect(points[0].date).toBe('2026-05-24');
    expect(points[0].creditMicroUsd).toBe(8_000_000);
    expect(points[0].feeMicroUsd).toBe(100_000);
    expect(points[0].netMicroUsd).toBe(7_900_000);
    expect(points[0].donationCount).toBe(2);
    expect(points[1].date).toBe('2026-05-25');
    expect(points[1].creditMicroUsd).toBe(0);           // zero-fill
    expect(points[2].date).toBe('2026-05-26');
    expect(points[2].creditMicroUsd).toBe(1_000_000);
  });

  it('returns just the requested window even if rows span wider', () => {
    const points = dailyTimeline(
      [row({ occurred_at: '2026-05-01T00:00:00Z' }), row({ occurred_at: '2026-05-25T00:00:00Z' })],
      '2026-05-24',
      '2026-05-25',
    );
    expect(points.map((p) => p.date)).toEqual(['2026-05-24', '2026-05-25']);
    expect(points[0].creditMicroUsd).toBe(0);
    expect(points[1].creditMicroUsd).toBe(1_000_000);
  });
});

describe('financial-hub/aggregations — fundBreakdown', () => {
  it('groups by metadata.fund and computes percentages', () => {
    const buckets = fundBreakdown([
      row({ amount_micro_usd: 10_000_000, metadata: { fund: 'tithe' } }),
      row({ amount_micro_usd:  5_000_000, metadata: { fund: 'tithe' } }),
      row({ amount_micro_usd:  3_000_000, metadata: { fund: 'missions' } }),
      row({ amount_micro_usd:  2_000_000, metadata: {} }),                 // → 'general'
    ]);
    expect(buckets[0]).toEqual({ fund: 'tithe', creditMicroUsd: 15_000_000, count: 2, percentOfTotal: 0.75 });
    expect(buckets[1]).toEqual({ fund: 'missions', creditMicroUsd: 3_000_000, count: 1, percentOfTotal: 0.15 });
    expect(buckets[2]).toEqual({ fund: 'general', creditMicroUsd: 2_000_000, count: 1, percentOfTotal: 0.1 });
  });

  it('ignores refunds and fees (donations only)', () => {
    const buckets = fundBreakdown([
      row({ amount_micro_usd: 5_000_000, metadata: { fund: 'tithe' } }),
      row({ direction: 'debit', kind: 'refund', amount_micro_usd: 1_000_000, metadata: { fund: 'tithe' } }),
      row({ direction: 'debit', kind: 'fee', amount_micro_usd: 100_000, metadata: { fund: 'tithe' } }),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].creditMicroUsd).toBe(5_000_000);
  });
});

describe('financial-hub/aggregations — topGivers', () => {
  it('sorts by total descending, includes counts + first/last gift dates', () => {
    const givers = topGivers([
      row({ related_person_id: 'p1', amount_micro_usd: 5_000_000, occurred_at: '2026-05-01T00:00:00Z' }),
      row({ related_person_id: 'p1', amount_micro_usd: 5_000_000, occurred_at: '2026-05-15T00:00:00Z' }),
      row({ related_person_id: 'p2', amount_micro_usd: 8_000_000, occurred_at: '2026-05-10T00:00:00Z' }),
      row({ related_person_id: 'p3', amount_micro_usd: 1_000_000, occurred_at: '2026-05-20T00:00:00Z' }),
    ]);
    expect(givers).toHaveLength(3);
    expect(givers[0].personId).toBe('p1');
    expect(givers[0].totalMicroUsd).toBe(10_000_000);
    expect(givers[0].giftCount).toBe(2);
    expect(givers[0].firstGiftAt).toBe('2026-05-01T00:00:00Z');
    expect(givers[0].lastGiftAt).toBe('2026-05-15T00:00:00Z');
    expect(givers[1].personId).toBe('p2');
    expect(givers[2].personId).toBe('p3');
  });

  it('respects limit', () => {
    const givers = topGivers(
      Array.from({ length: 20 }, (_, i) => row({ related_person_id: `p${i}`, amount_micro_usd: (i + 1) * 1_000_000 })),
      5,
    );
    expect(givers).toHaveLength(5);
  });

  it('drops anonymous gifts (no person_id)', () => {
    const givers = topGivers([
      row({ related_person_id: null, amount_micro_usd: 100_000_000 }),
      row({ related_person_id: 'p1', amount_micro_usd: 1_000_000 }),
    ]);
    expect(givers).toHaveLength(1);
    expect(givers[0].personId).toBe('p1');
  });
});

describe('financial-hub/aggregations — comparePeriods', () => {
  it('computes deltaNet + deltaPercent vs prior', () => {
    const cmp = comparePeriods(
      [row({ amount_micro_usd: 12_000_000 })],
      [row({ amount_micro_usd: 10_000_000 })],
    );
    expect(cmp.deltaNetMicroUsd).toBe(2_000_000);
    expect(cmp.deltaPercent).toBeCloseTo(0.2);
    expect(cmp.deltaDonationCount).toBe(0);
  });

  it('returns Infinity when prior period had $0 and current has money', () => {
    const cmp = comparePeriods([row({ amount_micro_usd: 100 })], []);
    expect(cmp.deltaPercent).toBe(Infinity);
  });

  it('returns 0 when both periods are empty', () => {
    expect(comparePeriods([], []).deltaPercent).toBe(0);
  });

  it('negative delta when current < prior', () => {
    const cmp = comparePeriods(
      [row({ amount_micro_usd: 5_000_000 })],
      [row({ amount_micro_usd: 10_000_000 })],
    );
    expect(cmp.deltaPercent).toBeCloseTo(-0.5);
  });
});
