import { describe, it, expect } from 'vitest';
import { AGENT_WORK_STATUS_LABEL, AGENT_WORK_STATUS_VARIANT, AGENT_WORK_BOUNDARY_STATEMENT, type AgentWorkStatus } from './agentWorkStatus';

const ALL_STATUSES: AgentWorkStatus[] = [
  'not_implemented', 'not_yet_run', 'queued', 'running', 'succeeded', 'failed', 'cancelled',
];

describe('agentWorkStatus — shared vocabulary', () => {
  it('has a label for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(AGENT_WORK_STATUS_LABEL[status]).toBeTruthy();
    }
  });

  it('has a badge variant for every status', () => {
    for (const status of ALL_STATUSES) {
      expect(AGENT_WORK_STATUS_VARIANT[status]).toBeTruthy();
    }
  });

  it('reserves the urgent variant for a real failure only', () => {
    expect(AGENT_WORK_STATUS_VARIANT.failed).toBe('urgent');
    for (const status of ALL_STATUSES) {
      if (status !== 'failed') expect(AGENT_WORK_STATUS_VARIANT[status]).not.toBe('urgent');
    }
  });

  it('states the boundary as a non-empty sentence naming the approval requirement', () => {
    expect(AGENT_WORK_BOUNDARY_STATEMENT.length).toBeGreaterThan(20);
    expect(AGENT_WORK_BOUNDARY_STATEMENT.toLowerCase()).toContain('approval');
  });
});
