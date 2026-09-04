/**
 * The dashboard hero's "Next:" must name a staged calendar event or nothing.
 *
 * buildDashboardCalendarIndex merges seasonal rhythm into the calendar
 * widget (holidays, milestones, weekly services, a synthetic "Membership
 * Class") — honest under the widget's legend, dishonest as a headline. On
 * the live tenant, with zero future rows in calendar_events, the hero read
 * "Next: Membership Class — Sat, Sep 5 · 9:00 AM" while GRACE said nothing
 * was scheduled (2026-09-04 browser rehearsal). These pin the split.
 */
import { describe, it, expect } from 'vitest';
import { buildCalendarIndex, buildDashboardCalendarIndex, calendarDayKey } from './calendarEvents';
import { findNextEventLabel, buildHeroSubline } from './dashboardSummary';
import type { CalendarEvent } from '../types';

const TODAY = new Date(2026, 8, 4); // Fri Sep 4 2026, a first-Saturday-of-September eve
const todayKey = calendarDayKey(TODAY);

describe('the hero "Next:" line', () => {
  it('the merged widget index invents a next event for an empty calendar — which is why the hero must not read it', () => {
    const merged = buildDashboardCalendarIndex([], 2026);
    expect(findNextEventLabel(merged.eventsByDay, todayKey)).toMatch(/Membership Class/);
  });

  it('with no staged events there is no "Next:" at all', () => {
    const real = buildCalendarIndex([]);
    const next = findNextEventLabel(real.eventsByDay, todayKey);
    expect(next).toBeNull();
    expect(buildHeroSubline(4, next)).toBe('4 areas need attention');
  });

  it('a staged event is named, with its day and time', () => {
    const staged: CalendarEvent[] = [{
      id: 'evt-1', title: 'Leadership Retreat', startDate: '2026-09-12T09:00:00', allDay: false, category: 'event',
    } as CalendarEvent];
    const real = buildCalendarIndex(staged);
    const next = findNextEventLabel(real.eventsByDay, todayKey);
    expect(next).toMatch(/^Leadership Retreat — Sat, Sep 12 · /);
    expect(buildHeroSubline(0, next)).toBe(`All clear for today · Next: ${next}`);
  });
});
