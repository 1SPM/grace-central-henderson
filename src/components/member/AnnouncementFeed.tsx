import { useMemo } from 'react';
import {
  Megaphone,
  Calendar,
  Cake,
  Sparkles,
  UserPlus,
  AlertTriangle,
  RefreshCw,
  PartyPopper,
  Clock,
  MapPin,
} from 'lucide-react';
import type { Announcement, CalendarEvent, Person, PrayerRequest } from '../../types';

interface FeedItem {
  id: string;
  type: 'announcement' | 'event' | 'birthday' | 'prayer' | 'new-member';
  title: string;
  body?: string;
  date: string;
  pinned?: boolean;
  meta?: Record<string, string>;
  category?: string;
}

interface AnnouncementFeedProps {
  announcements: Announcement[];
  events: CalendarEvent[];
  people: Person[];
  prayers?: PrayerRequest[];
}

const ANNOUNCEMENT_ICONS: Record<string, typeof Megaphone> = {
  general: Megaphone,
  urgent: AlertTriangle,
  event: Calendar,
  update: RefreshCw,
  celebration: PartyPopper,
};

const ANNOUNCEMENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  general: { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400', border: 'border-l-blue-500' },
  urgent: { bg: 'bg-red-50 dark:bg-red-500/10', text: 'text-red-600 dark:text-red-400', border: 'border-l-red-500' },
  event: { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400', border: 'border-l-purple-500' },
  update: { bg: 'bg-amber-50 dark:bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-l-amber-500' },
  celebration: { bg: 'bg-green-50 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400', border: 'border-l-green-500' },
};

const FEED_TYPE_CONFIG = {
  event: { Icon: Calendar, bg: 'bg-indigo-50 dark:bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-l-indigo-500' },
  birthday: { Icon: Cake, bg: 'bg-pink-50 dark:bg-pink-500/10', text: 'text-pink-600 dark:text-pink-400', border: 'border-l-pink-500' },
  prayer: { Icon: Sparkles, bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-l-emerald-500' },
  'new-member': { Icon: UserPlus, bg: 'bg-teal-50 dark:bg-teal-500/10', text: 'text-teal-600 dark:text-teal-400', border: 'border-l-teal-500' },
};

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays < 0) {
    const absDays = Math.abs(diffDays);
    if (absDays === 0) return 'Today';
    if (absDays === 1) return 'Tomorrow';
    if (absDays < 7) return date.toLocaleDateString('en-US', { weekday: 'long' });
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function AnnouncementFeed({ announcements, events, people, prayers = [] }: AnnouncementFeedProps) {
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Active announcements
    announcements.forEach(a => {
      if (a.expiresAt && new Date(a.expiresAt) < now) return;
      items.push({
        id: `ann-${a.id}`,
        type: 'announcement',
        title: a.title,
        body: a.body,
        date: a.publishedAt,
        pinned: a.pinned,
        category: a.category,
      });
    });

    // Upcoming events (next 7 days)
    events
      .filter(e => {
        const d = new Date(e.startDate);
        return d >= now && d <= sevenDaysFromNow;
      })
      .slice(0, 5)
      .forEach(e => {
        items.push({
          id: `event-${e.id}`,
          type: 'event',
          title: e.title,
          date: e.startDate,
          meta: {
            time: new Date(e.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
            location: e.location || '',
          },
        });
      });

    // Birthdays this week
    const thisWeekBirthdays = people.filter(p => {
      if (!p.birthDate) return false;
      const bday = new Date(p.birthDate);
      const thisYearBday = new Date(now.getFullYear(), bday.getMonth(), bday.getDate());
      const diff = thisYearBday.getTime() - now.getTime();
      return diff >= -24 * 60 * 60 * 1000 && diff <= 7 * 24 * 60 * 60 * 1000;
    });
    if (thisWeekBirthdays.length > 0) {
      const names = thisWeekBirthdays.slice(0, 3).map(p => p.firstName).join(', ');
      const extra = thisWeekBirthdays.length > 3 ? ` and ${thisWeekBirthdays.length - 3} more` : '';
      items.push({
        id: 'birthdays-week',
        type: 'birthday',
        title: `Happy Birthday!`,
        body: `Celebrating ${names}${extra} this week 🎂`,
        date: now.toISOString(),
      });
    }

    // Answered prayers (last 14 days)
    prayers
      .filter(p => p.isAnswered && new Date(p.updatedAt) >= fourteenDaysAgo)
      .slice(0, 3)
      .forEach(p => {
        items.push({
          id: `prayer-${p.id}`,
          type: 'prayer',
          title: 'Answered Prayer',
          body: p.testimony || p.content,
          date: p.updatedAt,
        });
      });

    // New members (joined last 14 days)
    const newMembers = people.filter(p => {
      if (!p.joinDate) return false;
      return new Date(p.joinDate) >= fourteenDaysAgo;
    });
    if (newMembers.length > 0) {
      const names = newMembers.slice(0, 3).map(p => p.firstName).join(', ');
      const extra = newMembers.length > 3 ? ` and ${newMembers.length - 3} more` : '';
      items.push({
        id: 'new-members',
        type: 'new-member',
        title: 'Welcome New Members!',
        body: `${names}${extra} joined our family`,
        date: newMembers[0].joinDate!,
      });
    }

    // Sort: pinned first, then by date descending
    return items.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
  }, [announcements, events, people, prayers]);

  if (feedItems.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 dark:text-dark-500">
        <Megaphone className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No updates right now</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {feedItems.map(item => {
        if (item.type === 'announcement') {
          const colors = ANNOUNCEMENT_COLORS[item.category || 'general'];
          const Icon = ANNOUNCEMENT_ICONS[item.category || 'general'];
          return (
            <div
              key={item.id}
              className={`bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 border-l-4 ${colors.border} p-3.5`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${colors.bg}`}>
                  <Icon size={16} className={colors.text} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm truncate">{item.title}</h3>
                    {item.pinned && (
                      <span className="text-[9px] font-bold bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1 py-0.5 rounded uppercase">
                        Pinned
                      </span>
                    )}
                  </div>
                  {item.body && (
                    <p className="text-xs text-gray-500 dark:text-dark-400 line-clamp-2 leading-relaxed">{item.body}</p>
                  )}
                  <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-1">{formatRelativeDate(item.date)}</p>
                </div>
              </div>
            </div>
          );
        }

        // Non-announcement feed items
        const config = FEED_TYPE_CONFIG[item.type];
        const { Icon } = config;

        return (
          <div
            key={item.id}
            className={`bg-white dark:bg-dark-800 rounded-xl border border-gray-100 dark:border-dark-700 border-l-4 ${config.border} p-3.5`}
          >
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${config.bg}`}>
                <Icon size={16} className={config.text} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-dark-100 text-sm truncate">{item.title}</h3>
                {item.body && (
                  <p className="text-xs text-gray-500 dark:text-dark-400 line-clamp-2 leading-relaxed">{item.body}</p>
                )}
                {item.type === 'event' && item.meta && (
                  <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400 dark:text-dark-500">
                    <span className="flex items-center gap-0.5">
                      <Clock size={10} />
                      {formatRelativeDate(item.date)} · {item.meta.time}
                    </span>
                    {item.meta.location && (
                      <span className="flex items-center gap-0.5">
                        <MapPin size={10} />
                        {item.meta.location}
                      </span>
                    )}
                  </div>
                )}
                {item.type !== 'event' && (
                  <p className="text-[10px] text-gray-400 dark:text-dark-500 mt-1">{formatRelativeDate(item.date)}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
