import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

export interface GPerson {
  id: string; firstName: string; lastName: string; name: string; initials: string;
  email: string; phone: string; status: string; joinDate: string | null; createdAt: string | null;
  groups: string[];
}
export interface GInteraction { id: string; personId: string; type: string; content: string; createdAt: string; }
export interface GGroup { id: string; name: string; memberCount: number; }
export interface GAttendance { id: string; personId: string; eventType: string; date: string; }
export interface GGiving { id: string; amount: number; fund: string; date: string; }
export interface GEvent { id: string; title: string; startDate: string; location: string | null; }

export interface GraceData {
  churchName: string;
  people: GPerson[];
  interactions: GInteraction[];
  groups: GGroup[];
  attendance: GAttendance[];
  giving: GGiving[];
  events: GEvent[];
  prayersOpen: number;
  scheduledCount: number;
  archiveCount: number;
}

function initials(f: string, l: string) { return `${(f || '?')[0]}${(l || '')[0] || ''}`.toUpperCase(); }

export function useGraceData(): { data: GraceData | null; status: 'loading' | 'ready' | 'error' } {
  const [data, setData] = useState<GraceData | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) { setStatus('error'); return; }
      try {
        const [churchRes, peopleRes, interRes, groupsRes, membRes, attRes, givRes, evRes, prayerRes, schedRes, archRes] = await Promise.all([
          supabase.from('churches').select('settings').limit(1).single(),
          supabase.from('people').select('id, first_name, last_name, email, phone, status, join_date, created_at').order('last_name'),
          supabase.from('interactions').select('id, person_id, type, content, created_at').order('created_at', { ascending: false }),
          supabase.from('small_groups').select('id, name'),
          supabase.from('group_memberships').select('group_id, person_id'),
          supabase.from('attendance').select('id, person_id, event_type, date').order('date', { ascending: false }),
          supabase.from('giving').select('id, amount, fund, date').order('date', { ascending: false }),
          supabase.from('calendar_events').select('id, title, start_date, location').order('start_date', { ascending: false }),
          supabase.from('prayer_requests').select('id', { count: 'exact', head: true }).eq('is_answered', false),
          supabase.from('scheduled_messages').select('id', { count: 'exact', head: true }),
          supabase.from('message_archive').select('id', { count: 'exact', head: true }),
        ]);

        const memberships = (membRes.data ?? []) as { group_id: string; person_id: string }[];
        const groupNameById = new Map((groupsRes.data ?? []).map((g: { id: string; name: string }) => [g.id, g.name]));
        const groupsByPerson = new Map<string, string[]>();
        const countByGroup = new Map<string, number>();
        for (const m of memberships) {
          countByGroup.set(m.group_id, (countByGroup.get(m.group_id) ?? 0) + 1);
          const gname = groupNameById.get(m.group_id);
          if (gname) groupsByPerson.set(m.person_id, [...(groupsByPerson.get(m.person_id) ?? []), gname]);
        }

        const people: GPerson[] = (peopleRes.data ?? []).map((p: { id: string; first_name: string; last_name: string; email: string; phone: string; status: string; join_date: string | null; created_at: string | null }) => ({
          id: p.id, firstName: p.first_name, lastName: p.last_name,
          name: `${p.first_name} ${p.last_name}`.trim(), initials: initials(p.first_name, p.last_name),
          email: p.email || '', phone: p.phone || '', status: p.status, joinDate: p.join_date, createdAt: p.created_at,
          groups: groupsByPerson.get(p.id) ?? [],
        }));

        const settings = (churchRes.data?.settings ?? {}) as Record<string, unknown>;
        const profile = (settings.profile ?? {}) as Record<string, unknown>;
        const churchName = typeof profile.name === 'string' && profile.name ? profile.name : 'Your Church';

        if (cancelled) return;
        setData({
          churchName,
          people,
          interactions: (interRes.data ?? []).map((i: { id: string; person_id: string; type: string; content: string; created_at: string }) => ({ id: i.id, personId: i.person_id, type: i.type, content: i.content, createdAt: i.created_at })),
          groups: (groupsRes.data ?? []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name, memberCount: countByGroup.get(g.id) ?? 0 })),
          attendance: (attRes.data ?? []).map((a: { id: string; person_id: string; event_type: string; date: string }) => ({ id: a.id, personId: a.person_id, eventType: a.event_type, date: a.date })),
          giving: (givRes.data ?? []).map((g: { id: string; amount: number; fund: string; date: string }) => ({ id: g.id, amount: Number(g.amount), fund: g.fund, date: g.date })),
          events: (evRes.data ?? []).map((e: { id: string; title: string; start_date: string; location: string | null }) => ({ id: e.id, title: e.title, startDate: e.start_date, location: e.location })),
          prayersOpen: prayerRes.count ?? 0,
          scheduledCount: schedRes.count ?? 0,
          archiveCount: archRes.count ?? 0,
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
