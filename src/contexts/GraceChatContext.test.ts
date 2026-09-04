/**
 * Regression test for a real privacy defect found while grounding
 * Fixture #004 (pastoral_care) of the GRACE Intelligence Qualification
 * Framework's evaluation harness: buildDataContext() included private
 * prayer requests' raw content in the Ask GRACE prompt on the same terms
 * as public ones — no isPrivate check existed anywhere in the function.
 * Fixed by adding `&& !p.isPrivate` to both the active-prayers filter and
 * its count. This test guards against reintroducing that gap.
 */
import { describe, it, expect } from 'vitest';
import { buildDataContext, type GraceData } from './GraceChatContext';

function minimalData(over: Partial<GraceData> = {}): GraceData {
  return {
    people: [], tasks: [], giving: [], events: [], groups: [], prayers: [], attendance: [],
    ...over,
  };
}

describe('buildDataContext — private prayer requests never reach the model', () => {
  it('excludes a private, unanswered prayer\'s content from the prompt', () => {
    const prompt = buildDataContext(minimalData({
      prayers: [
        { id: 'p1', personId: 'x', content: 'Please pray for my marriage — we are separating', isPrivate: true, isAnswered: false, createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z' },
        { id: 'p2', personId: 'x', content: 'Pray for my knee surgery next week', isPrivate: false, isAnswered: false, createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z' },
      ],
    }));

    expect(prompt).not.toContain('separating');
    expect(prompt).toContain('knee surgery');
  });

  it('the "Active prayers (N)" count excludes private prayers too, so the number matches what is shown', () => {
    const prompt = buildDataContext(minimalData({
      prayers: [
        { id: 'p1', personId: 'x', content: 'private one', isPrivate: true, isAnswered: false, createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z' },
        { id: 'p2', personId: 'x', content: 'public one', isPrivate: false, isAnswered: false, createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z' },
      ],
    }));

    expect(prompt).toMatch(/Active prayers \(1\):/);
  });

  it('an answered private prayer is excluded for the same reason unanswered public ones are (isAnswered filter still applies)', () => {
    const prompt = buildDataContext(minimalData({
      prayers: [
        { id: 'p1', personId: 'x', content: 'already answered', isPrivate: false, isAnswered: true, createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z' },
      ],
    }));

    expect(prompt).not.toContain('already answered');
    expect(prompt).toMatch(/Active prayers \(0\):/);
  });

  it('does not truncate prayer content mid-word — a long prayer\'s full text reaches the prompt', () => {
    // Found via the live-judgment tier (docs/GRACE_INTELLIGENCE_QUALIFICATION_FRAMEWORK.md's
    // "Live-judgment tier" section): the prior 50-char cap cut this exact
    // text off at "...as she gr", losing "grieves the loss of her husband"
    // — the detail a CONNECT-level question needed to reason about.
    const content = 'Please keep Martha Reyes in your prayers as she grieves the sudden loss of her husband last week.';
    const prompt = buildDataContext(minimalData({
      prayers: [{ id: 'p1', personId: 'x', content, isPrivate: false, isAnswered: false, createdAt: '2026-08-31T00:00:00.000Z', updatedAt: '2026-08-31T00:00:00.000Z' }],
    }));

    expect(prompt).toContain(content);
    expect(prompt).toContain('grieves the sudden loss of her husband');
  });
});

describe('buildDataContext — private events never reach the model', () => {
  it('excludes a private event\'s title from the prompt, same category of gap as the prayer fix', () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 2 * 86400_000).toISOString();
    const prompt = buildDataContext(minimalData({
      events: [
        { id: 'e1', title: 'Confidential elder discipline meeting', startDate: soon, allDay: true, category: 'event', isPrivate: true },
        { id: 'e2', title: 'Fall Festival', startDate: soon, allDay: true, category: 'event', isPrivate: false },
      ],
    }));

    expect(prompt).not.toContain('Confidential elder discipline meeting');
    expect(prompt).toContain('Fall Festival');
  });

  it('an event with no isPrivate field at all still appears (undefined is falsy, not excluded)', () => {
    const now = new Date();
    const soon = new Date(now.getTime() + 2 * 86400_000).toISOString();
    const prompt = buildDataContext(minimalData({
      events: [{ id: 'e1', title: 'Regular Sunday Service', startDate: soon, allDay: true, category: 'event' }],
    }));

    expect(prompt).toContain('Regular Sunday Service');
  });
});

describe('buildDataContext — only real calendar rows reach the model', () => {
  const ev = (over: Record<string, unknown>) => ({
    id: 'e1', title: 'X', startDate: new Date().toISOString(),
    allDay: true, category: 'event' as const, ...over,
  });

  it('a real upcoming event reaches the prompt (the legitimate half of the parity ask)', () => {
    const soon = new Date(Date.now() + 2 * 86400_000).toISOString();
    const prompt = buildDataContext(minimalData({
      events: [ev({ id: 'real', title: 'Fall Festival', startDate: soon })],
    }));
    expect(prompt).toContain('Fall Festival');
  });

  it('does NOT invent recurring services or holidays the church never entered', () => {
    // mergeCalendarWithRhythm() generates a "Sunday Service" for every Sunday
    // of the year plus seasonal holidays. Those are a Dashboard backdrop, not
    // church records. Measured on the live tenant, feeding them here made
    // GRACE report Labor Day / Membership Class / Sunday Service as upcoming
    // when the church had zero real events in the window.
    const prompt = buildDataContext(minimalData({ events: [] }));
    expect(prompt).not.toContain('Sunday Service');
    expect(prompt).not.toContain('Labor Day');
    expect(prompt).not.toContain('Membership Class');
    expect(prompt).not.toContain('Christmas');
    expect(prompt).not.toContain('Easter');
  });

  it('an event earlier TODAY still counts — day-start boundary, matching the Dashboard', () => {
    const now = new Date();
    const earlierToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 1).toISOString();
    const prompt = buildDataContext(minimalData({
      events: [ev({ id: 'today', title: 'Morning Prayer Gathering', startDate: earlierToday })],
    }));
    expect(prompt).toContain('Morning Prayer Gathering');
  });

  it('an empty 7-day window names the next real event instead of saying "none"', () => {
    const later = new Date(Date.now() + 30 * 86400_000).toISOString();
    const prompt = buildDataContext(minimalData({
      events: [ev({ id: 'later', title: 'Fall Retreat', startDate: later })],
    }));
    expect(prompt).toContain('none in the next 7 days');
    expect(prompt).toContain('Fall Retreat');
  });

  it('no future events at all is stated plainly, and warns against describing patterns as entries', () => {
    const past = new Date(Date.now() - 30 * 86400_000).toISOString();
    const prompt = buildDataContext(minimalData({
      events: [ev({ id: 'past', title: 'Summer Picnic', startDate: past })],
    }));
    expect(prompt).toContain('no events are scheduled in this church\'s calendar');
    expect(prompt).toContain('do not describe recurring services or holidays');
    expect(prompt).not.toContain('Summer Picnic');
  });

  it('private events are still excluded from the lookahead, not just the window', () => {
    const later = new Date(Date.now() + 30 * 86400_000).toISOString();
    const prompt = buildDataContext(minimalData({
      events: [ev({ id: 'p', title: 'Confidential board session', startDate: later, isPrivate: true })],
    }));
    expect(prompt).not.toContain('Confidential board session');
    expect(prompt).toContain('no events are scheduled in this church\'s calendar');
  });
});

describe('buildDataContext — inactivity claims require real attendance data', () => {
  // Found via the live-judgment tier: with zero attendance rows, every
  // member/regular landed in "Inactive members/regulars" by default (no
  // record != recently attended), and the model narrated that as a
  // confident "gone quiet on check-ins" claim with nothing behind it.
  it('does not label anyone inactive when the attendance array is empty', () => {
    const prompt = buildDataContext(minimalData({
      people: [
        { id: 'p1', firstName: 'Martha', lastName: 'Reyes', email: '', phone: '', status: 'member', tags: [], smallGroups: [] },
        { id: 'p2', firstName: 'Carlos', lastName: 'Bennett', email: '', phone: '', status: 'regular', tags: [], smallGroups: [] },
      ],
      attendance: [],
    }));

    expect(prompt).not.toContain('Martha Reyes');
    expect(prompt).not.toContain('Carlos Bennett');
    expect(prompt).toMatch(/Inactive members\/regulars: attendance not tracked in this system/);
  });

  it('still correctly identifies an inactive person when real attendance data exists', () => {
    const recentDate = new Date().toISOString().slice(0, 10);
    const prompt = buildDataContext(minimalData({
      people: [
        { id: 'p1', firstName: 'Martha', lastName: 'Reyes', email: '', phone: '', status: 'member', tags: [], smallGroups: [] },
        { id: 'p2', firstName: 'Carlos', lastName: 'Bennett', email: '', phone: '', status: 'regular', tags: [], smallGroups: [] },
      ],
      attendance: [{ id: 'a1', personId: 'p1', eventType: 'sunday', date: recentDate, checkedInAt: recentDate }],
    }));

    expect(prompt).not.toContain('Martha Reyes,');
    expect(prompt).toMatch(/Inactive members\/regulars: Carlos Bennett/);
  });
});
