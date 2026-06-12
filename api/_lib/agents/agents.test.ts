import { describe, it, expect } from 'vitest';
import { memberCareAgent } from './member-care';
import { stewardshipAgent } from './stewardship';
import { operationsAgent } from './operations';
import { DEFAULT_AGENT_SETTINGS, type AgentInput } from './types';

const NOW = new Date('2026-05-25T12:00:00Z');

function baseInput(overrides: Partial<AgentInput> = {}): AgentInput {
  return {
    churchId: 'church-1',
    now: NOW,
    settings: { ...DEFAULT_AGENT_SETTINGS },
    people: [],
    giving: [],
    events: [],
    tasks: [],
    portalActivity: [],
    kycVerifications: [],
    cards: [],
    crisisConversations: [],
    ...overrides,
  };
}

// ============================================
// MEMBER CARE
// ============================================
describe('agents/member-care', () => {
  it('returns nothing when disabled', () => {
    const obs = memberCareAgent(baseInput({
      settings: { ...DEFAULT_AGENT_SETTINGS, member_care_enabled: false },
      people: [{ id: 'p1', full_name: 'Inactive Joe', status: 'member', last_interaction_at: '2025-01-01T00:00:00Z' }],
    }));
    expect(obs).toEqual([]);
  });

  it('flags inactive members past the threshold', () => {
    const obs = memberCareAgent(baseInput({
      people: [
        { id: 'p1', full_name: 'Sarah Mendez', status: 'member', last_interaction_at: '2026-02-15T00:00:00Z' }, // ~99 days → urgent (≥ 60)
        { id: 'p2', full_name: 'Just Said Hi', status: 'member', last_interaction_at: '2026-05-20T00:00:00Z' }, // 5 days
      ],
    }));
    expect(obs).toHaveLength(1);
    expect(obs[0].kind).toBe('inactive_member');
    expect(obs[0].personId).toBe('p1');
    expect(obs[0].dedupKey).toBe('member-care:inactive:p1');
    expect(obs[0].severity).toBe('urgent');                    // ≥ 30 * 2
  });

  it('escalates to urgent only beyond 2× threshold', () => {
    const obs = memberCareAgent(baseInput({
      people: [
        { id: 'p1', full_name: 'A', status: 'member', last_interaction_at: '2026-04-20T00:00:00Z' }, // 35 days
      ],
    }));
    expect(obs[0].severity).toBe('attention');
  });

  it('flags members with no logged interactions ever', () => {
    const obs = memberCareAgent(baseInput({
      people: [
        { id: 'p1', full_name: 'Forgotten One', status: 'member', joined_at: '2026-01-01T00:00:00Z' },
      ],
    }));
    expect(obs).toHaveLength(1);
    expect(obs[0].dedupKey).toBe('member-care:no-interactions:p1');
  });

  it('does NOT flag visitors as inactive members', () => {
    const obs = memberCareAgent(baseInput({
      people: [
        { id: 'p1', status: 'visitor', last_interaction_at: '2026-01-01T00:00:00Z' },
      ],
    }));
    expect(obs.filter((o) => o.kind === 'inactive_member')).toEqual([]);
  });

  it('surfaces upcoming birthdays within window', () => {
    const obs = memberCareAgent(baseInput({
      people: [
        { id: 'p1', full_name: 'Birthday Sue', status: 'member', birthday: '1990-05-30' }, // 5 days away
        { id: 'p2', full_name: 'Birthday Now', status: 'member', birthday: '1985-05-25' }, // today
        { id: 'p3', full_name: 'Birthday Far', status: 'member', birthday: '1990-12-25' }, // 7 months away
      ],
    }));
    const birthdays = obs.filter((o) => o.kind === 'upcoming_birthday');
    expect(birthdays.map((o) => o.personId).sort()).toEqual(['p1', 'p2']);
    const today = birthdays.find((o) => o.personId === 'p2')!;
    expect(today.severity).toBe('attention');
    expect(today.title).toMatch(/today/);
  });

  it('rejects malformed birthday strings', () => {
    const obs = memberCareAgent(baseInput({
      people: [
        { id: 'p1', status: 'member', birthday: 'May 25' },
        { id: 'p2', status: 'member', birthday: '2025-13-99' },
      ],
    }));
    expect(obs.filter((o) => o.kind === 'upcoming_birthday')).toEqual([]);
  });

  it('flags recent visitors with no follow-up after 14 days', () => {
    const obs = memberCareAgent(baseInput({
      people: [
        { id: 'p1', status: 'visitor', joined_at: '2026-05-01T00:00:00Z' },  // 24 days, no followup
        { id: 'p2', status: 'visitor', joined_at: '2026-05-01T00:00:00Z', last_interaction_at: '2026-05-05T00:00:00Z' }, // followed up
        { id: 'p3', status: 'visitor', joined_at: '2026-05-20T00:00:00Z' },  // only 5 days
      ],
    }));
    const visitor = obs.filter((o) => o.kind === 'recent_visitor_followup');
    expect(visitor).toHaveLength(1);
    expect(visitor[0].personId).toBe('p1');
  });

  it('dedup keys are stable across runs', () => {
    const input = baseInput({
      people: [{ id: 'p1', status: 'member', last_interaction_at: '2026-04-01T00:00:00Z' }],
    });
    expect(memberCareAgent(input)[0].dedupKey).toBe(memberCareAgent(input)[0].dedupKey);
  });
});

