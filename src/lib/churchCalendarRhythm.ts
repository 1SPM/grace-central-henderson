import type { CalendarEvent } from '../types';

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isoDateTime(year: number, month: number, day: number, hour = 0, minute = 0): string {
  return `${isoDate(year, month, day)}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;
}

/** Anonymous Gregorian algorithm for Easter Sunday. */
export function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function nthWeekdayOfMonth(year: number, month: number, weekday: number, n: number): Date {
  const first = new Date(year, month - 1, 1);
  const offset = (weekday - first.getDay() + 7) % 7;
  return new Date(year, month - 1, 1 + offset + (n - 1) * 7);
}

function lastWeekdayOfMonth(year: number, month: number, weekday: number): Date {
  const last = new Date(year, month, 0);
  const offset = (last.getDay() - weekday + 7) % 7;
  return new Date(year, month - 1, last.getDate() - offset);
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}

function rhythm(
  id: string,
  title: string,
  date: Date,
  category: CalendarEvent['category'],
  opts?: { allDay?: boolean; hour?: number; minute?: number; location?: string; description?: string },
): CalendarEvent {
  const allDay = opts?.allDay ?? true;
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const day = date.getDate();
  return {
    id: `rhythm-${id}`,
    title,
    startDate: allDay
      ? isoDateTime(y, m, day, 12, 0)
      : isoDateTime(y, m, day, opts?.hour ?? 10, opts?.minute ?? 0),
    allDay,
    category,
    location: opts?.location,
    description: opts?.description,
  };
}

/** Seasonal holidays and church milestones for the liturgical / ministry year. */
export function buildChurchRhythmEvents(year: number): CalendarEvent[] {
  const easter = getEasterSunday(year);
  const ashWednesday = addDays(easter, -46);
  const palmSunday = addDays(easter, -7);
  const goodFriday = addDays(easter, -2);
  const maundyThursday = addDays(easter, -3);
  const ascension = addDays(easter, 39);
  const pentecost = addDays(easter, 49);

  // Advent: fourth Sunday before Christmas
  const christmas = new Date(year, 11, 25);
  let advent = new Date(christmas);
  while (advent.getDay() !== 0) advent = addDays(advent, -1);
  advent = addDays(advent, -21);

  const mothersDay = nthWeekdayOfMonth(year, 5, 0, 2);
  const fathersDay = nthWeekdayOfMonth(year, 6, 0, 3);
  const mlkDay = nthWeekdayOfMonth(year, 1, 1, 3);
  const memorialDay = lastWeekdayOfMonth(year, 5, 1);
  const laborDay = nthWeekdayOfMonth(year, 9, 1, 1);
  const thanksgiving = nthWeekdayOfMonth(year, 11, 4, 4);
  const nationalDayOfPrayer = nthWeekdayOfMonth(year, 5, 4, 1);

  const firstSunday = nthWeekdayOfMonth(year, 1, 0, 1);
  const baptismSunday = nthWeekdayOfMonth(year, 3, 0, 2);
  const backToChurch = nthWeekdayOfMonth(year, 9, 0, 2);
  const stewardshipSunday = nthWeekdayOfMonth(year, 11, 0, 1);
  const vbsMonday = nthWeekdayOfMonth(year, 6, 1, 2);

  return [
    // —— Seasonal & civic holidays ——
    rhythm(`${year}-new-year`, "New Year's Day", new Date(year, 0, 1), 'holiday'),
    rhythm(`${year}-mlk`, 'MLK Day of Service', mlkDay, 'holiday', { description: 'Community service emphasis across ministries' }),
    rhythm(`${year}-valentines`, "Valentine's Outreach", new Date(year, 1, 14), 'outreach', { description: 'Care packages for widows & seniors' }),
    rhythm(`${year}-ash-wed`, 'Ash Wednesday', ashWednesday, 'holiday', { location: 'Chapel', hour: 18, minute: 30, allDay: false }),
    rhythm(`${year}-palm-sun`, 'Palm Sunday', palmSunday, 'holiday', { location: 'Main Sanctuary' }),
    rhythm(`${year}-maundy`, 'Maundy Thursday', maundyThursday, 'holiday', { location: 'Chapel', hour: 19, allDay: false }),
    rhythm(`${year}-good-fri`, 'Good Friday', goodFriday, 'holiday', { location: 'Main Sanctuary', hour: 18, allDay: false }),
    rhythm(`${year}-easter`, 'Easter Sunday', easter, 'holiday', { location: 'Main Sanctuary', description: 'Sunrise, 9:45 AM, and 11:30 AM experiences' }),
    rhythm(`${year}-mothers`, "Mother's Day", mothersDay, 'holiday'),
    rhythm(`${year}-memorial`, 'Memorial Day', memorialDay, 'holiday'),
    rhythm(`${year}-fathers`, "Father's Day", fathersDay, 'holiday'),
    rhythm(`${year}-july4`, 'Independence Day', new Date(year, 6, 4), 'holiday'),
    rhythm(`${year}-labor`, 'Labor Day', laborDay, 'holiday'),
    rhythm(`${year}-911`, 'Day of Remembrance', new Date(year, 8, 11), 'holiday', { description: 'Prayer & community remembrance' }),
    rhythm(`${year}-thanksgiving`, 'Thanksgiving', thanksgiving, 'holiday', { description: 'Community meal & gratitude emphasis' }),
    rhythm(`${year}-advent`, 'Advent Begins', advent, 'holiday', { description: 'Season of preparation — wreath lighting each Sunday' }),
    rhythm(`${year}-xmas-eve`, 'Christmas Eve Services', new Date(year, 11, 24), 'service', { location: 'Main Sanctuary', hour: 17, allDay: false, description: 'Family & candlelight services' }),
    rhythm(`${year}-xmas`, 'Christmas Day', new Date(year, 11, 25), 'holiday'),
    rhythm(`${year}-nye`, "New Year's Eve Prayer", new Date(year, 11, 31), 'service', { location: 'Chapel', hour: 22, allDay: false }),

    // —— Church ministry milestones ——
    rhythm(`${year}-vision`, 'Vision & Prayer Sunday', firstSunday, 'ceremony', { location: 'Main Sanctuary', description: 'Annual direction-setting for the congregation' }),
    rhythm(`${year}-first-step`, 'First Step Weekend', nthWeekdayOfMonth(year, 2, 6, 1), 'event', { location: 'Fellowship Hall', description: 'Onboarding path for new guests' }),
    rhythm(`${year}-baptism`, 'Baptism Sunday', baptismSunday, 'baptism', { location: 'Main Sanctuary' }),
    rhythm(`${year}-easter-outreach`, 'Easter Outreach Week', addDays(easter, -7), 'outreach', { description: 'Invite cards, neighborhood serve day, guest follow-up' }),
    rhythm(`${year}-ndop`, 'National Day of Prayer', nationalDayOfPrayer, 'outreach', { location: 'Prayer Garden', hour: 12, allDay: false }),
    rhythm(`${year}-vbs`, 'Vacation Bible School', vbsMonday, 'class', { location: 'Kids Wing', description: 'Mon–Thu · preschool through 5th grade' }),
    rhythm(`${year}-youth-camp`, 'Youth Summer Camp', nthWeekdayOfMonth(year, 7, 1, 3), 'event', { description: 'Middle & high school retreat week' }),
    rhythm(`${year}-back-to-church`, 'Back to Church Sunday', backToChurch, 'event', { location: 'Main Sanctuary', description: 'Invite emphasis & guest hospitality' }),
    rhythm(`${year}-membership`, 'Membership Class', nthWeekdayOfMonth(year, 9, 6, 1), 'class', { location: 'Room 105', hour: 9, allDay: false }),
    rhythm(`${year}-fall-fest`, 'Fall Festival / Trunk or Treat', nthWeekdayOfMonth(year, 10, 5, 4), 'outreach', { location: 'Parking Lot', hour: 17, allDay: false }),
    rhythm(`${year}-stewardship`, 'Stewardship Sunday', stewardshipSunday, 'ceremony', { description: 'Annual giving emphasis & gratitude testimonies' }),
    rhythm(`${year}-harvest`, 'Harvest Giving Drive', new Date(year, 9, 1), 'event', { description: 'Oct–Nov shelter support & Thanksgiving baskets' }),
    rhythm(`${year}-christmas-blessing`, 'Christmas Blessing Drive', new Date(year, 11, 1), 'event', { description: 'Family hampers, toy drives, community dinners' }),
    rhythm(`${year}-ascension`, 'Ascension Sunday', ascension, 'holiday', { location: 'Main Sanctuary' }),
    rhythm(`${year}-pentecost`, 'Pentecost Sunday', pentecost, 'holiday', { location: 'Main Sanctuary' }),
  ];
}

/** Merge staged CRM events with seasonal rhythm for dashboard / home calendar. */
export function mergeCalendarWithRhythm(events: CalendarEvent[], years: number[]): CalendarEvent[] {
  const rhythm = years.flatMap(buildChurchRhythmEvents);
  const seen = new Set(events.map(e => e.id));
  const merged = [...events];
  for (const r of rhythm) {
    if (!seen.has(r.id)) merged.push(r);
  }
  return merged;
}
