/**
 * Activity Feed - Shows recent activity in the CRM
 */

import { useMemo } from 'react';
import {
  UserPlus,
  CheckCircle,
  MessageSquare,
  Heart,
  DollarSign,
  Calendar,
  Clock,
} from 'lucide-react';
import type { Person, Task, Interaction, PrayerRequest, Giving } from '../types';

interface ActivityItem {
  id: string;
  type: 'new_person' | 'task_completed' | 'interaction' | 'prayer' | 'giving';
  title: string;
  subtitle?: string;
  timestamp: Date;
  personId?: string;
}

interface ActivityFeedProps {
  people: Person[];
  tasks: Task[];
  interactions: Interaction[];
  prayers: PrayerRequest[];
  giving: Giving[];
  onViewPerson?: (id: string) => void;
  limit?: number;
}

const iconMap = {
  new_person: { icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-100 dark:bg-blue-500/10' },
  task_completed: { icon: CheckCircle, color: 'text-green-500', bg: 'bg-green-100 dark:bg-green-500/10' },
  interaction: { icon: MessageSquare, color: 'text-purple-500', bg: 'bg-purple-100 dark:bg-purple-500/10' },
  prayer: { icon: Heart, color: 'text-pink-500', bg: 'bg-pink-100 dark:bg-pink-500/10' },
  giving: { icon: DollarSign, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-500/10' },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ActivityFeed({
  people,
  tasks,
  interactions,
  prayers,
  giving,
  onViewPerson,
  limit = 10,
}: ActivityFeedProps) {
  // Create a person lookup map
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  // Combine all activities into a single feed
  const activities = useMemo(() => {
    const items: ActivityItem[] = [];

    // New people (last 30 days) - use firstVisit or joinDate
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    people.forEach(p => {
      const dateStr = p.firstVisit || p.joinDate;
      const addedDate = dateStr ? new Date(dateStr) : null;
      if (addedDate && addedDate > thirtyDaysAgo) {
        items.push({
          id: `person-${p.id}`,
          type: 'new_person',
          title: `${p.firstName} ${p.lastName} was added`,
          subtitle: p.status === 'visitor' ? 'New visitor' : 'New member',
          timestamp: addedDate,
          personId: p.id,
        });
      }
    });

    // Completed tasks (use createdAt as proxy since completedAt doesn't exist)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    tasks.forEach(t => {
      if (t.completed) {
        // Use createdAt as a proxy - in a real app we'd track completedAt
        const taskDate = new Date(t.createdAt);
        if (taskDate > sevenDaysAgo) {
          const person = t.personId ? personMap.get(t.personId) : null;
          items.push({
            id: `task-${t.id}`,
            type: 'task_completed',
            title: t.title,
            subtitle: person ? `${person.firstName} ${person.lastName}` : undefined,
            timestamp: taskDate,
            personId: t.personId,
          });
        }
      }
    });

    // Recent interactions (last 7 days) - use createdAt
    interactions.forEach(i => {
      const date = new Date(i.createdAt);
      if (date > sevenDaysAgo) {
        const person = personMap.get(i.personId);
        if (person) {
          items.push({
            id: `interaction-${i.id}`,
            type: 'interaction',
            title: `${i.type.charAt(0).toUpperCase() + i.type.slice(1)} with ${person.firstName}`,
            subtitle: i.content?.substring(0, 50) || undefined,
            timestamp: date,
            personId: i.personId,
          });
        }
      }
    });

    // Recent prayer requests (last 14 days) - use content instead of request
    const fourteenDaysAgo = new Date();
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

    prayers.forEach(pr => {
      const date = new Date(pr.createdAt);
      if (date > fourteenDaysAgo) {
        const person = personMap.get(pr.personId);
        items.push({
          id: `prayer-${pr.id}`,
          type: 'prayer',
          title: pr.content.substring(0, 60) + (pr.content.length > 60 ? '...' : ''),
          subtitle: person ? `From ${person.firstName}` : undefined,
          timestamp: date,
          personId: pr.personId,
        });
      }
    });

    // Recent giving (last 7 days) - handle optional personId
    giving.forEach(g => {
      const date = new Date(g.date);
      if (date > sevenDaysAgo && g.personId) {
        const person = personMap.get(g.personId);
        if (person) {
          items.push({
            id: `giving-${g.id}`,
            type: 'giving',
            title: `$${g.amount.toFixed(0)} donation`,
            subtitle: `${person.firstName} ${person.lastName}`,
            timestamp: date,
            personId: g.personId,
          });
        }
      }
    });

    // Sort by timestamp descending
    return items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()).slice(0, limit);
  }, [people, tasks, interactions, prayers, giving, personMap, limit]);

  if (activities.length === 0) {
    return (
      <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
        <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
              <Clock className="text-slate-600 dark:text-slate-400" size={18} />
            </div>
            <div>
              <h2 className="font-medium text-gray-900 dark:text-dark-100">Recent Activity</h2>
              <span className="text-xs text-gray-500 dark:text-dark-400">Latest updates</span>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="py-8 text-center">
            <Calendar className="text-gray-300 dark:text-dark-600 mx-auto mb-2" size={24} />
            <p className="text-gray-400 dark:text-dark-500 text-sm">No recent activity</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
      <div className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white dark:bg-dark-700 rounded-lg flex items-center justify-center shadow-sm">
              <Clock className="text-slate-600 dark:text-slate-400" size={18} />
            </div>
            <div>
              <h2 className="font-medium text-gray-900 dark:text-dark-100">Recent Activity</h2>
              <span className="text-xs text-gray-500 dark:text-dark-400">Latest updates</span>
            </div>
          </div>
          <span className="text-lg font-semibold text-slate-700 dark:text-slate-300">{activities.length}</span>
        </div>
      </div>

      <div className="p-4 space-y-1">
        {activities.map((activity) => {
          const { icon: Icon, color, bg } = iconMap[activity.type];

          return (
            <button
              key={activity.id}
              onClick={() => activity.personId && onViewPerson?.(activity.personId)}
              disabled={!activity.personId || !onViewPerson}
              className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors text-left disabled:hover:bg-transparent disabled:cursor-default"
            >
              <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <Icon size={14} className={color} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-900 dark:text-dark-100 truncate">{activity.title}</p>
                {activity.subtitle && (
                  <p className="text-xs text-gray-400 dark:text-dark-500 truncate">{activity.subtitle}</p>
                )}
              </div>
              <span className="text-[10px] text-gray-400 dark:text-dark-500 flex-shrink-0">
                {formatTimeAgo(activity.timestamp)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
