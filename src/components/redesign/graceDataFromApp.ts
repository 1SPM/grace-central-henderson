/* Adapts the live, church-scoped app data (legacy types from useSupabaseData)
   into the redesign's GraceData shape, so the redesign screens render real
   authed data instead of the anon preview fetch. */
import type { Person, Interaction, SmallGroup, PrayerRequest, CalendarEvent, Giving, Attendance } from '../../types';
import type { GraceData, GPerson } from './useGraceData';

function initials(f: string, l: string) { return `${(f || '?')[0]}${(l || '')[0] || ''}`.toUpperCase(); }

export function graceDataFromApp(input: {
  people: Person[];
  interactions: Interaction[];
  groups: SmallGroup[];
  prayers: PrayerRequest[];
  events: CalendarEvent[];
  giving: Giving[];
  attendance: Attendance[];
  churchName?: string;
}): GraceData {
  const groupNameById = new Map(input.groups.map(g => [g.id, g.name]));

  const people: GPerson[] = input.people.map(p => ({
    id: p.id,
    firstName: p.firstName,
    lastName: p.lastName,
    name: `${p.firstName} ${p.lastName}`.trim(),
    initials: initials(p.firstName, p.lastName),
    email: p.email || '',
    phone: p.phone || '',
    status: p.status,
    joinDate: p.joinDate ?? null,
    createdAt: p.joinDate ?? null,
    groups: (p.smallGroups ?? []).map(id => groupNameById.get(id)).filter((n): n is string => !!n),
  }));

  return {
    churchName: input.churchName || 'Your Church',
    people,
    interactions: input.interactions.map(i => ({ id: i.id, personId: i.personId, type: i.type, content: i.content, createdAt: i.createdAt })),
    groups: input.groups.map(g => ({ id: g.id, name: g.name, memberCount: g.members?.length ?? 0 })),
    attendance: input.attendance.map(a => ({ id: a.id, personId: a.personId, eventType: a.eventType, date: a.date })),
    giving: input.giving.map(g => ({ id: g.id, amount: Number(g.amount), fund: g.fund, date: g.date })),
    events: input.events.map(e => ({ id: e.id, title: e.title, startDate: e.startDate, location: e.location ?? null })),
    prayersOpen: input.prayers.filter(p => !p.isAnswered).length,
    scheduledCount: 0,
    archiveCount: 0,
  };
}
