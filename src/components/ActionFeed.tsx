import { useState, useMemo } from 'react';
import {
  CheckCircle2,
  Circle,
  Mail,
  Phone,
  MessageSquare,
  Calendar,
  Clock,
  AlertTriangle,
  Cake,
  UserPlus,
  Sparkles,
  ChevronRight,
  Filter,
  CheckCheck,
} from 'lucide-react';
import { Person, Task } from '../types';
import { PRIORITY_COLORS } from '../constants';
import { AISuggestButton } from './AIAssistant';

interface ActionFeedProps {
  people: Person[];
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
  onSelectPerson: (personId: string) => void;
  onEmailPerson?: (person: Person) => void;
  onSmsPerson?: (person: Person) => void;
}

type FeedFilter = 'all' | 'tasks' | 'birthdays' | 'visitors';

interface FeedItem {
  id: string;
  type: 'task' | 'birthday' | 'visitor';
  title: string;
  subtitle: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  person?: Person;
  task?: Task;
  dueDate?: Date;
  actionLabel: string;
}

export function ActionFeed({
  people,
  tasks,
  onToggleTask,
  onSelectPerson,
}: ActionFeedProps) {
  const [filter, setFilter] = useState<FeedFilter>('all');
  const [showCompleted] = useState(false);
  const [emailDraft, setEmailDraft] = useState<{ personId: string; content: string } | null>(null);

  // Build feed items
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Create person lookup map
    const personMap = new Map(people.map(p => [p.id, p]));

    // Add tasks
    if (filter === 'all' || filter === 'tasks') {
      tasks.forEach(task => {
        if (task.completed && !showCompleted) return;
        if (task.completed) return; // Skip completed in feed

        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const isOverdue = dueDate < today;
        const isToday = dueDate.getTime() === today.getTime();
        const person = task.personId ? personMap.get(task.personId) : undefined;

        let priority: FeedItem['priority'] = task.priority;
        if (isOverdue) priority = 'urgent';

        items.push({
          id: `task-${task.id}`,
          type: 'task',
          title: task.title,
          subtitle: person
            ? `${person.firstName} ${person.lastName}`
            : isOverdue
              ? 'Overdue'
              : isToday
                ? 'Due today'
                : `Due ${dueDate.toLocaleDateString()}`,
          priority,
          person,
          task,
          dueDate,
          actionLabel: 'Complete',
        });
      });
    }

    // Add upcoming birthdays (next 7 days)
    if (filter === 'all' || filter === 'birthdays') {
      people.forEach(person => {
        if (!person.birthDate) return;

        const bday = new Date(person.birthDate);
        const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());

        // If birthday already passed this year, check next year
        if (thisYearBday < today) {
          thisYearBday.setFullYear(thisYearBday.getFullYear() + 1);
        }

        if (thisYearBday >= today && thisYearBday <= nextWeek) {
          const isToday = thisYearBday.getTime() === today.getTime();
          const isTomorrow = thisYearBday.getTime() === tomorrow.getTime();

          items.push({
            id: `birthday-${person.id}`,
            type: 'birthday',
            title: `${person.firstName} ${person.lastName}'s Birthday`,
            subtitle: isToday
              ? 'Today!'
              : isTomorrow
                ? 'Tomorrow'
                : thisYearBday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
            priority: isToday ? 'high' : 'medium',
            person,
            dueDate: thisYearBday,
            actionLabel: 'Send wishes',
          });
        }
      });
    }

    // Add visitors needing follow-up
    if (filter === 'all' || filter === 'visitors') {
      people
        .filter(p => p.status === 'visitor')
        .forEach(person => {
          const visitDate = person.firstVisit ? new Date(person.firstVisit) : null;
          const daysSinceVisit = visitDate
            ? Math.floor((today.getTime() - visitDate.getTime()) / (1000 * 60 * 60 * 24))
            : null;

          items.push({
            id: `visitor-${person.id}`,
            type: 'visitor',
            title: `Follow up with ${person.firstName} ${person.lastName}`,
            subtitle: daysSinceVisit !== null
              ? daysSinceVisit === 0
                ? 'Visited today'
                : `Visited ${daysSinceVisit} day${daysSinceVisit > 1 ? 's' : ''} ago`
              : 'New visitor',
            priority: daysSinceVisit !== null && daysSinceVisit > 7 ? 'high' : 'medium',
            person,
            actionLabel: 'Reach out',
          });
        });
    }

    // Sort by priority (urgent first), then by date
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    items.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
      return 0;
    });

    return items;
  }, [people, tasks, filter, showCompleted]);

  const getItemIcon = (item: FeedItem) => {
    switch (item.type) {
      case 'task':
        return item.task?.completed ? (
          <CheckCircle2 size={20} className="text-green-500" />
        ) : (
          <Circle size={20} className="text-gray-400" />
        );
      case 'birthday':
        return <Cake size={20} className="text-pink-500" />;
      case 'visitor':
        return <UserPlus size={20} className="text-blue-500" />;
    }
  };

  const getPriorityBadge = (priority: FeedItem['priority']) => {
    if (priority === 'urgent') {
      return (
        <span className="flex items-center gap-1 text-xs font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded-full">
          <AlertTriangle size={12} />
          Overdue
        </span>
      );
    }
    if (priority === 'high') {
      return (
        <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS.high}`}>
          High
        </span>
      );
    }
    return null;
  };

  const handleAction = (item: FeedItem) => {
    if (item.type === 'task' && item.task) {
      onToggleTask(item.task.id);
    } else if (item.person) {
      onSelectPerson(item.person.id);
    }
  };

  const counts = useMemo(() => ({
    all: feedItems.length,
    tasks: feedItems.filter(i => i.type === 'task').length,
    birthdays: feedItems.filter(i => i.type === 'birthday').length,
    visitors: feedItems.filter(i => i.type === 'visitor').length,
  }), [feedItems]);

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">Action Feed</h1>
        <p className="text-gray-500 dark:text-dark-400 mt-1">
          {feedItems.length} item{feedItems.length !== 1 ? 's' : ''} need your attention
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
        <Filter size={16} className="text-gray-400 flex-shrink-0" />
        {(['all', 'tasks', 'birthdays', 'visitors'] as FeedFilter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-400'
                : 'text-gray-600 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800'
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
            <span className="ml-1.5 text-xs opacity-60">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Feed Items */}
      {feedItems.length === 0 ? (
        <div className="text-center py-12">
          <CheckCheck size={48} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-dark-100">All caught up!</h3>
          <p className="text-gray-500 dark:text-dark-400 mt-1">No pending actions right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {feedItems.map(item => (
            <div
              key={item.id}
              className={`bg-white dark:bg-dark-850 rounded-xl border border-gray-200 dark:border-dark-700 p-4 transition-all hover:shadow-md ${
                item.priority === 'urgent' ? 'border-l-4 border-l-red-500' : ''
              }`}
            >
              <div className="flex items-start gap-4">
                {/* Icon / Checkbox */}
                <button
                  onClick={() => item.type === 'task' && item.task && onToggleTask(item.task.id)}
                  className={`mt-0.5 ${item.type === 'task' ? 'hover:scale-110 transition-transform' : ''}`}
                  disabled={item.type !== 'task'}
                >
                  {getItemIcon(item)}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-dark-100">{item.title}</h3>
                      <p className="text-sm text-gray-500 dark:text-dark-400 flex items-center gap-2 mt-0.5">
                        {item.type === 'task' && item.dueDate && (
                          <span className="flex items-center gap-1">
                            <Clock size={12} />
                          </span>
                        )}
                        {item.type === 'birthday' && (
                          <span className="flex items-center gap-1">
                            <Calendar size={12} />
                          </span>
                        )}
                        {item.subtitle}
                      </p>
                    </div>
                    {getPriorityBadge(item.priority)}
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    {item.person && (
                      <>
                        {item.person.email && (
                          <button
                            onClick={() => onSelectPerson(item.person!.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-500/20 transition-colors"
                          >
                            <Mail size={12} />
                            Email
                          </button>
                        )}
                        {item.person.phone && (
                          <a
                            href={`tel:${item.person.phone}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
                          >
                            <Phone size={12} />
                            Call
                          </a>
                        )}
                        {item.person.phone && (
                          <button
                            onClick={() => onSelectPerson(item.person!.id)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                          >
                            <MessageSquare size={12} />
                            Text
                          </button>
                        )}
                        <AISuggestButton
                          context={{
                            type: 'email',
                            person: item.person,
                            purpose: item.type === 'birthday' ? 'birthday greeting' : item.type === 'visitor' ? 'welcome follow-up' : 'follow-up',
                          }}
                          onGenerate={(text) => setEmailDraft({ personId: item.person!.id, content: text })}
                        />
                      </>
                    )}

                    {item.type === 'task' && (
                      <button
                        onClick={() => handleAction(item)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-dark-800 text-gray-700 dark:text-dark-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-700 transition-colors ml-auto"
                      >
                        <CheckCircle2 size={12} />
                        Mark Done
                      </button>
                    )}

                    {item.person && (
                      <button
                        onClick={() => onSelectPerson(item.person!.id)}
                        className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200 transition-colors ml-auto"
                      >
                        View Profile
                        <ChevronRight size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* AI Draft Preview */}
              {emailDraft && item.person && emailDraft.personId === item.person.id && (
                <div className="mt-4 p-3 bg-violet-50 dark:bg-violet-500/10 rounded-lg border border-violet-200 dark:border-violet-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-violet-700 dark:text-violet-400 flex items-center gap-1">
                      <Sparkles size={12} />
                      AI Draft
                    </span>
                    <button
                      onClick={() => setEmailDraft(null)}
                      className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                    >
                      Dismiss
                    </button>
                  </div>
                  <p className="text-sm text-gray-700 dark:text-dark-200 whitespace-pre-wrap">{emailDraft.content}</p>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(emailDraft.content);
                        setEmailDraft(null);
                      }}
                      className="px-3 py-1.5 text-xs font-medium bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors"
                    >
                      Copy & Use
                    </button>
                    <button
                      onClick={() => {
                        onSelectPerson(item.person!.id);
                        setEmailDraft(null);
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-violet-700 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-500/20 rounded-lg transition-colors"
                    >
                      Open in Profile
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
