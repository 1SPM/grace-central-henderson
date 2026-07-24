import { describe, it, expect } from 'vitest';
import { categoryForEventType, groupEventsForDigest, type DigestEvent, type NotificationPref } from './notificationDigest.js';

const CHURCH_A = '11111111-1111-1111-1111-111111111111';
const CHURCH_B = '22222222-2222-2222-2222-222222222222';
const USER_1 = 'user-1';
const USER_2 = 'user-2';

function event(overrides: Partial<DigestEvent>): DigestEvent {
  return { id: 'evt-1', church_id: CHURCH_A, event_type: 'approval.decided', created_at: '2026-07-18T00:00:00Z', ...overrides };
}

function pref(overrides: Partial<NotificationPref>): NotificationPref {
  return { user_id: USER_1, church_id: CHURCH_A, category: 'approvals', channel: 'email', enabled: true, ...overrides };
}

describe('categoryForEventType', () => {
  it('maps approval.* to approvals', () => {
    expect(categoryForEventType('approval.decided')).toBe('approvals');
    expect(categoryForEventType('approval.related_party_flagged')).toBe('approvals');
  });

  it('maps agent_finding.* to agents', () => {
    expect(categoryForEventType('agent_finding.triaged')).toBe('agents');
  });

  it('maps finance.* to finance', () => {
    expect(categoryForEventType('finance.expense.recorded')).toBe('finance');
  });

  it('falls back to digest for anything else', () => {
    expect(categoryForEventType('care.request.submitted')).toBe('digest');
    expect(categoryForEventType('portal.member_provisioned')).toBe('digest');
  });
});

describe('groupEventsForDigest', () => {
  it('returns an empty list when there are no events', () => {
    expect(groupEventsForDigest([], [pref({})])).toEqual([]);
  });

  it('returns an empty list when there are no prefs', () => {
    expect(groupEventsForDigest([event({})], [])).toEqual([]);
  });

  it('groups a matching event into its enabled-category user', () => {
    const result = groupEventsForDigest([event({ event_type: 'approval.decided' })], [pref({ category: 'approvals' })]);
    expect(result).toHaveLength(1);
    expect(result[0].user_id).toBe(USER_1);
    expect(result[0].events).toHaveLength(1);
  });

  it('excludes a disabled pref', () => {
    const result = groupEventsForDigest(
      [event({ event_type: 'approval.decided' })],
      [pref({ category: 'approvals', enabled: false })],
    );
    expect(result).toEqual([]);
  });

  it('excludes an sms-channel pref (digest is email-only)', () => {
    const result = groupEventsForDigest(
      [event({ event_type: 'approval.decided' })],
      [pref({ category: 'approvals', channel: 'sms' })],
    );
    expect(result).toEqual([]);
  });

  it('excludes a crisis-category pref — crisis is synchronous-only, never digested', () => {
    const result = groupEventsForDigest(
      [event({ event_type: 'approval.decided' })],
      [pref({ category: 'crisis' })],
    );
    expect(result).toEqual([]);
  });

  it('never cross-tenant matches — a user only receives events from their own church', () => {
    const result = groupEventsForDigest(
      [event({ event_type: 'approval.decided', church_id: CHURCH_B })],
      [pref({ category: 'approvals', church_id: CHURCH_A })],
    );
    expect(result).toEqual([]);
  });

  it('groups multiple events for the same user into one recipient entry', () => {
    const result = groupEventsForDigest(
      [
        event({ id: 'e1', event_type: 'approval.decided' }),
        event({ id: 'e2', event_type: 'approval.related_party_flagged' }),
      ],
      [pref({ category: 'approvals' })],
    );
    expect(result).toHaveLength(1);
    expect(result[0].events.map(e => e.id)).toEqual(['e1', 'e2']);
  });

  it('sends different categories to different users based on their own enabled prefs', () => {
    const result = groupEventsForDigest(
      [
        event({ id: 'e1', event_type: 'approval.decided' }),
        event({ id: 'e2', event_type: 'finance.expense.recorded' }),
      ],
      [
        pref({ user_id: USER_1, category: 'approvals' }),
        pref({ user_id: USER_2, category: 'finance' }),
      ],
    );
    expect(result).toHaveLength(2);
    const byUser = new Map(result.map(r => [r.user_id, r]));
    expect(byUser.get(USER_1)?.events.map(e => e.id)).toEqual(['e1']);
    expect(byUser.get(USER_2)?.events.map(e => e.id)).toEqual(['e2']);
  });

  it('does not send an unmapped-category (digest) event to a user only subscribed to approvals', () => {
    const result = groupEventsForDigest(
      [event({ event_type: 'care.request.submitted' })],
      [pref({ category: 'approvals' })],
    );
    expect(result).toEqual([]);
  });

  it('a user subscribed to the digest category receives unmapped events', () => {
    const result = groupEventsForDigest(
      [event({ event_type: 'care.request.submitted' })],
      [pref({ category: 'digest' })],
    );
    expect(result).toHaveLength(1);
  });
});
