import { describe, it, expect } from 'vitest';
import { computeAgentPrecision, type AgentFindingPrecisionRow } from './agentPrecision.js';

describe('computeAgentPrecision', () => {
  it('returns an empty object for no rows', () => {
    expect(computeAgentPrecision([])).toEqual({});
  });

  it('returns median_hours_to_resolve: null and dismissal_rate: 0 when nothing has resolved or dismissed', () => {
    const rows: AgentFindingPrecisionRow[] = [
      { agent_id: 'member-care', status: 'open', created_at: '2026-07-01T00:00:00Z', resolved_at: null },
      { agent_id: 'member-care', status: 'triaged', created_at: '2026-07-02T00:00:00Z', resolved_at: null },
    ];
    const out = computeAgentPrecision(rows);
    expect(out['member-care']).toEqual({
      generated: 2,
      dismissed: 0,
      actioned: 0,
      resolved: 0,
      dismissal_rate: 0,
      median_hours_to_resolve: null,
    });
  });

  it('computes dismissal_rate and separates counts per status', () => {
    const rows: AgentFindingPrecisionRow[] = [
      { agent_id: 'stewardship', status: 'dismissed', created_at: '2026-07-01T00:00:00Z', resolved_at: null },
      { agent_id: 'stewardship', status: 'dismissed', created_at: '2026-07-01T00:00:00Z', resolved_at: null },
      { agent_id: 'stewardship', status: 'actioned', created_at: '2026-07-01T00:00:00Z', resolved_at: null },
      { agent_id: 'stewardship', status: 'open', created_at: '2026-07-01T00:00:00Z', resolved_at: null },
    ];
    const out = computeAgentPrecision(rows);
    expect(out['stewardship'].generated).toBe(4);
    expect(out['stewardship'].dismissed).toBe(2);
    expect(out['stewardship'].actioned).toBe(1);
    expect(out['stewardship'].dismissal_rate).toBe(0.5);
  });

  it('computes the median hours-to-resolve across an odd number of resolved findings', () => {
    const rows: AgentFindingPrecisionRow[] = [
      { agent_id: 'operations', status: 'resolved', created_at: '2026-07-01T00:00:00Z', resolved_at: '2026-07-01T02:00:00Z' }, // 2h
      { agent_id: 'operations', status: 'resolved', created_at: '2026-07-01T00:00:00Z', resolved_at: '2026-07-01T04:00:00Z' }, // 4h
      { agent_id: 'operations', status: 'resolved', created_at: '2026-07-01T00:00:00Z', resolved_at: '2026-07-01T12:00:00Z' }, // 12h
    ];
    const out = computeAgentPrecision(rows);
    expect(out['operations'].resolved).toBe(3);
    expect(out['operations'].median_hours_to_resolve).toBe(4);
  });

  it('computes the median hours-to-resolve across an even number of resolved findings (average of the two middle values)', () => {
    const rows: AgentFindingPrecisionRow[] = [
      { agent_id: 'card-ops', status: 'resolved', created_at: '2026-07-01T00:00:00Z', resolved_at: '2026-07-01T01:00:00Z' }, // 1h
      { agent_id: 'card-ops', status: 'resolved', created_at: '2026-07-01T00:00:00Z', resolved_at: '2026-07-01T03:00:00Z' }, // 3h
    ];
    const out = computeAgentPrecision(rows);
    expect(out['card-ops'].median_hours_to_resolve).toBe(2);
  });

  it('ignores a resolved-status row with no resolved_at when computing the median', () => {
    const rows: AgentFindingPrecisionRow[] = [
      { agent_id: 'crisis-escalation', status: 'resolved', created_at: '2026-07-01T00:00:00Z', resolved_at: null },
    ];
    const out = computeAgentPrecision(rows);
    expect(out['crisis-escalation'].resolved).toBe(0);
    expect(out['crisis-escalation'].median_hours_to_resolve).toBeNull();
  });

  it('keeps separate stats per agent', () => {
    const rows: AgentFindingPrecisionRow[] = [
      { agent_id: 'member-care', status: 'open', created_at: '2026-07-01T00:00:00Z', resolved_at: null },
      { agent_id: 'stewardship', status: 'dismissed', created_at: '2026-07-01T00:00:00Z', resolved_at: null },
    ];
    const out = computeAgentPrecision(rows);
    expect(Object.keys(out).sort()).toEqual(['member-care', 'stewardship']);
    expect(out['member-care'].generated).toBe(1);
    expect(out['stewardship'].generated).toBe(1);
  });
});
