/**
 * Unit tests for the Impact Card adoption-funnel metrics calculation
 * (display-accuracy tests — every metric traceable to its stated source)
 * and the finance-role field-permission split (finance-role tests).
 */
import { describe, it, expect } from 'vitest';
import {
  computeImpactCardFunnelMetrics,
  applyFieldPermissions,
  FUNNEL_ACCESS_FIELDS,
  FINANCIAL_ACCESS_FIELDS,
  type FunnelMetricsInput,
} from './impactCardFunnelMetrics.js';

const PERIOD_START = '2026-06-01T00:00:00.000Z';
const PERIOD_END = '2026-07-01T00:00:00.000Z';
const AS_OF = '2026-07-14T12:00:00.000Z';

function baseInput(overrides: Partial<FunnelMetricsInput> = {}): FunnelMetricsInput {
  return {
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    asOf: AS_OF,
    kyc: [],
    cards: [],
    interchangeEvents: [],
    impactAllocations: [],
    supportWorkOrders: [],
    reconciliationWorkOrders: [],
    campaignWorkOrders: [],
    latestReconcileCronRun: null,
    ...overrides,
  };
}

describe('computeImpactCardFunnelMetrics', () => {
  it('counts applications and completions from kyc_verifications within the period', () => {
    const result = computeImpactCardFunnelMetrics(baseInput({
      kyc: [
        { status: 'approved', submitted_at: '2026-06-05T00:00:00.000Z' },
        { status: 'rejected', submitted_at: '2026-06-10T00:00:00.000Z' },
        { status: 'pending', submitted_at: '2026-06-15T00:00:00.000Z' },
        { status: 'approved', submitted_at: '2026-05-30T00:00:00.000Z' }, // outside period
      ],
    }));
    expect(result.application_count.value).toBe(3);
    expect(result.completion_count.value).toBe(1);
  });

  it('computes onboarding drop-off rate, and returns null when there are no applications', () => {
    const withApps = computeImpactCardFunnelMetrics(baseInput({
      kyc: [
        { status: 'approved', submitted_at: '2026-06-05T00:00:00.000Z' },
        { status: 'pending', submitted_at: '2026-06-10T00:00:00.000Z' },
      ],
    }));
    expect(withApps.onboarding_drop_off_rate.value).toBeCloseTo(0.5);

    const noApps = computeImpactCardFunnelMetrics(baseInput());
    expect(noApps.onboarding_drop_off_rate.value).toBeNull();
  });

  it('counts activations by activated_at within the period, not issued_at', () => {
    const result = computeImpactCardFunnelMetrics(baseInput({
      cards: [
        { status: 'active', activated_at: '2026-06-10T00:00:00.000Z', issued_at: '2026-05-01T00:00:00.000Z' },
        { status: 'active', activated_at: null, issued_at: '2026-06-12T00:00:00.000Z' },
        { status: 'active', activated_at: '2026-05-20T00:00:00.000Z', issued_at: '2026-05-01T00:00:00.000Z' },
      ],
    }));
    expect(result.activation_count.value).toBe(1);
  });

  it('counts active participation as distinct cards with a settled capture in the period', () => {
    const result = computeImpactCardFunnelMetrics(baseInput({
      interchangeEvents: [
        { card_id: 'card-1', event_type: 'capture', direction: 'debit', occurred_at: '2026-06-05T00:00:00.000Z' },
        { card_id: 'card-1', event_type: 'capture', direction: 'debit', occurred_at: '2026-06-06T00:00:00.000Z' },
        { card_id: 'card-2', event_type: 'declined', direction: 'debit', occurred_at: '2026-06-06T00:00:00.000Z' },
        { card_id: 'card-3', event_type: 'capture', direction: 'debit', occurred_at: '2026-05-01T00:00:00.000Z' },
      ],
    }));
    expect(result.active_participation.value).toBe(1);
  });

  it('sums approved aggregate value from impact_allocations in USD', () => {
    const result = computeImpactCardFunnelMetrics(baseInput({
      impactAllocations: [
        { amount_micro_usd: 5_000_000, period_month: '2026-06-01' },
        { amount_micro_usd: 2_500_000, period_month: '2026-06-01' },
        { amount_micro_usd: 1_000_000, period_month: '2026-05-01' }, // outside period
      ],
    }));
    expect(result.approved_aggregate_value_usd.value).toBeCloseTo(7.5);
  });

  it('marks program_benefit as not-yet-computed rather than fabricating a value', () => {
    const result = computeImpactCardFunnelMetrics(baseInput());
    expect(result.program_benefit.value).toBeNull();
    expect(result.program_benefit.source).toBe('not_yet_computed');
    expect(result.program_benefit.reconciliation_status).toBe('not_yet_computed');
  });

  it('counts support cases opened in the period', () => {
    const result = computeImpactCardFunnelMetrics(baseInput({
      supportWorkOrders: [
        { status: 'in_progress', created_at: '2026-06-05T00:00:00.000Z' },
        { status: 'completed', created_at: '2026-06-10T00:00:00.000Z' },
        { status: 'in_progress', created_at: '2026-05-01T00:00:00.000Z' }, // outside period
      ],
    }));
    expect(result.support_cases.value).toBe(2);
  });

  it('flags reconciliation exceptions_open when any reconciliation Work Order is still open', () => {
    const open = computeImpactCardFunnelMetrics(baseInput({
      reconciliationWorkOrders: [{ status: 'in_progress', created_at: '2026-06-05T00:00:00.000Z' }],
    }));
    expect(open.reconciliation_status.value).toBe(1);
    expect(open.reconciliation_status.reconciliation_status).toBe('exceptions_open');

    const clean = computeImpactCardFunnelMetrics(baseInput({
      reconciliationWorkOrders: [{ status: 'completed', created_at: '2026-06-05T00:00:00.000Z' }],
      latestReconcileCronRun: { ok: true, created_at: '2026-07-14T06:00:00.000Z', summary: { anomalies_detected: 0 } },
    }));
    expect(clean.reconciliation_status.value).toBe(0);
    expect(clean.reconciliation_status.reconciliation_status).toBe('reconciled');
  });

  it('computes campaign performance as the completion rate of onboarding-campaign Work Orders in the period', () => {
    const result = computeImpactCardFunnelMetrics(baseInput({
      campaignWorkOrders: [
        { status: 'completed', created_at: '2026-06-05T00:00:00.000Z' },
        { status: 'in_progress', created_at: '2026-06-10T00:00:00.000Z' },
      ],
    }));
    expect(result.campaign_performance.value).toBeCloseTo(0.5);

    const none = computeImpactCardFunnelMetrics(baseInput());
    expect(none.campaign_performance.value).toBeNull();
  });

  it('every metric includes all seven required fields', () => {
    const result = computeImpactCardFunnelMetrics(baseInput());
    for (const metric of Object.values(result)) {
      expect(metric).toHaveProperty('value');
      expect(metric).toHaveProperty('source');
      expect(metric).toHaveProperty('definition');
      expect(metric).toHaveProperty('reporting_period');
      expect(metric).toHaveProperty('calculation');
      expect(metric).toHaveProperty('assumptions');
      expect(metric).toHaveProperty('data_freshness');
      expect(metric).toHaveProperty('reconciliation_status');
    }
  });
});

