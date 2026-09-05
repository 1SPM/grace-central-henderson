/**
 * Pure helpers for the live rehearsal's leg-3 assertion.
 *
 * The memory under test says "Thursday at 2pm" with no date. On 2026-09-05
 * the recall came back "Thursday at 2pm — that's today, September 4th" —
 * September 4 is a Friday, and the prompt said so. The assertion only
 * looked for the word "thursday", so it passed. These helpers let it fail
 * on a wrong calendar date instead: every date the reply pins must fall on
 * the weekday the memory names, and "today" may only be claimed on that
 * weekday. Dates named as PROVENANCE ("you told me on Friday, September
 * 4th") are the R-17 fix working and are excluded.
 */

export const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
export type Weekday = typeof WEEKDAYS[number];

const MONTHS: Record<string, number> = {
  january: 0, jan: 0, february: 1, feb: 1, march: 2, mar: 2, april: 3, apr: 3, may: 4, june: 5, jun: 5,
  july: 6, jul: 6, august: 7, aug: 7, september: 8, sep: 8, sept: 8, october: 9, oct: 9,
  november: 10, nov: 10, december: 11, dec: 11,
};

// "September 4th", "Sept 4", "9/4", "9/4/2026", "2026-09-04"
const DATE_RE = /\b(?:(january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec)\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s+(\d{4}))?|(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?|(\d{4})-(\d{2})-(\d{2}))\b/gi;

// A date in the 40 characters after one of these is when the NOTE was taken,
// not when the thing happens — the R-17 fix names it on purpose.
// The weekday may sit between "on" and the date: "told me on Friday, September 4th".
const PROVENANCE_RE = /\b(?:told|noted|mentioned|said|asked|wrote)\s+(?:me\s+)?(?:that\s+)?(?:on|back on)\s+(?:(?:sun|mon|tues|wednes|thurs|fri|satur)day,?\s+)?$/i;

export interface DateClaim { raw: string; date: Date; weekday: Weekday }

export function findDateClaims(text: string, defaultYear: number): DateClaim[] {
  const claims: DateClaim[] = [];
  for (const m of text.matchAll(DATE_RE)) {
    const before = text.slice(Math.max(0, m.index! - 40), m.index!);
    if (PROVENANCE_RE.test(before)) continue;
    let y: number, mo: number, d: number;
    if (m[1]) { mo = MONTHS[m[1].toLowerCase().replace('.', '')]; d = Number(m[2]); y = m[3] ? Number(m[3]) : defaultYear; }
    else if (m[4]) { mo = Number(m[4]) - 1; d = Number(m[5]); y = m[6] ? Number(m[6]) : defaultYear; }
    else { y = Number(m[7]); mo = Number(m[8]) - 1; d = Number(m[9]); }
    const date = new Date(y, mo, d);
    if (Number.isNaN(date.getTime())) continue;
    claims.push({ raw: m[0], date, weekday: WEEKDAYS[date.getDay()] });
  }
  return claims;
}

/**
 * True when the reply asserts the EVENT is today — not merely that the note
 * was taken today. "You told me that on Friday (today)" is provenance: a
 * telling-verb earlier in the same sentence, with no sentence break between
 * it and "today", marks the whole clause as being about when the note was
 * taken.
 */
export function claimsToday(text: string): boolean {
  const hits = [...text.matchAll(/\btoday\b/gi)];
  return hits.some(h => !/\b(?:told|noted|mentioned|said|asked|wrote)\b[^.!?\n]*$/i.test(text.slice(Math.max(0, h.index! - 60), h.index!)));
}

export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[date.getDay()];
}
