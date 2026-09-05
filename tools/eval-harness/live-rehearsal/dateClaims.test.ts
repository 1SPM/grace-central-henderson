import { describe, it, expect } from 'vitest';
import { findDateClaims, claimsToday, weekdayOf } from './dateClaims';

describe('date claims in a recall reply', () => {
  it('catches the 2026-09-05 miss: "September 4th" pinned to a Thursday memory is a Friday', () => {
    const claims = findDateClaims("Thursday at 2pm — that's today, September 4th.", 2026);
    expect(claims).toHaveLength(1);
    expect(claims[0].weekday).toBe('Friday');
    expect(claimsToday("Thursday at 2pm — that's today, September 4th.")).toBe(true);
  });

  it('accepts the seeded workshop wording', () => {
    const claims = findDateClaims('Thursday, September 10th — you told me that earlier this week.', 2026);
    expect(claims.map(c => c.weekday)).toEqual(['Thursday']);
    expect(claimsToday('Thursday, September 10th — you told me that earlier this week.')).toBe(false);
  });

  it('ignores a provenance date — the R-17 fix naming when the note was taken', () => {
    const text = 'You told me on Friday, September 4th that your check-in with Bill is Thursday at 2pm.';
    expect(findDateClaims(text, 2026)).toHaveLength(0);
    expect(claimsToday('You told me today that the check-in is Thursday.')).toBe(false);
  });

  it('provenance "today" with a weekday in between is still provenance (sample 7, 2026-09-05)', () => {
    const reply = 'Your ZZR21 check-in with Bill Hoffman is Thursday at 2pm. You told me that on Friday (today).';
    expect(claimsToday(reply)).toBe(false);
    expect(findDateClaims(reply, 2026)).toEqual([]);
    // …but an event-claim "today" after a sentence break is still caught.
    expect(claimsToday('You told me on Friday. It is today at 2pm.')).toBe(true);
  });

  it('reads the other date shapes', () => {
    expect(findDateClaims('on 9/10 at 2pm', 2026).map(c => c.weekday)).toEqual(['Thursday']);
    expect(findDateClaims('on 2026-09-11', 2026).map(c => c.weekday)).toEqual(['Friday']);
    expect(findDateClaims('Sept 3, 2026', 2026).map(c => c.weekday)).toEqual(['Thursday']);
  });

  it('a reply with no date pins nothing', () => {
    expect(findDateClaims('Thursday at 2pm.', 2026)).toEqual([]);
    expect(weekdayOf(new Date(2026, 8, 10))).toBe('Thursday');
  });
});