describe('applyFieldPermissions (finance-role access split)', () => {
  const metrics = computeImpactCardFunnelMetrics(baseInput({
    kyc: [{ status: 'approved', submitted_at: '2026-06-05T00:00:00.000Z' }],
  }));

  it('a finance-only caller sees financial fields but not funnel fields', () => {
    const result = applyFieldPermissions(metrics, { hasFunnelAccess: false, hasFinancialAccess: true });
    for (const field of FINANCIAL_ACCESS_FIELDS) {
      expect(result[field]).toEqual(metrics[field]);
    }
    for (const field of FUNNEL_ACCESS_FIELDS) {
      expect(result[field]).toEqual({ permission_required: true });
    }
  });

  it('an impact-card-operations-only caller sees funnel fields but not financial fields', () => {
    const result = applyFieldPermissions(metrics, { hasFunnelAccess: true, hasFinancialAccess: false });
    for (const field of FUNNEL_ACCESS_FIELDS) {
      expect(result[field]).toEqual(metrics[field]);
    }
    for (const field of FINANCIAL_ACCESS_FIELDS) {
      expect(result[field]).toEqual({ permission_required: true });
    }
  });

  it('a caller with both permissions sees every field unmasked', () => {
    const result = applyFieldPermissions(metrics, { hasFunnelAccess: true, hasFinancialAccess: true });
    for (const field of [...FUNNEL_ACCESS_FIELDS, ...FINANCIAL_ACCESS_FIELDS]) {
      expect(result[field]).toEqual(metrics[field]);
    }
  });

  it('a caller with neither permission sees every field masked', () => {
    const result = applyFieldPermissions(metrics, { hasFunnelAccess: false, hasFinancialAccess: false });
    for (const field of [...FUNNEL_ACCESS_FIELDS, ...FINANCIAL_ACCESS_FIELDS]) {
      expect(result[field]).toEqual({ permission_required: true });
    }
  });

  it('covers every metric field exactly once between the two access groups', () => {
    const all = [...FUNNEL_ACCESS_FIELDS, ...FINANCIAL_ACCESS_FIELDS].sort();
    const metricKeys = Object.keys(metrics).sort();
    expect(all).toEqual(metricKeys);
  });
});
