import { describe, it, expect } from 'vitest';
import {
  dedupKeyForWorkflowFinding,
  titleForWorkflowFinding,
  detailForWorkflowFinding,
  severityForWorkflowFinding,
} from './agentWorkflowFindings.js';
import type { AgentFinding } from './agentWorkflows.js';

describe('dedupKeyForWorkflowFinding', () => {
  it('combines agent key, action type, and target entity id', () => {
    const finding: AgentFinding = { action_type: 'flag_overdue_task', target_entity_type: 'task', target_entity_id: 'task-1', payload: {} };
    expect(dedupKeyForWorkflowFinding('grace', finding)).toBe('grace:flag_overdue_task:task-1');
  });

  it('falls back to "none" when target_entity_id is null', () => {
    const finding: AgentFinding = { action_type: 'flag_reconciliation_anomaly', target_entity_type: 'ledger_reconciliation', target_entity_id: null, payload: {} };
    expect(dedupKeyForWorkflowFinding('steward', finding)).toBe('steward:flag_reconciliation_anomaly:none');
  });
});

describe('titleForWorkflowFinding', () => {
  it('uses the known human-readable title for a mapped action_type', () => {
    const finding: AgentFinding = { action_type: 'flag_unassigned_care_request', target_entity_type: 'care_request', target_entity_id: 'cr-1', payload: {} };
    expect(titleForWorkflowFinding(finding)).toBe('Care request awaiting assignment or response');
  });

  it('humanizes an unmapped action_type as a fallback', () => {
    const finding: AgentFinding = { action_type: 'flag_something_new', target_entity_type: 'x', target_entity_id: null, payload: {} };
    expect(titleForWorkflowFinding(finding)).toBe('something new');
  });
});

describe('detailForWorkflowFinding', () => {
  it('never returns detail for a care_request finding, even if payload has fields', () => {
    const finding: AgentFinding = {
      action_type: 'flag_unassigned_care_request',
      target_entity_type: 'care_request',
      target_entity_id: 'cr-1',
      payload: { category: 'crisis', priority: 'crisis', title: 'should never leak' },
    };
    expect(detailForWorkflowFinding(finding)).toBeNull();
  });

  it('uses payload.title for a task/work_order finding', () => {
    const finding: AgentFinding = { action_type: 'flag_overdue_task', target_entity_type: 'task', target_entity_id: 't-1', payload: { title: 'Follow up with Jordan' } };
    expect(detailForWorkflowFinding(finding)).toBe('Follow up with Jordan');
  });

  it('uses payload.name for a person finding', () => {
    const finding: AgentFinding = { action_type: 'flag_missing_contact_info', target_entity_type: 'person', target_entity_id: 'p-1', payload: { name: 'Sofia Alvarez' } };
    expect(detailForWorkflowFinding(finding)).toBe('Sofia Alvarez');
  });

  it('returns null when nothing in the payload maps to a safe detail', () => {
    const finding: AgentFinding = { action_type: 'flag_blocked_work_order', target_entity_type: 'work_order', target_entity_id: 'wo-1', payload: {} };
    expect(detailForWorkflowFinding(finding)).toBeNull();
  });
});

describe('severityForWorkflowFinding', () => {
  it('is critical for a crisis-flagged care_request finding', () => {
    const finding: AgentFinding = { action_type: 'flag_unassigned_care_request', target_entity_type: 'care_request', target_entity_id: 'cr-1', payload: { crisis_flagged: true } };
    expect(severityForWorkflowFinding(finding)).toBe('critical');
  });

  it('is normal for a non-crisis care_request finding', () => {
    const finding: AgentFinding = { action_type: 'flag_unassigned_care_request', target_entity_type: 'care_request', target_entity_id: 'cr-1', payload: { crisis_flagged: false } };
    expect(severityForWorkflowFinding(finding)).toBe('normal');
  });

  it('is normal for any non-care_request finding', () => {
    const finding: AgentFinding = { action_type: 'flag_overdue_task', target_entity_type: 'task', target_entity_id: 't-1', payload: {} };
    expect(severityForWorkflowFinding(finding)).toBe('normal');
  });
});
