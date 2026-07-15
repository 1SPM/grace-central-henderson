/**
 * Unit tests for the Executive Overview metric catalog — confirms every
 * metric the spec requires is present and carries the required metadata
 * (definition, period, source) before any value is ever attached to it.
 */
import { describe, it, expect } from 'vitest';
import { METRIC_CATALOG } from './workosMetrics.js';

const REQUIRED_KEYS = [
  'active_members',
  'households',
  'attendance_last_7_days',
  'newcomers_last_30_days',
  'volunteers_placed',
  'open_care_requests',
  'unresolved_follow_ups',
  'active_work_orders',
  'overdue_tasks',
  'pending_approvals',
  'recent_agent_runs',
  'data_quality_unreachable_members',
];

describe('METRIC_CATALOG', () => {
  it('includes every metric the Executive Overview spec requires', () => {
    const keys = METRIC_CATALOG.map(m => m.key);
    for (const required of REQUIRED_KEYS) {
      expect(keys).toContain(required);
    }
  });

  it('every metric has a non-empty definition, period, and source', () => {
    for (const metric of METRIC_CATALOG) {
      expect(metric.definition.length).toBeGreaterThan(0);
      expect(metric.period.length).toBeGreaterThan(0);
      expect(metric.source.length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate keys', () => {
    const keys = METRIC_CATALOG.map(m => m.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
