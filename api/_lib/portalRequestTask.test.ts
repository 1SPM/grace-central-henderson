/**
 * Unit tests for the member-facing status mapping (portal events ->
 * staff tasks -> member-visible status). Confirms the internal
 * work_order_tasks.status value and owner identity never leak — only
 * the five approved labels are ever returned.
 */
import { describe, it, expect } from 'vitest';
import { toMemberFacingStatus, type MemberFacingStatus } from './portalRequestTask.js';

const APPROVED_LABELS: MemberFacingStatus[] = ['Received', 'Assigned', 'In Progress', 'Waiting for Information', 'Completed'];

describe('toMemberFacingStatus', () => {
  it('maps pending + no owner to Received', () => {
    expect(toMemberFacingStatus('pending', false)).toBe('Received');
  });

  it('maps pending + an owner to Assigned', () => {
    expect(toMemberFacingStatus('pending', true)).toBe('Assigned');
  });

  it('maps in_progress to In Progress', () => {
    expect(toMemberFacingStatus('in_progress', true)).toBe('In Progress');
  });

  it('maps blocked to Waiting for Information (never the internal word "blocked")', () => {
    const label = toMemberFacingStatus('blocked', true);
    expect(label).toBe('Waiting for Information');
    expect(label).not.toMatch(/blocked/i);
  });

  it('maps completed and cancelled both to Completed', () => {
    expect(toMemberFacingStatus('completed', true)).toBe('Completed');
    expect(toMemberFacingStatus('cancelled', true)).toBe('Completed');
  });

  it('never returns a label outside the approved set, for any internal status', () => {
    const internalStatuses = ['pending', 'in_progress', 'blocked', 'under_review', 'completed', 'cancelled', 'some_future_status'];
    for (const status of internalStatuses) {
      for (const hasOwner of [true, false]) {
        expect(APPROVED_LABELS).toContain(toMemberFacingStatus(status, hasOwner));
      }
    }
  });
});
