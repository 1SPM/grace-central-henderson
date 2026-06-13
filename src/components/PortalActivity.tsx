/**
 * Portal Activity — the admin CRM's window into the member portal.
 *
 * Reads the member_activity_events tracking spine: logins, RSVPs,
 * check-ins, gifts, prayer requests, care messages, and (Phase C)
 * Impact Card events — per member and as a live feed.
 */

import { useMemo, useState } from 'react';
import {
  Activity,
  Smartphone,
  Users,
  CalendarCheck,
  DollarSign,
  HeartHandshake,
  LogIn,
  QrCode,
  RefreshCw,
  CreditCard,
  Heart,
  Eye,
  MessageCircle,
  Users,
} from 'lucide-react';
import { usePortalActivity } from '../hooks/usePortalActivity';
import type { MemberActivityEvent } from '../lib/database.types';
import type { Person, SmallGroup } from '../types';

interface PortalActivityProps {
  churchId: string;
  people: Person[];
  groups?: SmallGroup[];
  onViewPerson?: (id: string) => void;
}

const EVENT_META: Record<string, { label: string; icon: typeof LogIn; color: string; bg: string }> = {
  login: { label: 'Portal login', icon: LogIn, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' },
  rsvp: { label: 'Event RSVP', icon: CalendarCheck, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/10' },
  checkin: { label: 'Check-in', icon: QrCode, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-500/10' },
  gift: { label: 'Gift given', icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
  prayer: { label: 'Prayer request', icon: Heart, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-500/10' },
  care_message: { label: 'Care message', icon: HeartHandshake, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' },
  help_request: { label: 'Help request', icon: HeartHandshake, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' },
  directory_view: { label: 'Directory view', icon: Eye, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-dark-700' },
  announcement_view: { label: 'Announcement view', icon: Eye, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-dark-700' },
  kyc_submitted: { label: 'KYC submitted', icon: CreditCard, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-500/10' },
  card_issued: { label: 'Impact Card issued', icon: CreditCard, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/10' },
  card_frozen: { label: 'Card frozen', icon: CreditCard, color: 'text-cyan-600 dark:text-cyan-400', bg: 'bg-cyan-100 dark:bg-cyan-500/10' },
  card_txn: { label: 'Card transaction', icon: CreditCard, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/10' },
  community_post: { label: 'Community post', icon: MessageCircle, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-500/10' },
  group_post: { label: 'Group post', icon: Users, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-500/10' },
  community_react: { label: 'Community reaction', icon: Heart, color: 'text-pink-600 dark:text-pink-400', bg: 'bg-pink-100 dark:bg-pink-500/10' },
  community_comment: { label: 'Community comment', icon: MessageCircle, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-500/10' },
  connection_request: { label: 'Connection request', icon: Users, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-500/10' },
  connection_accept: { label: 'Connection accepted', icon: Users, color: 'text-teal-600 dark:text-teal-400', bg: 'bg-teal-100 dark:bg-teal-500/10' },
  community_view: { label: 'Community view', icon: Eye, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-100 dark:bg-dark-700' },
};

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function describeEvent(e: MemberActivityEvent, personName: string | undefined): string {
  const name = personName ?? 'A member';
  switch (e.event_type) {
    case 'login': return `${name} signed in to the portal`;
    case 'rsvp': return `${name} RSVP'd ${String(e.metadata?.status ?? '')}`.trim();
    case 'checkin': return `${name} checked in${e.metadata?.event_name ? ` to ${e.metadata.event_name}` : ''}`;
    case 'gift': return `${name} gave $${Number(e.metadata?.amount ?? 0).toFixed(2)}${e.metadata?.fund ? ` to ${e.metadata.fund}` : ''}`;
    case 'prayer': return `${name} submitted a prayer request`;
    case 'care_message': return `${name} sent a care message`;
    case 'help_request': return `${name} requested pastoral help (${String(e.metadata?.category ?? 'general')})`;
    case 'kyc_submitted': return `${name} applied for a GRACE Impact Card`;
    case 'card_issued': return `${name} was issued a GRACE Impact Card`;
    case 'card_frozen': return `${name} froze their Impact Card`;
    case 'card_txn': return `${name} made a card transaction`;
    case 'community_post': return `${name} posted to the community (${String(e.metadata?.post_type ?? 'post')})`;
    case 'group_post': return `${name} posted to a group (${String(e.metadata?.post_type ?? 'post')})`;
    case 'community_react': return `${name} reacted ${String(e.metadata?.reaction_type ?? '')} to a post`.trim();
    case 'community_comment': return `${name} commented on a community post`;
    case 'connection_request': return `${name} sent a connection request`;
    case 'connection_accept': return `${name} accepted a connection`;
    default: return `${name} — ${e.event_type}`;
  }
}

export function PortalActivity({ churchId, people, groups = [], onViewPerson }: PortalActivityProps) {
  const { events, summary, memberRollup, isLoading, isDemo, reload } = usePortalActivity(churchId);
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');

  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  const filteredEvents = useMemo(() => {
    let list = typeFilter === 'all' ? events : events.filter(e => e.event_type === typeFilter);
    if (groupFilter !== 'all') {
      list = list.filter(e => String(e.metadata?.group_id ?? '') === groupFilter);
    }
    return list;
  }, [events, typeFilter, groupFilter]);

  const presentTypes = useMemo(
    () => Array.from(new Set(events.map(e => e.event_type))),
    [events],
  );

  const summaryCards = [
    { label: 'Active members (7d)', value: summary.activeMembers7d, icon: Users, color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-100 dark:bg-indigo-500/10' },
    { label: 'Logins (7d)', value: summary.logins7d, icon: LogIn, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-500/10' },
    { label: 'RSVPs (7d)', value: summary.rsvps7d, icon: CalendarCheck, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-500/10' },
    { label: 'Gifts (7d)', value: summary.gifts7d, icon: DollarSign, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
    { label: 'Care messages (7d)', value: summary.careMessages7d, icon: HeartHandshake, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-100 dark:bg-rose-500/10' },
    { label: 'Community (7d)', value: summary.community7d, icon: MessageCircle, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-100 dark:bg-violet-500/10' },
    { label: 'Check-ins (7d)', value: summary.checkins7d, icon: QrCode, color: 'text-slate-600 dark:text-slate-400', bg: 'bg-slate-100 dark:bg-slate-500/10' },
  ];

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="serif text-3xl text-slate-900 dark:text-dark-100 leading-none">Portal Activity</h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            What your members are doing in the companion app
          </p>
        </div>
        <button
          onClick={reload}
          className="inline-flex items-center gap-2 px-4 py-2.5 border border-gray-200 dark:border-dark-600 text-gray-700 dark:text-dark-300 rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors"
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-3 mb-6">
        {summaryCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4">
            <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center mb-2`}>
              <Icon size={16} className={color} />
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-dark-100">{value}</p>
            <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {isDemo && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl text-sm text-amber-800 dark:text-amber-300">
          Demo mode — portal activity tracking starts once Supabase is connected and members
          sign in to the portal at <span className="font-mono">/portal</span>.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live feed */}
        <div className="lg:col-span-2 bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-dark-700 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-500/10 rounded-lg flex items-center justify-center">
                <Activity className="text-indigo-600 dark:text-indigo-400" size={18} />
              </div>
              <div>
                <h2 className="font-medium text-gray-900 dark:text-dark-100">Activity Feed</h2>
                <span className="text-xs text-gray-500 dark:text-dark-400">Last 30 days · {summary.totalEvents30d} events</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {groups.length > 0 && (
                <select
                  value={groupFilter}
                  onChange={(e) => setGroupFilter(e.target.value)}
                  className="px-3 py-1.5 border border-gray-200 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-800 text-gray-700 dark:text-dark-300 text-xs font-medium"
                >
                  <option value="all">All groups</option>
                  {groups.filter(g => g.isActive).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              )}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 border border-gray-200 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-800 text-gray-700 dark:text-dark-300 text-xs font-medium"
              >
                <option value="all">All activity</option>
                {presentTypes.map(t => (
                  <option key={t} value={t}>{EVENT_META[t]?.label ?? t}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="p-4 space-y-1 max-h-[560px] overflow-y-auto">
            {isLoading ? (
              <div className="py-12 text-center text-gray-400 dark:text-dark-500 text-sm">Loading…</div>
            ) : filteredEvents.length === 0 ? (
              <div className="py-12 text-center">
                <Smartphone className="text-gray-300 dark:text-dark-600 mx-auto mb-2" size={28} />
                <p className="text-gray-400 dark:text-dark-500 text-sm">No portal activity yet</p>
                <p className="text-gray-400 dark:text-dark-500 text-xs mt-1">
                  Invite members from the People page to get them into the portal
                </p>
              </div>
            ) : (
              filteredEvents.slice(0, 100).map(e => {
                const meta = EVENT_META[e.event_type] ?? EVENT_META.login;
                const Icon = meta.icon;
                const person = e.person_id ? personMap.get(e.person_id) : undefined;
                const personName = person ? `${person.firstName} ${person.lastName}` : undefined;
                return (
                  <button
                    key={e.id}
                    onClick={() => e.person_id && onViewPerson?.(e.person_id)}
                    disabled={!e.person_id || !onViewPerson}
                    className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors text-left disabled:hover:bg-transparent disabled:cursor-default"
                  >
                    <div className={`w-8 h-8 ${meta.bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon size={14} className={meta.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900 dark:text-dark-100 truncate">
                        {describeEvent(e, personName)}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-dark-500">{meta.label}</p>
                    </div>
                    <span className="text-[10px] text-gray-400 dark:text-dark-500 flex-shrink-0">
                      {timeAgo(e.created_at)}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Per-member rollup */}
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
          <div className="border-b border-gray-200 dark:border-dark-700 p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 dark:bg-green-500/10 rounded-lg flex items-center justify-center">
              <Users className="text-green-600 dark:text-green-400" size={18} />
            </div>
            <div>
              <h2 className="font-medium text-gray-900 dark:text-dark-100">Engaged Members</h2>
              <span className="text-xs text-gray-500 dark:text-dark-400">Most recently active</span>
            </div>
          </div>
          <div className="p-4 space-y-1 max-h-[560px] overflow-y-auto">
            {memberRollup.length === 0 ? (
              <div className="py-8 text-center text-gray-400 dark:text-dark-500 text-sm">
                No member activity yet
              </div>
            ) : (
              memberRollup.slice(0, 50).map(row => {
                const person = personMap.get(row.personId);
                if (!person) return null;
                return (
                  <button
                    key={row.personId}
                    onClick={() => onViewPerson?.(row.personId)}
                    className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors text-left"
                  >
                    <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-500/15 rounded-full flex items-center justify-center flex-shrink-0">
                      <span className="text-xs font-semibold text-indigo-700 dark:text-indigo-400">
                        {person.firstName.charAt(0)}{person.lastName.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">
                        {person.firstName} {person.lastName}
                      </p>
                      <p className="text-xs text-gray-400 dark:text-dark-500">
                        {row.eventCount30d} action{row.eventCount30d === 1 ? '' : 's'} · {timeAgo(row.lastActiveAt)}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
