import type { CalendarEvent } from '../types';

export type DayAgendaEvent = { title: string; time: string };

export function calendarDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function buildCalendarIndex(events: CalendarEvent[]): {
  eventDays: string[];
  eventsByDay: Record<string, DayAgendaEvent[]>;
} {
  const eventsByDay: Record<string, DayAgendaEvent[]> = {};
  const eventDays: string[] = [];

  for (const e of events) {
    const d = new Date(e.startDate);
    if (Number.isNaN(d.getTime())) continue;
    const k = calendarDayKey(d);
    if (!eventsByDay[k]) eventDays.push(k);
    (eventsByDay[k] ??= []).push({
      title: e.title,
      time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    });
  }

  return { eventDays, eventsByDay };
}