// ============================================
// STEWARDSHIP
// ============================================
describe('agents/stewardship', () => {
  it('returns nothing when disabled', () => {
    const obs = stewardshipAgent(baseInput({
      settings: { ...DEFAULT_AGENT_SETTINGS, stewardship_enabled: false },
      giving: [{ id: 'g1', person_id: 'p1', amount_micro_usd: 5_000_000_000, occurred_at: '2026-05-20T00:00:00Z' }],
    }));
    expect(obs).toEqual([]);
  });

  it('flags first-time gifts when person has only one gift in history', () => {
    const obs = stewardshipAgent(baseInput({
      people: [{ id: 'p1', full_name: 'New Donor' }],
      giving: [
        { id: 'g1', person_id: 'p1', amount_micro_usd: 25_000_000, occurred_at: '2026-05-20T00:00:00Z' },
      ],
    }));
    const firsts = obs.filter((o) => o.kind === 'first_time_gift');
    expect(firsts).toHaveLength(1);
    expect(firsts[0].dedupKey).toBe('stewardship:first-time:g1');
    expect(firsts[0].title).toMatch(/New Donor/);
    expect(firsts[0].title).toMatch(/\$25\.00/);
  });

  it('does not double-flag first-time when person has prior gifts', () => {
    const obs = stewardshipAgent(baseInput({
      giving: [
        { id: 'g1', person_id: 'p1', amount_micro_usd: 10_000_000, occurred_at: '2026-04-01T00:00:00Z' },
        { id: 'g2', person_id: 'p1', amount_micro_usd: 10_000_000, occurred_at: '2026-05-01T00:00:00Z' },
      ],
    }));
    expect(obs.filter((o) => o.kind === 'first_time_gift')).toEqual([]);
  });

  it('flags large gifts above threshold', () => {
    const obs = stewardshipAgent(baseInput({
      people: [{ id: 'p1', full_name: 'Generous Pat' }],
      giving: [
        { id: 'g1', person_id: 'p1', amount_micro_usd: 5_000_000_000, occurred_at: '2026-05-20T00:00:00Z' }, // $5000
        { id: 'g2', person_id: 'p1', amount_micro_usd: 50_000_000, occurred_at: '2026-05-21T00:00:00Z' },   // $50
      ],
    }));
    const large = obs.filter((o) => o.kind === 'large_gift');
    expect(large).toHaveLength(1);
    expect(large[0].title).toMatch(/Generous Pat/);
    expect(large[0].title).toMatch(/\$5000/);
  });

  it('handles large gifts from anonymous donors (no person_id)', () => {
    const obs = stewardshipAgent(baseInput({
      giving: [
        { id: 'g1', person_id: null, amount_micro_usd: 5_000_000_000, occurred_at: '2026-05-20T00:00:00Z' },
      ],
    }));
    const large = obs.filter((o) => o.kind === 'large_gift');
    expect(large).toHaveLength(1);
    expect(large[0].title).toMatch(/Anonymous/);
  });

  it('flags lapsed givers (2+ gifts, none in N days)', () => {
    const obs = stewardshipAgent(baseInput({
      people: [{ id: 'p1', full_name: 'Sarah Hilliard' }],
      giving: [
        { id: 'g1', person_id: 'p1', amount_micro_usd: 100_000_000, occurred_at: '2026-01-15T00:00:00Z' },
        { id: 'g2', person_id: 'p1', amount_micro_usd: 100_000_000, occurred_at: '2026-02-15T00:00:00Z' }, // ~99 days ago
      ],
    }));
    const lapsed = obs.filter((o) => o.kind === 'lapsed_giver');
    expect(lapsed).toHaveLength(1);
    expect(lapsed[0].dedupKey).toBe('stewardship:lapsed:p1');
    expect(lapsed[0].metadata?.gift_count).toBe(2);
  });

  it('does NOT flag one-time donors as lapsed', () => {
    const obs = stewardshipAgent(baseInput({
      giving: [
        { id: 'g1', person_id: 'p1', amount_micro_usd: 100_000_000, occurred_at: '2026-01-15T00:00:00Z' },
      ],
    }));
    expect(obs.filter((o) => o.kind === 'lapsed_giver')).toEqual([]);
  });
});

