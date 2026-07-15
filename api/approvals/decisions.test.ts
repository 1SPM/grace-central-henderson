/**
 * Unit tests for approval-decision validation (approval enforcement).
 */
import { describe, it, expect } from 'vitest';
import { validate, str } from '../_lib/validation.js';

const DECISIONS = ['approve', 'approve_with_changes', 'return_for_revision', 'reject', 'escalate'] as const;
const DECIDE_SCHEMA = {
  decision: str({ required: true, pattern: new RegExp(`^(${DECISIONS.join('|')})$`) }),
};

describe('approval decision validation', () => {
  it.each(DECISIONS)('accepts the supported decision "%s"', (decision) => {
    const result = validate({ decision }, DECIDE_SCHEMA);
    expect(result.ok).toBe(true);
  });

  it('rejects a decision outside the supported set (e.g. "maybe")', () => {
    const result = validate({ decision: 'maybe' }, DECIDE_SCHEMA);
    expect(result.ok).toBe(false);
  });

  it('rejects a missing decision', () => {
    const result = validate({}, DECIDE_SCHEMA);
    expect(result.ok).toBe(false);
  });
});

describe('approval -> Work Order status resolution', () => {
  // Mirrors the logic in api/approvals/_index.ts: favorable decisions
  // resume work; anything else returns the Work Order to planning.
  function nextWorkOrderStatus(decision: (typeof DECISIONS)[number]): 'in_progress' | 'planning' {
    return ['approve', 'approve_with_changes'].includes(decision) ? 'in_progress' : 'planning';
  }

  it('approve and approve_with_changes resume work (in_progress)', () => {
    expect(nextWorkOrderStatus('approve')).toBe('in_progress');
    expect(nextWorkOrderStatus('approve_with_changes')).toBe('in_progress');
  });

  it('return_for_revision, reject, and escalate all return to planning', () => {
    expect(nextWorkOrderStatus('return_for_revision')).toBe('planning');
    expect(nextWorkOrderStatus('reject')).toBe('planning');
    expect(nextWorkOrderStatus('escalate')).toBe('planning');
  });
});
