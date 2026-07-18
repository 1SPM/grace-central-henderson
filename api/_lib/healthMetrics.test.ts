import { describe, it, expect } from 'vitest';
import {
  computeEngagementScore,
  computeAtRiskMembers,
  computeHealthMetrics,
  type HealthMetricsInput,
} from './healthMetrics.js';

const NOW = new Date('2026-07-18T00:00:00.000Z');

describe('computeEngagementScore', () => {
  it('returns 0 for no events', () => {
    expect(computeEngagementScore([], NOW)).toBe(0);
  });

  it('ignores events older than 90 days', () => {
    const events = [{ event_type: 'login', created_at: '2026-01-01T00:00:00.000Z' }];
    expect(computeEngagementScore(events, NOW)).toBe(0);
  });

  it('weighs a high-intent event (gift) more than a passive one (login) at the same recency', () => {
    const today = NOW.toISOString();
    const giftScore = computeEngagementScore([{ event_type: 'gift', created_at: today }], NOW);
    const loginScore = computeEngagementScore([{ event_type: 'login', created_at: today }], NOW);
    expect(giftScore).toBeGreaterThan(loginScore);
  });

  it('decays contribution with age — a today event scores higher than an 89-day-old event of the same type', () => {
    const today = NOW.toISOString();
    const old = new Date(NOW.getTime() - 89 * 86_400_000).toISOString();
    const todayScore = computeEngagementScore([{ event_type: 'rsvp', created_at: today }], NOW);
    const oldScore = computeEngagementScore([{ event_type: 'rsvp', created_at: old }], NOW);
    expect(todayScore).toBeGreaterThan(oldScore);
  });

  it('caps a single event type\'s contribution — 50 logins in one day cannot max the score', () => {
    const today = NOW.toISOString();
    const events = Array.from({ length: 50 }, () => ({ event_type: 'login', created_at: today }));
    const score = computeEngagementScore(events, NOW);
    expect(score).toBeLessThan(100);
  });

  it('clamps the final score to at most 100', () => {
    const today = NOW.toISOString();
    const events = [
      ...Array.from({ length: 20 }, () => ({ event_type: 'gift', created_at: today })),
      ...Array.from({ length: 20 }, () => ({ event_type: 'milestone_achieved', created_at: today })),
      ...Array.from({ length: 20 }, () => ({ event_type: 'rsvp', created_at: today })),
      ...Array.from({ length: 20 }, () => ({ event_type: 'checkin', created_at: today })),
      ...Array.from({ length: 20 }, () => ({ event_type: 'group_join', created_at: today })),
    ];
    expect(computeEngagementScore(events, NOW)).toBe(100);
  });

  it('treats an unrecognized event type as passive (default weight), not high-intent', () => {
    const today = NOW.toISOString();
    const unknownScore = computeEngagementScore([{ event_type: 'profile_view', created_at: today }], NOW);
    const giftScore = computeEngagementScore([{ event_type: 'gift', created_at: today }], NOW);
    expect(unknownScore).toBeLessThan(giftScore);
  });
});

describe('computeAtRiskMembers', () => {
  const PEOPLE = [
    { id: 'p1', first_name: 'Ada', last_name: 'Lovelace' },
    { id: 'p2', first_name: 'Grace', last_name: 'Hopper' },
    { id: 'p3', first_name: 'Alan', last_name: null },
  ];

  it('flags a person active 60 days ago (within 180, outside 45) as at-risk', () => {
    const sixtyDaysAgo = new Date(NOW.getTime() - 60 * 86_400_000).toISOString();
    const result = computeAtRiskMembers([{ person_id: 'p1', created_at: sixtyDaysAgo }], PEOPLE, NOW);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('p1');
    expect(result[0].name).toBe('Ada Lovelace');
  });

  it('does not flag a person active 10 days ago (within the 45-day recent window)', () => {
    const tenDaysAgo = new Date(NOW.getTime() - 10 * 86_400_000).toISOString();
    const result = computeAtRiskMembers([{ person_id: 'p1', created_at: tenDaysAgo }], PEOPLE, NOW);
    expect(result).toHaveLength(0);
  });

  it('does not flag a person with no activity at all in 180 days (already long gone, not newly at-risk)', () => {
    const twoHundredDaysAgo = new Date(NOW.getTime() - 200 * 86_400_000).toISOString();
    const result = computeAtRiskMembers([{ person_id: 'p1', created_at: twoHundredDaysAgo }], PEOPLE, NOW);
    expect(result).toHaveLength(0);
  });

  it('treats "exactly N days ago" as still within the window (inclusive boundary)', () => {
    const exactly45DaysAgo = new Date(NOW.getTime() - 45 * 86_400_000).toISOString();
    const result = computeAtRiskMembers([{ person_id: 'p1', created_at: exactly45DaysAgo }], PEOPLE, NOW);
    expect(result).toHaveLength(0);
  });

  it('uses only the most recent event per person', () => {
    const sixtyDaysAgo = new Date(NOW.getTime() - 60 * 86_400_000).toISOString();
    const fiveDaysAgo = new Date(NOW.getTime() - 5 * 86_400_000).toISOString();
    const events = [
      { person_id: 'p1', created_at: sixtyDaysAgo },
      { person_id: 'p1', created_at: fiveDaysAgo },
    ];
    const result = computeAtRiskMembers(events, PEOPLE, NOW);
    expect(result).toHaveLength(0);
  });

  it('falls back to "Unknown" when both name fields are null', () => {
    const sixtyDaysAgo = new Date(NOW.getTime() - 60 * 86_400_000).toISOString();
    const people = [{ id: 'p4', first_name: null, last_name: null }];
    const result = computeAtRiskMembers([{ person_id: 'p4', created_at: sixtyDaysAgo }], people, NOW);
    expect(result[0].name).toBe('Unknown');
  });

  it('skips events for people not in the roster', () => {
    const sixtyDaysAgo = new Date(NOW.getTime() - 60 * 86_400_000).toISOString();
    const result = computeAtRiskMembers([{ person_id: 'ghost', created_at: sixtyDaysAgo }], PEOPLE, NOW);
    expect(result).toHaveLength(0);
  });
});

