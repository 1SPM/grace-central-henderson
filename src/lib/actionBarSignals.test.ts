import { describe, it, expect } from 'vitest';
import { buildActionBarSignals } from './actionBarSignals';
import type { DecisionQueueItem } from '../hooks/useDecisionQueue';

function item(overrides: Partial<DecisionQueueItem> & Pick<DecisionQueueItem, 'id' | 'kind' | 'severity'>): DecisionQueueItem {
  return {
    title: 'Item',
    created_at: '2026-08-29T00:00:00.000Z',
    age_hours: 1,
    href: `#/${overrides.kind}`,
    required_permission: 'approvals.view',
    subject_type: 'x',
    subject_id: '1',
    ...overrides,
  };
}

describe('buildActionBarSignals', () => {
  it('returns an empty array for no items', () => {
    expect(buildActionBarSignals([])).toEqual([]);
  });

  it('groups items by kind and counts them', () => {
    const items = [
      item({ id: 'a1', kind: 'approval', severity: 'normal' }),
      item({ id: 'a2', kind: 'approval', severity: 'normal' }),
      item({ id: 'c1', kind: 'crisis', severity: 'critical' }),
    ];
    const signals = buildActionBarSignals(items);
    const approvals = signals.find(s => s.kind === 'approval');
    expect(approvals?.count).toBe(2);
    expect(signals.find(s => s.kind === 'crisis')?.count).toBe(1);
  });

  it('maps severity to attention state: critical -> urgent, high -> needs_review, normal -> informational', () => {
    const items = [
      item({ id: '1', kind: 'crisis', severity: 'critical' }),
      item({ id: '2', kind: 'care_triage', severity: 'high' }),
      item({ id: '3', kind: 'invitation_stalled', severity: 'normal' }),
    ];
    const signals = buildActionBarSignals(items);
    expect(signals.find(s => s.kind === 'crisis')?.attention).toBe('urgent');
    expect(signals.find(s => s.kind === 'crisis')?.badgeVariant).toBe('urgent');
    expect(signals.find(s => s.kind === 'care_triage')?.attention).toBe('needs_review');
    expect(signals.find(s => s.kind === 'care_triage')?.badgeVariant).toBe('normal');
    expect(signals.find(s => s.kind === 'invitation_stalled')?.attention).toBe('informational');
    expect(signals.find(s => s.kind === 'invitation_stalled')?.badgeVariant).toBe('low');
  });

  it('overrides failed_transfer to blocked regardless of severity', () => {
    const items = [item({ id: 't1', kind: 'failed_transfer', severity: 'normal' })];
    const signals = buildActionBarSignals(items);
    expect(signals[0].attention).toBe('blocked');
    expect(signals[0].badgeVariant).toBe('warning');
  });

  it('takes the most severe attention state within a kind and its matching href', () => {
    const items = [
      item({ id: '1', kind: 'approval', severity: 'normal', href: '#/normal-one' }),
      item({ id: '2', kind: 'approval', severity: 'critical', href: '#/critical-one' }),
    ];
    const signals = buildActionBarSignals(items);
    expect(signals[0].attention).toBe('urgent');
    expect(signals[0].href).toBe('#/critical-one');
    expect(signals[0].count).toBe(2);
  });

  it('sorts urgent before blocked before needs_review before informational', () => {
    const items = [
      item({ id: '1', kind: 'invitation_stalled', severity: 'normal' }),
      item({ id: '2', kind: 'care_triage', severity: 'high' }),
      item({ id: '3', kind: 'failed_transfer', severity: 'normal' }),
      item({ id: '4', kind: 'crisis', severity: 'critical' }),
    ];
    const signals = buildActionBarSignals(items);
    expect(signals.map(s => s.attention)).toEqual(['urgent', 'blocked', 'needs_review', 'informational']);
  });
});
