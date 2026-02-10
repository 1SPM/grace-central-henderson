import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * iCal Calendar Export API
 *
 * Generates an .ics file that can be subscribed to in Google Calendar,
 * Apple Calendar, Outlook, etc.
 *
 * Usage: GET /api/calendar/ical?churchId=xxx
 */

interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  allDay?: boolean;
  category?: string;
}

// Escape special characters for iCal format
function escapeIcal(str: string): string {
  if (!str) return '';
  return str
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

// Format date for iCal (YYYYMMDDTHHMMSSZ for UTC)
function formatIcalDate(dateStr: string, allDay?: boolean): string {
  const date = new Date(dateStr);
  if (allDay) {
    // All-day events use VALUE=DATE format (YYYYMMDD)
    return date.toISOString().slice(0, 10).replace(/-/g, '');
  }
  // Timed events use UTC format
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// Generate a unique ID for the event
function generateUid(eventId: string, churchId: string): string {
  return `${eventId}@${churchId}.grace-crm.com`;
}

// Build iCal file content
function buildIcal(events: CalendarEvent[], churchName: string, churchId: string): string {
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  let ical = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Grace CRM//Church Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcal(churchName)} Calendar`,
    `X-WR-CALDESC:Events from ${escapeIcal(churchName)}`,
  ].join('\r\n');

  for (const event of events) {
    const startDate = formatIcalDate(event.startDate, event.allDay);
    const endDate = event.endDate
      ? formatIcalDate(event.endDate, event.allDay)
      : formatIcalDate(
          new Date(new Date(event.startDate).getTime() + 60 * 60 * 1000).toISOString(),
          event.allDay
        ); // Default 1 hour

    const vevent = [
      '',
      'BEGIN:VEVENT',
      `UID:${generateUid(event.id, churchId)}`,
      `DTSTAMP:${now}`,
      event.allDay ? `DTSTART;VALUE=DATE:${startDate}` : `DTSTART:${startDate}`,
      event.allDay ? `DTEND;VALUE=DATE:${endDate}` : `DTEND:${endDate}`,
      `SUMMARY:${escapeIcal(event.title)}`,
    ];

    if (event.description) {
      vevent.push(`DESCRIPTION:${escapeIcal(event.description)}`);
    }
    if (event.location) {
      vevent.push(`LOCATION:${escapeIcal(event.location)}`);
    }
    if (event.category) {
      vevent.push(`CATEGORIES:${escapeIcal(event.category)}`);
    }

    vevent.push('END:VEVENT');
    ical += vevent.join('\r\n');
  }

  ical += '\r\nEND:VCALENDAR';
  return ical;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { churchId, churchName = 'Grace Church' } = req.query;

  if (!churchId || typeof churchId !== 'string') {
    return res.status(400).json({ error: 'churchId is required' });
  }

  try {
    // In production, this would fetch events from the database
    // For now, return sample events or empty calendar
    const sampleEvents: CalendarEvent[] = [
      {
        id: 'sunday-service',
        title: 'Sunday Service',
        description: 'Weekly worship service',
        startDate: getNextSunday(10, 0), // 10:00 AM
        endDate: getNextSunday(12, 0), // 12:00 PM
        location: 'Main Sanctuary',
        category: 'service',
      },
      {
        id: 'wednesday-prayer',
        title: 'Wednesday Prayer',
        description: 'Midweek prayer meeting',
        startDate: getNextWednesday(19, 0), // 7:00 PM
        endDate: getNextWednesday(20, 30), // 8:30 PM
        location: 'Fellowship Hall',
        category: 'prayer',
      },
    ];

    const ical = buildIcal(
      sampleEvents,
      typeof churchName === 'string' ? churchName : 'Grace Church',
      churchId
    );

    // Set headers for .ics file
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${churchId}-calendar.ics"`);
    res.setHeader('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour

    return res.status(200).send(ical);
  } catch (error) {
    console.error('iCal generation error:', error);
    return res.status(500).json({ error: 'Failed to generate calendar' });
  }
}

// Helper functions to get next occurrence of a day
function getNextSunday(hour: number, minute: number): string {
  const today = new Date();
  const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + daysUntilSunday);
  nextSunday.setHours(hour, minute, 0, 0);
  return nextSunday.toISOString();
}

function getNextWednesday(hour: number, minute: number): string {
  const today = new Date();
  const daysUntilWednesday = (3 - today.getDay() + 7) % 7 || 7;
  const nextWednesday = new Date(today);
  nextWednesday.setDate(today.getDate() + daysUntilWednesday);
  nextWednesday.setHours(hour, minute, 0, 0);
  return nextWednesday.toISOString();
}
