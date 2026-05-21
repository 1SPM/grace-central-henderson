import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { IconName } from './Icon';
import type { GraceData } from './useGraceData';

export interface CarePerson { id: string; name: string; initials: string; reason: string; }
export interface ActivityItem { id: string; icon: IconName; tone: string; text: string; when: string; }
export interface UpcomingEvent { id: string; title: string; day: string; date: string; time: string; location: string; }
export interface WeekBar { label: string; count: number; }

export interface DashboardData {
  churchName: string;
  activeMembers: number;
  totalMembers: number;
  visitors: number;
  prayersOpen: number;
  groups: number;
  newThisMonth: number;
  needsCare: CarePerson[];
  needsCareTotal: number;
  recentActivity: ActivityItem[];
  upcoming: UpcomingEvent[];
  attendanceWeeks: WeekBar[];
  attendanceInWindow: number;
  lastAttendanceLabel: string | null;
  lastEventLabel: string | null;
}

const INTERACTION_ICON: Record<string, { icon: IconName; tone: string }> = {
  note: { icon: 'book', tone: 'indigo' },
  call: { icon: 'phone', tone: 'sky' },
  email: { icon: 'mail', tone: 'rose' },
  visit: { icon: 'user', tone: 'emerald' },
  text: { icon: 'chat', tone: 'amber' },
  prayer: { icon: 'pray', tone: 'violet' },
};

function initialsOf(first: string, last: string): string {
  return `${(first || '?')[0]}${(last || '')[0] || ''}`.toUpperCase();
}

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

const VERB: Record<string, string> = { note: 'Note on', call: 'Called', email: 'Emailed', visit: 'Visited', text: 'Texted', prayer: 'Prayer with' };

/* Derive the dashboard view-model from the shared GraceData (used by the
   in-app, authed path; the anon hook below builds the same shape itself). */
export function dashboardFromGraceData(data: GraceData): DashboardData {
  const people = data.people;
  const nameById = new Map(people.map(p => [p.id, p.name]));
  const activeMembers = people.filter(p => p.status !== 'inactive').length;
  const visitors = people.filter(p => p.status === 'visitor').length;
  const inactive = people.filter(p => p.status === 'inactive');
  const thirtyAgo = Date.now() - 30 * 86_400_000;
  const newThisMonth = people.filter(p => { const d = p.joinDate || p.createdAt; return d ? new Date(d).getTime() >= thirtyAgo : false; }).length;

  const needsCare: CarePerson[] = inactive.slice(0, 3).map(p => ({ id: p.id, name: p.name, initials: p.initials, reason: 'Inactive' }));

  const recentActivity: ActivityItem[] = data.interactions.slice(0, 6).map(i => {
    const meta = INTERACTION_ICON[i.type] ?? { icon: 'book' as IconName, tone: 'indigo' };
    return { id: i.id, icon: meta.icon, tone: meta.tone, text: `${VERB[i.type] || 'Logged'} ${nameById.get(i.personId) || 'someone'}`, when: relativeTime(i.createdAt) };
  });

  const now = Date.now();
  const upcoming: UpcomingEvent[] = data.events
    .filter(e => new Date(e.startDate).getTime() >= now)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 5)
    .map(e => { const d = new Date(e.startDate); return { id: e.id, title: e.title, day: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(), date: String(d.getDate()), time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }), location: e.location || '' }; });

  const weeks: WeekBar[] = [];
  for (let w = 7; w >= 0; w--) {
    const start = now - (w + 1) * 7 * 86_400_000;
    const end = now - w * 7 * 86_400_000;
    const count = data.attendance.filter(a => { const t = new Date(a.date).getTime(); return t >= start && t < end; }).length;
    weeks.push({ label: w === 0 ? 'now' : `${w}w`, count });
  }
  const attendanceInWindow = weeks.reduce((s, w) => s + w.count, 0);

  const attDates = data.attendance.map(a => new Date(a.date).getTime()).filter(n => !isNaN(n));
  const lastAttendanceLabel = attDates.length ? new Date(Math.max(...attDates)).toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : null;

  let lastEventLabel: string | null = null;
  if (upcoming.length === 0) {
    const pastDates = data.events.map(e => new Date(e.startDate).getTime()).filter(t => t < now);
    if (pastDates.length) lastEventLabel = new Date(Math.max(...pastDates)).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  }

  return {
    churchName: data.churchName,
    activeMembers, totalMembers: people.length, visitors,
    prayersOpen: data.prayersOpen, groups: data.groups.length, newThisMonth,
    needsCare, needsCareTotal: inactive.length,
    recentActivity, upcoming, attendanceWeeks: weeks, attendanceInWindow,
    lastAttendanceLabel, lastEventLabel,
  };
}

interface PersonRow { id: string; first_name: string; last_name: string; status: string; join_date: string | null; created_at: string | null; }

