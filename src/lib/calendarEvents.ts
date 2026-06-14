import type { CalendarEvent } from '../types';

export type DayAgendaEvent = {
  id: string;
  title: string;
  time: string;
  startDate: string;
  category: CalendarEvent['category'];
  allDay: boolean;
  location?: string;
};

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
      id: e.id,
      title: e.title,
      time: e.allDay ? 'All day' : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      startDate: e.startDate,
      category: e.category,
      allDay: e.allDay,
      location: e.location,
    });
  }

  return { eventDays, eventsByDay };
}
