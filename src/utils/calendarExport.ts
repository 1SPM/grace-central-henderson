/**
 * Calendar Export Utilities
 * Export calendar events to iCal format for Google Calendar, Outlook, Apple Calendar
 */

import type { CalendarEvent, RecurrenceType } from '../types';

// Convert RecurrenceType to iCal RRULE
function getRecurrenceRule(recurrence: RecurrenceType, endDate?: string): string | null {
  if (!recurrence || recurrence === 'none') return null;

  const rules: Record<string, string> = {
    daily: 'FREQ=DAILY',
    weekly: 'FREQ=WEEKLY',
    biweekly: 'FREQ=WEEKLY;INTERVAL=2',
    monthly: 'FREQ=MONTHLY',
    quarterly: 'FREQ=MONTHLY;INTERVAL=3',
  };

  let rule = rules[recurrence];
  if (!rule) return null;

  if (endDate) {
    const end = new Date(endDate);
    const endStr = formatICalDate(end, true);
    rule += `;UNTIL=${endStr}`;
  }

  return rule;
}

// Format date for iCal (YYYYMMDD for all-day, YYYYMMDDTHHMMSS for timed)
function formatICalDate(date: Date, allDay: boolean = false): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');

  if (allDay) {
    return `${year}${month}${day}`;
  }

  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

// Escape special characters in iCal text
function escapeICalText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Fold long lines per iCal spec (max 75 characters)
function foldLine(line: string): string {
  const maxLength = 75;
  if (line.length <= maxLength) return line;

  const lines: string[] = [];
  let remaining = line;

  while (remaining.length > maxLength) {
    lines.push(remaining.substring(0, maxLength));
    remaining = ' ' + remaining.substring(maxLength);
  }
  lines.push(remaining);

  return lines.join('\r\n');
}

// Generate a unique ID for an event
function generateUID(event: CalendarEvent, churchName: string): string {
  const sanitizedName = churchName.toLowerCase().replace(/[^a-z0-9]/g, '');
  return `${event.id}@${sanitizedName}.gracecrm`;
}

// Convert a single event to iCal VEVENT format
function eventToVEvent(event: CalendarEvent, churchName: string): string {
  const lines: string[] = [];
  const startDate = new Date(event.startDate);
  const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 60 * 60 * 1000); // Default 1 hour

  lines.push('BEGIN:VEVENT');
  lines.push(`UID:${generateUID(event, churchName)}`);
  lines.push(`DTSTAMP:${formatICalDate(new Date())}`);

  if (event.allDay) {
    lines.push(`DTSTART;VALUE=DATE:${formatICalDate(startDate, true)}`);
    // For all-day events, end date is exclusive
    const nextDay = new Date(endDate);
    nextDay.setDate(nextDay.getDate() + 1);
    lines.push(`DTEND;VALUE=DATE:${formatICalDate(nextDay, true)}`);
  } else {
    lines.push(`DTSTART:${formatICalDate(startDate)}`);
    lines.push(`DTEND:${formatICalDate(endDate)}`);
  }

  lines.push(`SUMMARY:${escapeICalText(event.title)}`);

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICalText(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICalText(event.location)}`);
  }

  // Add recurrence rule if applicable
  const rrule = getRecurrenceRule(event.recurrence || 'none', event.recurrenceEndDate);
  if (rrule) {
    lines.push(`RRULE:${rrule}`);
  }

  // Add category
  const categoryMap: Record<string, string> = {
    service: 'CHURCH SERVICE',
    meeting: 'MEETING',
    event: 'EVENT',
    'small-group': 'SMALL GROUP',
    holiday: 'HOLIDAY',
    other: 'OTHER',
  };
  lines.push(`CATEGORIES:${categoryMap[event.category] || 'EVENT'}`);

  lines.push('END:VEVENT');

  return lines.map(foldLine).join('\r\n');
}

// Generate complete iCal file content
export function generateICalFile(
  events: CalendarEvent[],
  churchName: string,
  calendarName?: string
): string {
  const lines: string[] = [];

  // Calendar header
  lines.push('BEGIN:VCALENDAR');
  lines.push('VERSION:2.0');
  lines.push('PRODID:-//Grace CRM//Church Calendar//EN');
  lines.push('CALSCALE:GREGORIAN');
  lines.push('METHOD:PUBLISH');
  lines.push(`X-WR-CALNAME:${escapeICalText(calendarName || `${churchName} Calendar`)}`);

  // Add each event
  for (const event of events) {
    lines.push(eventToVEvent(event, churchName));
  }

  // Calendar footer
  lines.push('END:VCALENDAR');

  return lines.join('\r\n');
}

// Download iCal file
export function downloadICalFile(
  events: CalendarEvent[],
  churchName: string,
  filename?: string
): void {
  const content = generateICalFile(events, churchName);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `${churchName.toLowerCase().replace(/\s+/g, '-')}-calendar.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

// Generate webcal:// URL for subscription (requires hosting the .ics file)
export function generateWebcalUrl(baseUrl: string): string {
  return baseUrl.replace(/^https?:\/\//, 'webcal://');
}

// Generate Google Calendar add URL for a single event
export function generateGoogleCalendarUrl(event: CalendarEvent): string {
  const startDate = new Date(event.startDate);
  const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 60 * 60 * 1000);

  const params = new URLSearchParams();
  params.set('action', 'TEMPLATE');
  params.set('text', event.title);

  if (event.allDay) {
    const format = (d: Date) => d.toISOString().split('T')[0].replace(/-/g, '');
    params.set('dates', `${format(startDate)}/${format(endDate)}`);
  } else {
    const format = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    params.set('dates', `${format(startDate)}/${format(endDate)}`);
  }

  if (event.description) {
    params.set('details', event.description);
  }

  if (event.location) {
    params.set('location', event.location);
  }

  // Add recurrence if applicable
  if (event.recurrence && event.recurrence !== 'none') {
    const rrule = getRecurrenceRule(event.recurrence, event.recurrenceEndDate);
    if (rrule) {
      params.set('recur', `RRULE:${rrule}`);
    }
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

// Generate Outlook.com add URL for a single event
export function generateOutlookUrl(event: CalendarEvent): string {
  const startDate = new Date(event.startDate);
  const endDate = event.endDate ? new Date(event.endDate) : new Date(startDate.getTime() + 60 * 60 * 1000);

  const params = new URLSearchParams();
  params.set('path', '/calendar/action/compose');
  params.set('rru', 'addevent');
  params.set('subject', event.title);
  params.set('startdt', startDate.toISOString());
  params.set('enddt', endDate.toISOString());
  params.set('allday', event.allDay ? 'true' : 'false');

  if (event.description) {
    params.set('body', event.description);
  }

  if (event.location) {
    params.set('location', event.location);
  }

  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}
