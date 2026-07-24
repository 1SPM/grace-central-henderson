/**
 * Unit tests for the Work Order approval-policy overlay: which Work Orders
 * require approval before execution, and how that narrows the base
 * ALLOWED_TRANSITIONS table. Covers: finance/communications-policy tests.
 */
import { describe, it, expect } from 'vitest';
import { requiresApprovalBeforeExecution, applyApprovalPolicy } from './workOrderPolicy.js';

describe('requiresApprovalBeforeExecution', () => {
  it('flags Work Orders with an explicit metadata approval flag', () => {
    expect(requiresApprovalBeforeExecution({ ministry: null, metadata: { requires_approval: true } })).toBe(true);
  });

  it('flags Work Orders whose ministry mentions communications', () => {
    expect(requiresApprovalBeforeExecution({ ministry: 'Impact Card Communications', metadata: null })).toBe(true);
    expect(requiresApprovalBeforeExecution({ ministry: 'communications', metadata: null })).toBe(true);
  });

  it('does not flag ordinary Work Orders', () => {
    expect(requiresApprovalBeforeExecution({ ministry: 'Youth', metadata: null })).toBe(false);
    expect(requiresApprovalBeforeExecution({ ministry: null, metadata: null })).toBe(false);
    expect(requiresApprovalBeforeExecution({ ministry: null, metadata: { requires_approval: false } })).toBe(false);
  });
});

describe('applyApprovalPolicy', () => {
  const baseAllowed = ['awaiting_approval', 'in_progress', 'cancelled'];

  it('strips the direct planning -> in_progress edge for policy-gated Work Orders', () => {
    const result = applyApprovalPolicy(baseAllowed, { ministry: 'Communications', metadata: null }, 'planning');
    expect(result).toEqual(['awaiting_approval', 'cancelled']);
  });

  it('leaves transitions untouched for non-gated Work Orders', () => {
    const result = applyApprovalPolicy(baseAllowed, { ministry: 'Youth', metadata: null }, 'planning');
    expect(result).toEqual(baseAllowed);
  });

  it('only applies the restriction when currentStatus is planning', () => {
    const result = applyApprovalPolicy(baseAllowed, { ministry: 'Communications', metadata: null }, 'awaiting_approval');
    expect(result).toEqual(baseAllowed);
  });

  it('still allows awaiting_approval and cancelled for gated Work Orders', () => {
    const result = applyApprovalPolicy(baseAllowed, { ministry: null, metadata: { requires_approval: true } }, 'planning');
    expect(result).toContain('awaiting_approval');
    expect(result).toContain('cancelled');
    expect(result).not.toContain('in_progress');
  });
});