export function useRedesignDashboard(): { data: DashboardData | null; status: 'loading' | 'ready' | 'error' } {
  const [data, setData] = useState<DashboardData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) { setStatus('error'); return; }
      try {
        const nowIso = new Date().toISOString();
        const [churchRes, peopleRes, prayersRes, eventsRes, interactionsRes, attendanceRes, groupsRes] = await Promise.all([
          supabase.from('churches').select('settings').limit(1).single(),
          supabase.from('people').select('id, first_name, last_name, status, join_date, created_at'),
          supabase.from('prayer_requests').select('id', { count: 'exact', head: true }).eq('is_answered', false),
          supabase.from('calendar_events').select('id, title, start_date, location').gte('start_date', nowIso).order('start_date').limit(5),
          supabase.from('interactions').select('id, type, content, created_at, person_id').order('created_at', { ascending: false }).limit(6),
          supabase.from('attendance').select('date').order('date', { ascending: false }),
          supabase.from('small_groups').select('id', { count: 'exact', head: true }),
        ]);

        const people = (peopleRes.data ?? []) as PersonRow[];
        const peopleById = new Map(people.map(p => [p.id, p]));

        const activeMembers = people.filter(p => p.status !== 'inactive').length;
        const visitors = people.filter(p => p.status === 'visitor').length;
        const inactive = people.filter(p => p.status === 'inactive');
        const thirtyAgo = Date.now() - 30 * 86_400_000;
        const newThisMonth = people.filter(p => {
          const d = p.join_date || p.created_at;
          return d ? new Date(d).getTime() >= thirtyAgo : false;
        }).length;

        const needsCare: CarePerson[] = inactive.slice(0, 3).map(p => ({
          id: p.id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          initials: initialsOf(p.first_name, p.last_name),
          reason: 'Inactive',
        }));

        const recentActivity: ActivityItem[] = (interactionsRes.data ?? []).map((i: { id: string; type: string; content: string; created_at: string; person_id: string }) => {
          const meta = INTERACTION_ICON[i.type] ?? { icon: 'book' as IconName, tone: 'indigo' };
          const person = peopleById.get(i.person_id);
          const name = person ? `${person.first_name} ${person.last_name}`.trim() : 'someone';
          const verb = { note: 'Note on', call: 'Called', email: 'Emailed', visit: 'Visited', text: 'Texted', prayer: 'Prayer with' }[i.type] || 'Logged';
          return { id: i.id, icon: meta.icon, tone: meta.tone, text: `${verb} ${name}`, when: relativeTime(i.created_at) };
        });

        const upcoming: UpcomingEvent[] = (eventsRes.data ?? []).map((e: { id: string; title: string; start_date: string; location: string | null }) => {
          const d = new Date(e.start_date);
          return {
            id: e.id,
            title: e.title,
            day: d.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase(),
            date: String(d.getDate()),
            time: d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            location: e.location || '',
          };
        });

        // attendance bucketed into last 8 weeks
        const weeks: WeekBar[] = [];
        for (let w = 7; w >= 0; w--) {
          const start = Date.now() - (w + 1) * 7 * 86_400_000;
          const end = Date.now() - w * 7 * 86_400_000;
          const count = (attendanceRes.data ?? []).filter((a: { date: string }) => {
            const t = new Date(a.date).getTime();
            return t >= start && t < end;
          }).length;
          weeks.push({ label: w === 0 ? 'now' : `${w}w`, count });
        }
        const attendanceInWindow = weeks.reduce((s, w) => s + w.count, 0);
        const attendanceRows = (attendanceRes.data ?? []) as { date: string }[];
        const lastAttendanceLabel = attendanceRows.length
          ? new Date(attendanceRows[0].date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
          : null;

        // last past event label (for empty upcoming state)
        let lastEventLabel: string | null = null;
        if (upcoming.length === 0) {
          const lastRes = await supabase.from('calendar_events').select('start_date').lt('start_date', nowIso).order('start_date', { ascending: false }).limit(1).single();
          if (lastRes.data?.start_date) {
            lastEventLabel = new Date(lastRes.data.start_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
          }
        }

        const settings = (churchRes.data?.settings ?? {}) as Record<string, unknown>;
        const profile = (settings.profile ?? {}) as Record<string, unknown>;
        const churchName = typeof profile.name === 'string' && profile.name ? profile.name : 'Your Church';

        if (cancelled) return;
        setData({
          churchName,
          activeMembers,
          totalMembers: people.length,
          visitors,
          prayersOpen: prayersRes.count ?? 0,
          groups: groupsRes.count ?? 0,
          newThisMonth,
          needsCare,
          needsCareTotal: inactive.length,
          recentActivity,
          upcoming,
          attendanceWeeks: weeks,
          attendanceInWindow,
          lastAttendanceLabel,
          lastEventLabel,
        });
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('error');
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  return { data, status };
}
