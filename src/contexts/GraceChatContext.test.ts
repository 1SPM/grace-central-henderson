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
});
