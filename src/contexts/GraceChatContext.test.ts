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