// ============================================
// OPERATIONS
// ============================================
describe('agents/operations', () => {
  it('returns nothing when disabled', () => {
    const obs = operationsAgent(baseInput({
      settings: { ...DEFAULT_AGENT_SETTINGS, operations_enabled: false },
      events: [{ id: 'e1', title: 'Service', starts_at: '2026-05-27T15:00:00Z' }],
    }));
    expect(obs).toEqual([]);
  });

  it('flags upcoming events without a leader, within the horizon', () => {
    const obs = operationsAgent(baseInput({
      events: [
        { id: 'e1', title: 'Sunday Service', starts_at: '2026-05-27T15:00:00Z' },                  // 2 days, no leader
        { id: 'e2', title: 'Has Leader',     starts_at: '2026-05-27T15:00:00Z', leader_id: 'p1' }, // skip
        { id: 'e3', title: 'Future',         starts_at: '2026-07-01T15:00:00Z' },                  // out of horizon
        { id: 'e4', title: 'Past',           starts_at: '2026-05-20T15:00:00Z' },                  // past
      ],
    }));
    const noLead = obs.filter((o) => o.kind === 'event_no_leader');
    expect(noLead).toHaveLength(1);
    expect(noLead[0].dedupKey).toBe('operations:no-leader:e1');
    expect(noLead[0].severity).toBe('urgent');                     // 2 days
  });

  it('flags overdue pending tasks; ignores done; caps at 60 days', () => {
    const obs = operationsAgent(baseInput({
      tasks: [
        { id: 't1', title: 'Call Sarah',  due_date: '2026-05-18', status: 'pending' },        // 7 days late
        { id: 't2', title: 'Done task',   due_date: '2026-05-18', status: 'done' },           // skip
        { id: 't3', title: 'Future task', due_date: '2026-06-15', status: 'pending' },        // not yet due
        { id: 't4', title: 'Ancient',     due_date: '2024-01-01', status: 'pending' },        // > 60 days, skip
      ],
    }));
    const overdue = obs.filter((o) => o.kind === 'task_overdue');
    expect(overdue).toHaveLength(1);
    expect(overdue[0].relatedId).toBe('t1');
    expect(overdue[0].severity).toBe('attention');                 // 7 days
  });

  it('escalates overdue severity at 14+ days', () => {
    const obs = operationsAgent(baseInput({
      tasks: [
        { id: 't1', title: 'X', due_date: '2026-05-05', status: 'pending' },     // 20 days
      ],
    }));
    expect(obs[0].severity).toBe('urgent');
  });
});

// ============================================
// CROSS-AGENT INVARIANTS
// ============================================
describe('agents — invariants', () => {
  it('all observations have unique dedupKey within an agent run', () => {
    const input = baseInput({
      people: [
        { id: 'p1', full_name: 'A', status: 'member', last_interaction_at: '2026-04-01T00:00:00Z', birthday: '1990-05-26' },
        { id: 'p2', full_name: 'B', status: 'visitor', joined_at: '2026-04-01T00:00:00Z' },
      ],
      giving: [
        { id: 'g1', person_id: 'p1', amount_micro_usd: 5_000_000_000, occurred_at: '2026-05-20T00:00:00Z' },
      ],
    });
    const all = [
      ...memberCareAgent(input),
      ...stewardshipAgent(input),
      ...operationsAgent(input),
    ];
    const keys = all.map((o) => o.dedupKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every observation carries metadata sufficient for an operator to act', () => {
    const input = baseInput({
      people: [{ id: 'p1', full_name: 'Pat', status: 'member', last_interaction_at: '2026-04-01T00:00:00Z' }],
    });
    for (const o of memberCareAgent(input)) {
      expect(o.title).toBeTruthy();
      expect(o.detail).toBeTruthy();
      expect(['info', 'attention', 'urgent']).toContain(o.severity);
      expect(['task', 'interaction', 'log_only']).toContain(o.outputSink);
    }
  });
});
