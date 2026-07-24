import { describe, it, expect } from 'vitest';
import { computeMinistryImpactMetrics } from './ministryImpactMetrics.js';

describe('computeMinistryImpactMetrics', () => {
  const fiscalYearStart = '2026-01-01';
  const asOf = '2026-07-15T00:00:00.000Z';

  it('splits gift-in-kind value and care-request counts into this-year vs. all-time', () => {
    const metrics = computeMinistryImpactMetrics({
      fiscalYearStart,
      asOf,
      giftInKindDistributions: [
        { category: 'food', estimated_value: 500, occurred_at: '2026-03-01' }, // this year
        { category: 'food', estimated_value: 300, occurred_at: '2025-11-01' }, // last year
      ],
      careRequests: [
        { created_at: '2026-02-01T00:00:00.000Z' }, // this year
        { created_at: '2024-01-01T00:00:00.000Z' }, // prior year
      ],
    });

    expect(metrics.gift_in_kind_value_distributed.this_year).toBe(500);
    expect(metrics.gift_in_kind_value_distributed.all_time).toBe(800);
    expect(metrics.care_requests_handled.this_year).toBe(1);
    expect(metrics.care_requests_handled.all_time).toBe(2);
  });

  it('never fabricates households/individuals served — returns null with a not_yet_computed source', () => {
    const metrics = computeMinistryImpactMetrics({
      fiscalYearStart,
      asOf,
      giftInKindDistributions: [],
      careRequests: [],
    });

    expect(metrics.households_served.this_year).toBeNull();
    expect(metrics.households_served.all_time).toBeNull();
    expect(metrics.households_served.source).toBe('not_yet_computed');
    expect(metrics.individuals_served.this_year).toBeNull();
    expect(metrics.individuals_served.source).toBe('not_yet_computed');
  });

  it('treats a null estimated_value as 0 rather than throwing', () => {
    const metrics = computeMinistryImpactMetrics({
      fiscalYearStart,
      asOf,
      giftInKindDistributions: [{ category: 'clothing', estimated_value: null, occurred_at: '2026-04-01' }],
      careRequests: [],
    });
    expect(metrics.gift_in_kind_value_distributed.this_year).toBe(0);
  });
});
