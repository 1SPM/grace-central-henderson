import { describe, it, expect } from 'vitest';
import { computeDecisionQueue, type DecisionQueueInputs } from './decisionQueue.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

function hoursAgo(hours: number): string {
  return new Date(NOW.getTime() - hours * 3_600_000).toISOString();
}

describe('computeDecisionQueue — severity ordering', () => {
  it('orders critical before high before normal, then oldest-first within a tier', () => {
    const inputs: DecisionQueueInputs = {
      approvals: [
        { id: 'a-low-risk', status: 'pending', risk_level: 'low', entity_type: 'gift', entity_id: 'g1', created_at: hoursAgo(1), related_party_flagged: false, related_party_reviewed_at: null },
        { id: 'a-critical-risk', status: 'pending', risk_level: 'critical', entity_type: 'gift', entity_id: 'g2', created_at: hoursAgo(100), related_party_flagged: false, related_party_reviewed_at: null },
      ],
      careRequests: [
        { id: 'c-crisis-old', status: 'submitted', priority: 'crisis', crisis_flagged: true, created_at: hoursAgo(48) },
        { id: 'c-crisis-new', status: 'submitted', priority: 'crisis', crisis_flagged: true, created_at: hoursAgo(1) },
      ],
    };

    const { items } = computeDecisionQueue(inputs, NOW);

    // All four items are severity 'critical' (crisis, or risk_level
    // 'critical') — they interleave by age regardless of kind, which is
    // the spec: severity first, then age_hours desc, no kind tiebreak.
    expect(items.map(i => i.id)).toEqual(['a-critical-risk', 'c-crisis-old', 'c-crisis-new', 'a-low-risk']);
    expect(items[3].severity).toBe('high'); // low risk_level -> high severity (still above normal)
  });

  it('computes age_hours correctly', () => {
    const inputs: DecisionQueueInputs = {
      failedTransfers: [{ id: 't-1', transfer_type: 'ach', direction: 'outbound', initiated_at: hoursAgo(10) }],
    };
    const { items } = computeDecisionQueue(inputs, NOW);
    expect(items[0].age_hours).toBeCloseTo(10, 1);
  });
});

describe('computeDecisionQueue — confidentiality', () => {
  it('never includes the care request summary text in a crisis item', () => {
    const inputs: DecisionQueueInputs = {
      careRequests: [{ id: 'c-1', status: 'submitted', priority: 'crisis', crisis_flagged: true, created_at: hoursAgo(1) }],
    };
    const { items } = computeDecisionQueue(inputs, NOW);
    const serialized = JSON.stringify(items[0]);
    expect(serialized).not.toContain('summary');
    expect(items[0].title).toBe('Crisis-flagged care request');
    expect(items[0].detail).toBe('Priority: crisis');
  });

  it('never includes the care request summary text in a care_triage item', () => {
    const inputs: DecisionQueueInputs = {
      careRequests: [{ id: 'c-2', status: 'submitted', priority: 'high', crisis_flagged: false, created_at: hoursAgo(1) }],
    };
    const { items } = computeDecisionQueue(inputs, NOW);
    expect(items[0].kind).toBe('care_triage');
    expect(items[0].title).toBe('Care request awaiting triage');
  });
});

describe('computeDecisionQueue — category filtering', () => {
  it('excludes non-pending approvals', () => {
    const inputs: DecisionQueueInputs = {
      approvals: [
        { id: 'a-1', status: 'decided', risk_level: 'high', entity_type: 'gift', entity_id: 'g1', created_at: hoursAgo(1), related_party_flagged: false, related_party_reviewed_at: null },
      ],
    };
    const { items } = computeDecisionQueue(inputs, NOW);
    expect(items).toHaveLength(0);
  });

  it('excludes resolved/closed care requests', () => {
    const inputs: DecisionQueueInputs = {
      careRequests: [
        { id: 'c-1', status: 'resolved', priority: 'high', crisis_flagged: false, created_at: hoursAgo(1) },
        { id: 'c-2', status: 'closed', priority: 'crisis', crisis_flagged: true, created_at: hoursAgo(1) },
      ],
    };
    const { items } = computeDecisionQueue(inputs, NOW);
    expect(items).toHaveLength(0);
  });

  it('excludes non-open KYC statuses', () => {
    const inputs: DecisionQueueInputs = {
      kycVerifications: [
        { id: 'k-1', status: 'approved', submitted_at: hoursAgo(1), person_id: 'p-1' },
        { id: 'k-2', status: 'pending', submitted_at: hoursAgo(1), person_id: 'p-2' },
      ],
    };
    const { items } = computeDecisionQueue(inputs, NOW);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('k-2');
  });

  it('emits both a related_party_review item and a base approval item for a flagged, unreviewed approval', () => {
    const inputs: DecisionQueueInputs = {
      approvals: [
        { id: 'a-1', status: 'pending', risk_level: 'medium', entity_type: 'expense', entity_id: 'e1', created_at: hoursAgo(1), related_party_flagged: true, related_party_reviewed_at: null },
      ],
    };
    const { items } = computeDecisionQueue(inputs, NOW);
    expect(items).toHaveLength(2);
    expect(items.map(i => i.kind).sort()).toEqual(['approval', 'related_party_review']);
  });

  it('does not emit a related_party_review item once reviewed', () => {
    const inputs: DecisionQueueInputs = {
      approvals: [
        { id: 'a-1', status: 'pending', risk_level: 'medium', entity_type: 'expense', entity_id: 'e1', created_at: hoursAgo(1), related_party_flagged: true, related_party_reviewed_at: hoursAgo(0.5) },
      ],
    };
    const { items } = computeDecisionQueue(inputs, NOW);
    expect(items).toHaveLength(1);
    expect(items[0].kind).toBe('approval');
  });
});

describe('computeDecisionQueue — counts', () => {
  it('produces accurate total/critical/by_kind counts', () => {
    const inputs: DecisionQueueInputs = {
      careRequests: [
        { id: 'c-1', status: 'submitted', priority: 'crisis', crisis_flagged: true, created_at: hoursAgo(1) },
        { id: 'c-2', status: 'submitted', priority: 'low', crisis_flagged: false, created_at: hoursAgo(1) },
      ],
      failedTransfers: [{ id: 't-1', transfer_type: 'ach', direction: 'outbound', initiated_at: hoursAgo(1) }],
    };
    const { counts } = computeDecisionQueue(inputs, NOW);
    expect(counts.total).toBe(3);
    expect(counts.critical).toBe(1);
    expect(counts.by_kind.crisis).toBe(1);
    expect(counts.by_kind.care_triage).toBe(1);
    expect(counts.by_kind.failed_transfer).toBe(1);
  });

  it('returns zero counts for empty inputs', () => {
    const { items, counts } = computeDecisionQueue({}, NOW);
    expect(items).toHaveLength(0);
    expect(counts).toEqual({ total: 0, critical: 0, by_kind: {} });
  });
});
