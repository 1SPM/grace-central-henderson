import { describe, it, expect } from 'vitest';
import type { Task } from '../types';
import type { Approval } from '../types/shared-platform';
import type { MyWorkOrder } from '../hooks/useMyWork';
import { buildWorkQueue, bucketForDueDate } from './workQueue';

const NOW = new Date('2026-08-31T12:00:00'); // Monday

function task(overrides: Partial<Task>): Task {
  return {
    id: 't1',
    title: 'A task',
    dueDate: '2026-09-01',
    completed: false,
    priority: 'medium',
    category: 'admin',
    createdAt: '2026-08-29T10:00:00',
    ...overrides,
  };
}

function workOrder(overrides: Partial<MyWorkOrder>): MyWorkOrder {
  return {
    id: 'wo1',
    title: 'A work order',
    status: 'in_progress',
    priority: 'medium',
    ministry: 'youth',
    due_date: '2026-09-03',
    agent_activity: null,
    ...overrides,
  };
}

function approval(overrides: Partial<Approval>): Approval {
  return {
    id: 'ap1',
    church_id: 'c1',
    work_order_id: null,
    entity_type: 'budget_request',
    entity_id: null,
    proposed_action: 'Approve budget request',
    requested_by_user_id: null,
    requested_by_agent: null,
    affected_resources: [],
    risk_level: 'medium',
    supporting_evidence: [],
    approver_user_id: null,
    decision: null,
    decision_notes: null,
    status: 'pending',
    requested_at: '2026-08-30T10:00:00',
    decided_at: null,
    related_party_flagged: false,
    related_party_reviewed_by_user_id: null,
    related_party_reviewed_at: null,
    ...overrides,
  } as Approval;
}

describe('bucketForDueDate', () => {
  it('buckets around today correctly', () => {
    expect(bucketForDueDate('2026-08-30', NOW)).toBe('overdue');
    expect(bucketForDueDate('2026-08-31', NOW)).toBe('today');
    expect(bucketForDueDate('2026-09-01', NOW)).toBe('tomorrow');
    expect(bucketForDueDate('2026-09-05', NOW)).toBe('thisWeek');
    expect(bucketForDueDate('2026-09-10', NOW)).toBe('later');
    expect(bucketForDueDate(null, NOW)).toBe('noDate');
    expect(bucketForDueDate('not-a-date', NOW)).toBe('noDate');
  });
});

describe('buildWorkQueue', () => {
  it('merges all three sources into one queue', () => {
    const items = buildWorkQueue(
      { tasks: [task({})], workOrders: [workOrder({})], approvals: [approval({})] },
      NOW,
    );
    expect(items.map((i) => i.source).sort()).toEqual(['approval', 'task', 'work_order']);
  });

  it('sorts by attention rank: urgent before needs_review before informational', () => {
    const items = buildWorkQueue(
      {
        tasks: [
          task({ id: 'low', priority: 'low', dueDate: '2026-09-10' }),
          task({ id: 'high', priority: 'high', dueDate: '2026-09-10' }),
          task({ id: 'med', priority: 'medium', dueDate: '2026-09-10' }),
        ],
        workOrders: [],
        approvals: [],
      },
      NOW,
    );
    expect(items.map((i) => i.id)).toEqual(['task:high', 'task:med', 'task:low']);
  });

  it('replaces the old non-transitive comparator: overdue always outranks a later high-priority', () => {
    const items = buildWorkQueue(
      {
        tasks: [
          task({ id: 'later-high', priority: 'high', dueDate: '2026-09-20' }),
          task({ id: 'overdue-med', priority: 'medium', dueDate: '2026-08-28' }),
        ],
        workOrders: [],
        approvals: [],
      },
      NOW,
    );
    // Both classify urgent; the overdue bucket sorts first.
    expect(items[0].id).toBe('task:overdue-med');
    expect(items[0].section).toBe('high');
  });

  it('puts pending approvals in the high-priority section as needs_review', () => {
    const items = buildWorkQueue({ tasks: [], workOrders: [], approvals: [approval({})] }, NOW);
    expect(items[0].attention).toBe('needs_review');
    expect(items[0].section).toBe('high');
    expect(items[0].title).toBe('Approve budget request');
    expect(items[0].context).toBe('Budget Request');
  });

  it('escalates high-risk approvals to urgent', () => {
    const items = buildWorkQueue(
      { tasks: [], workOrders: [], approvals: [approval({ risk_level: 'high' })] },
      NOW,
    );
    expect(items[0].attention).toBe('urgent');
  });

  it('skips completed tasks, decided approvals, and finished work orders', () => {
    const items = buildWorkQueue(
      {
        tasks: [task({ completed: true })],
        workOrders: [workOrder({ status: 'completed' }), workOrder({ id: 'wo2', status: 'cancelled' })],
        approvals: [approval({ status: 'decided' })],
      },
      NOW,
    );
    expect(items).toHaveLength(0);
  });

  it('marks blocked work orders as blocked (high section)', () => {
    const items = buildWorkQueue(
      { tasks: [], workOrders: [workOrder({ status: 'blocked' })], approvals: [] },
      NOW,
    );
    expect(items[0].attention).toBe('blocked');
    expect(items[0].section).toBe('high');
  });

  it('sections week vs later by due-date bucket', () => {
    const items = buildWorkQueue(
      {
        tasks: [
          task({ id: 'wk', priority: 'low', dueDate: '2026-09-02' }),
          task({ id: 'lt', priority: 'low', dueDate: '2026-09-20' }),
          task({ id: 'nd', priority: 'low', dueDate: '' }),
        ],
        workOrders: [],
        approvals: [],
      },
      NOW,
    );
    const byId = Object.fromEntries(items.map((i) => [i.id, i.section]));
    expect(byId['task:wk']).toBe('week');
    expect(byId['task:lt']).toBe('later');
    expect(byId['task:nd']).toBe('later');
  });
});