describe('computeHealthMetrics', () => {
  const basePeople = [
    { id: 'm1', status: 'member', first_visit: null, portal_enabled: true, clerk_user_id: 'clerk_1', first_name: 'Mia', last_name: 'K' },
    { id: 'm2', status: 'regular', first_visit: null, portal_enabled: false, clerk_user_id: null, first_name: 'Noah', last_name: 'L' },
    { id: 'v1', status: 'visitor', first_visit: new Date(NOW.getTime() - 10 * 86_400_000).toISOString(), portal_enabled: false, clerk_user_id: null, first_name: 'Vic', last_name: 'V' },
  ];

  function baseInput(overrides: Partial<HealthMetricsInput> = {}): HealthMetricsInput {
    return {
      people: basePeople,
      activeRecurringGivers: [],
      activeGroupMemberships: [],
      openCareRequests: [],
      events: [],
      now: NOW,
      ...overrides,
    };
  }

  it('every ratio metric returns not_yet_computed with a null value when its denominator is empty', () => {
    const result = computeHealthMetrics(baseInput({ people: [] }));
    expect(result.visitor_conversion_90d).toEqual(expect.objectContaining({ value: null, source: 'not_yet_computed' }));
    expect(result.recurring_coverage).toEqual(expect.objectContaining({ value: null, source: 'not_yet_computed' }));
    expect(result.group_participation).toEqual(expect.objectContaining({ value: null, source: 'not_yet_computed' }));
    expect(result.portal_adoption).toEqual(expect.objectContaining({ value: null, source: 'not_yet_computed' }));
    expect(result.engagement).toEqual(expect.objectContaining({ value: null, source: 'not_yet_computed' }));
  });

  it('care_responsiveness is not_yet_computed when there are no open care requests', () => {
    const result = computeHealthMetrics(baseInput());
    expect(result.care_responsiveness).toEqual(expect.objectContaining({ value: null, source: 'not_yet_computed' }));
  });

  it('computes care_responsiveness as the median age in hours of open requests', () => {
    const result = computeHealthMetrics(baseInput({
      openCareRequests: [
        { created_at: new Date(NOW.getTime() - 2 * 3_600_000).toISOString() },
        { created_at: new Date(NOW.getTime() - 10 * 3_600_000).toISOString() },
      ],
    }));
    expect(result.care_responsiveness.source).toBe('computed');
    expect(result.care_responsiveness.value).toBe(6);
  });

  it('computes visitor_conversion_90d only from converted visitors among recent first-visits', () => {
    const people = [
      ...basePeople,
      { id: 'v2', status: 'member', first_visit: new Date(NOW.getTime() - 20 * 86_400_000).toISOString(), portal_enabled: false, clerk_user_id: null, first_name: 'Convert', last_name: 'Ed' },
    ];
    const result = computeHealthMetrics(baseInput({ people }));
    // v1 (visitor, not converted) and v2 (member, converted) both had first_visit in last 90d.
    expect(result.visitor_conversion_90d).toEqual(expect.objectContaining({ value: 50, source: 'computed' }));
  });

  it('computes recurring_coverage as covered members over all member-like people', () => {
    const result = computeHealthMetrics(baseInput({
      activeRecurringGivers: [{ person_id: 'm1' }],
    }));
    // m1 and m2 are member-like; only m1 has an active recurring gift.
    expect(result.recurring_coverage).toEqual(expect.objectContaining({ value: 50, source: 'computed' }));
  });

  it('computes group_participation as active-group members over member-like people', () => {
    const result = computeHealthMetrics(baseInput({
      activeGroupMemberships: [{ person_id: 'm1' }, { person_id: 'm2' }],
    }));
    expect(result.group_participation).toEqual(expect.objectContaining({ value: 100, source: 'computed' }));
  });

  it('computes portal_adoption requiring both portal_enabled and a clerk_user_id', () => {
    const result = computeHealthMetrics(baseInput());
    // Only m1 has portal_enabled + clerk_user_id; m2 has neither.
    expect(result.portal_adoption).toEqual(expect.objectContaining({ value: 50, source: 'computed' }));
  });

  it('computes a non-zero engagement mean when member-like people have recent events, and reports at_risk_count', () => {
    const result = computeHealthMetrics(baseInput({
      events: [
        { person_id: 'm1', event_type: 'gift', created_at: NOW.toISOString() },
        { person_id: 'm2', created_at: new Date(NOW.getTime() - 60 * 86_400_000).toISOString(), event_type: 'login' },
      ],
    }));
    expect(result.engagement.source).toBe('computed');
    expect(result.engagement.value).toBeGreaterThan(0);
    expect(result.engagement.at_risk_count).toBe(1); // m2's only event is 60 days old
  });
});
