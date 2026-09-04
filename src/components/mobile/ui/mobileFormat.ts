import type { Person } from '../../../types';
import { parseDateFlexible } from '../../../utils/validation';

export function shortName(person: Person): string {
  return `${person.firstName} ${person.lastName}`.trim() || 'Unnamed person';
}

export function initials(person: Person): string {
  return `${person.firstName?.[0] || ''}${person.lastName?.[0] || ''}`.toUpperCase() || '?';
}

export function relativeDate(value?: string): string {
  if (!value) return 'No due date';
  const date = parseDateFlexible(value);
  if (Number.isNaN(date.getTime())) return 'No due date';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / 86400000);
  if (diff < 0) return diff === -1 ? 'Due yesterday' : `Overdue by ${-diff} days`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
}

/** "2 days ago" style label for how long something has waited. */
export function agoLabel(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return '1 day ago';
  return `${days} days ago`;
}

/** "Sun, Sep 6 · 10:00 AM" for an event start. */
export function eventDateLabel(startDate: string, allDay?: boolean): string {
  const date = new Date(startDate);
  if (Number.isNaN(date.getTime())) return 'Time to be confirmed';
  const day = date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  if (allDay) return day;
  const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}
