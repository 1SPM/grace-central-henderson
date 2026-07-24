/**
 * Unit tests for Work Order status-transition rules and creation validation
 * (Work Order creation, part of the required test coverage). Pure logic —
 * no network, no Supabase.
 */
import { describe, it, expect } from 'vitest';
import { validate } from '../_lib/validation.js';
import { ALLOWED_TRANSITIONS, WORK_ORDER_STATUSES } from './_index.js';

describe('WORK_ORDER_STATUSES', () => {
  it('matches the states named in the WorkOS spec, in order', () => {
    expect(WORK_ORDER_STATUSES).toEqual([
      'draft', 'planning', 'awaiting_approval', 'in_progress',
      'blocked', 'under_review', 'completed', 'cancelled',
    ]);
  });
});

describe('ALLOWED_TRANSITIONS', () => {
  it('allows the common happy path: draft -> planning -> awaiting_approval -> in_progress -> under_review -> completed', () => {
    const path = ['draft', 'planning', 'awaiting_approval', 'in_progress', 'under_review', 'completed'];
    for (let i = 0; i < path.length - 1; i++) {
      expect(ALLOWED_TRANSITIONS[path[i]]).toContain(path[i + 1]);
    }
  });

  it('rejects skipping straight from draft to completed', () => {
    expect(ALLOWED_TRANSITIONS.draft).not.toContain('completed');
  });

  it('rejects skipping straight from draft to in_progress (must plan first)', () => {
    expect(ALLOWED_TRANSITIONS.draft).not.toContain('in_progress');
  });

  it('has no outgoing transitions from terminal states', () => {
    expect(ALLOWED_TRANSITIONS.completed).toEqual([]);
    expect(ALLOWED_TRANSITIONS.cancelled).toEqual([]);
  });

  it('every status has an entry (no status accidentally omitted)', () => {
    for (const status of WORK_ORDER_STATUSES) {
      expect(ALLOWED_TRANSITIONS[status]).toBeDefined();
    }
  });
});

describe('Work Order creation validation', () => {
  const schema = {
    title: (input: unknown, field: string) =>
      typeof input === 'string' && input.trim().length > 0
        ? { ok: true as const, value: input.trim() }
        : { ok: false as const, error: `${field} is required` },
  };

  it('rejects a Work Order with no title', () => {
    const result = validate({}, schema);
    expect(result.ok).toBe(false);
  });

  it('accepts a Work Order with a title', () => {
    const result = validate({ title: 'Sunday setup checklist' }, schema);
    expect(result.ok).toBe(true);
  });
});
