import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

    let events: CalendarEvent[] = [];

    if (supabaseUrl && supabaseKey) {
      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data, error } = await supabase
        .from('calendar_events')
        .select('id, title, description, start_date, end_date, all_day, location, category')
        .eq('church_id', churchId)
        .gte('start_date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .order('start_date', { ascending: true });

      if (!error && data) {
        events = data.map(e => ({
          id: e.id,
          title: e.title,
          description: e.description || undefined,
          startDate: e.start_date,
          endDate: e.end_date || undefined,
          location: e.location || undefined,
          allDay: e.all_day || false,
          category: e.category || undefined,
        }));
      }
    }

    const ical = buildIcal(
      events,
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

