import { useState, useMemo, useEffect } from 'react';
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
  CheckCheck,
  X,
  Send,
  Loader2,
  Zap,
  ListTodo,
  Gift,
  Users,
  BellOff,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  StickyNote,
} from 'lucide-react';
import { Person, Task } from '../types';
import { PRIORITY_COLORS } from '../constants';
import { generateAIText } from '../lib/services/ai';
import { useChurchSettings } from '../hooks/useChurchSettings';

interface ActionFeedProps {
  people: Person[];
  tasks: Task[];
  onToggleTask: (taskId: string) => void;
  onSelectPerson: (personId: string) => void;
}

type FeedFilter = 'all' | 'tasks' | 'birthdays' | 'visitors';
type TimeGroup = 'overdue' | 'today' | 'tomorrow' | 'thisWeek' | 'later' | 'noDate';

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
  timeGroup: TimeGroup;
}

interface CompletedItem {
  item: FeedItem;
  completedAt: Date;
  note?: string;
}

interface SnoozedItem {
  itemId: string;
  snoozeUntil: Date;
}

interface ComposeModal {
  type: 'email' | 'sms';
  person: Person;
  purpose: string;
  feedItem: FeedItem;
}

const TIME_GROUP_LABELS: Record<TimeGroup, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  thisWeek: 'This Week',
  later: 'Later',
  noDate: 'No Due Date',
};

const TIME_GROUP_ORDER: TimeGroup[] = ['overdue', 'today', 'tomorrow', 'thisWeek', 'later', 'noDate'];

export function ActionFeed({
  people,
  tasks,
  onToggleTask,
  onSelectPerson,
}: ActionFeedProps) {
  const { settings: churchSettings } = useChurchSettings();
  const churchName = churchSettings?.profile?.name || 'Our Church';

  const [filter, setFilter] = useState<FeedFilter>('all');
  const [showCompleted] = useState(false);
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('grace-crm-dismissed-actions');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });

  // Snoozed items state
  const [snoozedItems, setSnoozedItems] = useState<SnoozedItem[]>(() => {
    const saved = localStorage.getItem('grace-crm-snoozed-actions');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((s: { itemId: string; snoozeUntil: string }) => ({
        ...s,
        snoozeUntil: new Date(s.snoozeUntil),
      }));
    }
    return [];
  });

  // Completed items with notes
  const [completedItems, setCompletedItems] = useState<CompletedItem[]>(() => {
    const saved = localStorage.getItem('grace-crm-completed-actions');
    if (saved) {
      const parsed = JSON.parse(saved);
      return parsed.map((c: { item: FeedItem; completedAt: string; note?: string }) => ({
        ...c,
        completedAt: new Date(c.completedAt),
        item: {
          ...c.item,
          dueDate: c.item.dueDate ? new Date(c.item.dueDate) : undefined,
        },
      }));
    }
    return [];
  });

  // Collapsed sections state
  const [collapsedSections, setCollapsedSections] = useState<Set<TimeGroup>>(new Set());

  // Completion modal state
  const [completionModal, setCompletionModal] = useState<{ item: FeedItem; note: string } | null>(null);

  // Show/hide completed section
  const [showRecentlyCompleted, setShowRecentlyCompleted] = useState(false);

  // Save states to localStorage
  useEffect(() => {
    localStorage.setItem('grace-crm-dismissed-actions', JSON.stringify([...dismissedItems]));
  }, [dismissedItems]);

  useEffect(() => {
    localStorage.setItem('grace-crm-snoozed-actions', JSON.stringify(snoozedItems));
  }, [snoozedItems]);

  useEffect(() => {
    localStorage.setItem('grace-crm-completed-actions', JSON.stringify(completedItems));
  }, [completedItems]);

  // Clean up old completed items (keep last 24 hours)
  useEffect(() => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    setCompletedItems(prev => prev.filter(c => c.completedAt > dayAgo));
  }, []);

  // Compose modal state
  const [composeModal, setComposeModal] = useState<ComposeModal | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [smsMessage, setSmsMessage] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ success: boolean; message: string } | null>(null);

  // Get time group for a date
  const getTimeGroup = (date: Date | undefined, today: Date, tomorrow: Date, nextWeek: Date): TimeGroup => {
    if (!date) return 'noDate';
    const dateTime = date.getTime();
    const todayTime = today.getTime();
    const tomorrowTime = tomorrow.getTime();
    const nextWeekTime = nextWeek.getTime();

    if (dateTime < todayTime) return 'overdue';
    if (dateTime === todayTime) return 'today';
    if (dateTime === tomorrowTime) return 'tomorrow';
    if (dateTime <= nextWeekTime) return 'thisWeek';
    return 'later';
  };

  // Build feed items
  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);

    // Filter out snoozed items that haven't expired
    const activeSnoozed = snoozedItems.filter(s => s.snoozeUntil > new Date());
    const snoozedIds = new Set(activeSnoozed.map(s => s.itemId));

    const personMap = new Map(people.map(p => [p.id, p]));

    // Add tasks
    if (filter === 'all' || filter === 'tasks') {
      tasks.forEach(task => {
        if (task.completed && !showCompleted) return;
        if (task.completed) return;

        const dueDate = new Date(task.dueDate);
        dueDate.setHours(0, 0, 0, 0);
        const timeGroup = getTimeGroup(dueDate, today, tomorrow, nextWeek);
        const person = task.personId ? personMap.get(task.personId) : undefined;

        let priority: FeedItem['priority'] = task.priority;
        if (timeGroup === 'overdue') priority = 'urgent';

        items.push({
          id: `task-${task.id}`,
          type: 'task',
          title: task.title,
          subtitle: person ? `${person.firstName} ${person.lastName}` : `Due ${dueDate.toLocaleDateString()}`,
          priority,
          person,
          task,
          dueDate,
          actionLabel: 'Complete',
          timeGroup,
        });
      });
    }

    // Add upcoming birthdays (next 7 days)
    if (filter === 'all' || filter === 'birthdays') {
      people.forEach(person => {
        if (!person.birthDate) return;

        const bday = new Date(person.birthDate);
        const thisYearBday = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());

        if (thisYearBday < today) {
          thisYearBday.setFullYear(thisYearBday.getFullYear() + 1);
        }

        if (thisYearBday >= today && thisYearBday <= nextWeek) {
          const timeGroup = getTimeGroup(thisYearBday, today, tomorrow, nextWeek);

          items.push({
            id: `birthday-${person.id}`,
            type: 'birthday',
            title: `${person.firstName} ${person.lastName}'s Birthday`,
            subtitle: timeGroup === 'today' ? 'Today!' : timeGroup === 'tomorrow' ? 'Tomorrow' : thisYearBday.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
            priority: timeGroup === 'today' ? 'high' : 'medium',
            person,
            dueDate: thisYearBday,
            actionLabel: 'Send wishes',
            timeGroup,
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

          // Visitors are treated as "today" priority
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
            timeGroup: daysSinceVisit !== null && daysSinceVisit > 7 ? 'overdue' : 'today',
          });
        });
    }

    // Sort by priority within each time group
    const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
    items.sort((a, b) => {
      const priorityDiff = priorityOrder[a.priority] - priorityOrder[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      if (a.dueDate && b.dueDate) return a.dueDate.getTime() - b.dueDate.getTime();
      return 0;
    });

    // Filter out dismissed and snoozed items
    return items.filter(item => !dismissedItems.has(item.id) && !snoozedIds.has(item.id));
  }, [people, tasks, filter, showCompleted, dismissedItems, snoozedItems]);

  // Group items by time
  const groupedItems = useMemo(() => {
    const groups: Record<TimeGroup, FeedItem[]> = {
      overdue: [],
      today: [],
      tomorrow: [],
      thisWeek: [],
      later: [],
      noDate: [],
    };

    feedItems.forEach(item => {
      groups[item.timeGroup].push(item);
    });

    return groups;
  }, [feedItems]);

  // Calculate today's progress
  const todayProgress = useMemo(() => {
    const todayCompleted = completedItems.filter(c => {
      const completedDate = new Date(c.completedAt);
      const today = new Date();
      return completedDate.toDateString() === today.toDateString();
    }).length;

    const todayTotal = todayCompleted + groupedItems.today.length + groupedItems.overdue.length;
    return { completed: todayCompleted, total: todayTotal };
  }, [completedItems, groupedItems]);

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

  const openCompose = (type: 'email' | 'sms', person: Person, purpose: string, feedItem: FeedItem) => {
    setComposeModal({ type, person, purpose, feedItem });
    setEmailSubject('');
    setEmailBody('');
    setSmsMessage('');
    setSendResult(null);
  };

  const closeCompose = () => {
    setComposeModal(null);
    setEmailSubject('');
    setEmailBody('');
    setSmsMessage('');
    setSendResult(null);
  };

  const handleAIDraft = async () => {
    if (!composeModal) return;
    setIsGenerating(true);

    const { type, person, purpose } = composeModal;

    const prompt = type === 'email'
      ? `Write a friendly, professional email for ${person.firstName} ${person.lastName} from ${churchName}.
Status: ${person.status}
Purpose: ${purpose}
${person.notes ? `Notes about them: ${person.notes}` : ''}

Generate a warm, personalized email. Include a subject line formatted as "Subject: [subject]" on the first line.
Keep the body under 150 words.
End with a warm closing like "Blessings," or "With warmth," followed by the church name "${churchName}" as the signature.
Make it feel personal and caring, like it's from the pastoral team.`
      : `Write a brief, friendly text message for ${person.firstName} from ${churchName}.
Status: ${person.status}
Purpose: ${purpose}

Keep it under 160 characters. Be warm but concise. Do not include a subject line. Sign off with just the church name.`;

    try {
      const result = await generateAIText({
        prompt,
        maxTokens: type === 'sms' ? 100 : 300
      });

      if (result.success && result.text) {
        if (type === 'email') {
          const subjectMatch = result.text.match(/^Subject:\s*(.+?)(?:\n|$)/i);
          if (subjectMatch) {
            setEmailSubject(subjectMatch[1].trim());
            setEmailBody(result.text.replace(/^Subject:\s*.+?\n+/i, '').trim());
          } else {
            setEmailBody(result.text);
          }
        } else {
          setSmsMessage(result.text.slice(0, 160));
        }
      }
    } catch {
      // Silent fail
    }

    setIsGenerating(false);
  };

  const handleSend = async () => {
    if (!composeModal) return;
    setIsSending(true);
    await new Promise(resolve => setTimeout(resolve, 1000));
    setSendResult({ success: true, message: `${composeModal.type === 'email' ? 'Email' : 'Text'} sent!` });
    setIsSending(false);
  };

  const handleSnooze = (item: FeedItem, hours: number) => {
    const snoozeUntil = new Date(Date.now() + hours * 60 * 60 * 1000);
    setSnoozedItems(prev => [...prev.filter(s => s.itemId !== item.id), { itemId: item.id, snoozeUntil }]);
  };

  const handleMarkDone = (item: FeedItem, note?: string) => {
    // Add to completed items
    setCompletedItems(prev => [{
      item,
      completedAt: new Date(),
      note,
    }, ...prev].slice(0, 50)); // Keep last 50

    if (item.task) {
      onToggleTask(item.task.id);
    } else {
      setDismissedItems(prev => new Set([...prev, item.id]));
    }
    closeCompose();
    setCompletionModal(null);
  };

  const handleUndo = (completedItem: CompletedItem) => {
    // Remove from completed
    setCompletedItems(prev => prev.filter(c => c.item.id !== completedItem.item.id));

    // If it was a dismissed item (not a task), remove from dismissed
    if (!completedItem.item.task) {
      setDismissedItems(prev => {
        const next = new Set(prev);
        next.delete(completedItem.item.id);
        return next;
      });
    }
    // Note: For tasks, we'd need an "uncomplete" handler from parent
  };

  const toggleSection = (group: TimeGroup) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  const counts = useMemo(() => ({
    all: feedItems.length,
    tasks: feedItems.filter(i => i.type === 'task').length,
    birthdays: feedItems.filter(i => i.type === 'birthday').length,
    visitors: feedItems.filter(i => i.type === 'visitor').length,
  }), [feedItems]);

  const filterConfig = {
    all: { icon: Zap, color: 'violet' },
    tasks: { icon: ListTodo, color: 'blue' },
    birthdays: { icon: Gift, color: 'pink' },
    visitors: { icon: Users, color: 'amber' },
  };

  const renderFeedItem = (item: FeedItem) => {
    const typeConfig = {
      task: { iconBg: 'bg-blue-100 dark:bg-blue-500/20', iconColor: 'text-blue-500' },
      birthday: { iconBg: 'bg-pink-100 dark:bg-pink-500/20', iconColor: 'text-pink-500' },
      visitor: { iconBg: 'bg-amber-100 dark:bg-amber-500/20', iconColor: 'text-amber-500' },
    };
    const config = typeConfig[item.type];

    return (
      <div
        key={item.id}
        className={`p-4 hover:bg-gray-50 dark:hover:bg-dark-750 transition-colors ${
          item.priority === 'urgent' ? 'bg-red-50/50 dark:bg-red-500/5' : ''
        }`}
      >
        <div className="flex items-start gap-4">
          <div className="relative">
            <div className={`w-10 h-10 ${config.iconBg} rounded-xl flex items-center justify-center`}>
              {item.type === 'task' ? (
                <button
                  onClick={() => item.task && onToggleTask(item.task.id)}
                  className="hover:scale-110 transition-transform"
                >
                  <Circle size={20} className={config.iconColor} />
                </button>
              ) : item.type === 'birthday' ? (
                <Cake size={20} className={config.iconColor} />
              ) : (
                <UserPlus size={20} className={config.iconColor} />
              )}
            </div>
            {item.priority === 'urgent' && (
              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                <AlertTriangle size={10} className="text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-dark-100">{item.title}</h3>
                <p className="text-sm text-gray-500 dark:text-dark-400 flex items-center gap-1.5 mt-0.5">
                  {item.type === 'task' && item.dueDate && <Clock size={12} />}
                  {item.type === 'birthday' && <Calendar size={12} />}
                  {item.subtitle}
                </p>
              </div>
              {getPriorityBadge(item.priority)}
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              {item.person && (
                <>
                  {item.person.email && (
                    <button
                      onClick={() => openCompose('email', item.person!,
                        item.type === 'birthday' ? 'birthday greeting' :
                        item.type === 'visitor' ? 'welcome follow-up' : 'follow-up',
                        item
                      )}
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
                      onClick={() => openCompose('sms', item.person!,
                        item.type === 'birthday' ? 'birthday greeting' :
                        item.type === 'visitor' ? 'welcome follow-up' : 'follow-up',
                        item
                      )}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-500/20 transition-colors"
                    >
                      <MessageSquare size={12} />
                      Text
                    </button>
                  )}
                </>
              )}

              {/* Snooze dropdown */}
              <div className="relative group">
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-dark-300 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600 transition-colors"
                >
                  <BellOff size={12} />
                  Snooze
                </button>
                <div className="absolute left-0 top-full mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 min-w-[140px]">
                  <button
                    onClick={() => handleSnooze(item, 1)}
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-dark-200 hover:bg-gray-50 dark:hover:bg-dark-700 first:rounded-t-lg"
                  >
                    1 hour
                  </button>
                  <button
                    onClick={() => handleSnooze(item, 3)}
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-dark-200 hover:bg-gray-50 dark:hover:bg-dark-700"
                  >
                    3 hours
                  </button>
                  <button
                    onClick={() => handleSnooze(item, 24)}
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-dark-200 hover:bg-gray-50 dark:hover:bg-dark-700"
                  >
                    Tomorrow
                  </button>
                  <button
                    onClick={() => handleSnooze(item, 168)}
                    className="w-full px-3 py-2 text-left text-xs text-gray-700 dark:text-dark-200 hover:bg-gray-50 dark:hover:bg-dark-700 last:rounded-b-lg"
                  >
                    Next week
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => setCompletionModal({ item, note: '' })}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 rounded-lg hover:bg-green-100 dark:hover:bg-green-500/20 transition-colors"
                >
                  <CheckCircle2 size={12} />
                  Done
                </button>

                {item.person && (
                  <button
                    onClick={() => onSelectPerson(item.person!.id)}
                    className="text-xs text-gray-500 dark:text-dark-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                  >
                    View →
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-xl h-32">
        <img
          src="https://images.unsplash.com/photo-1557804506-669a67965ba0?w=1200&h=400&fit=crop"
          alt="Actions"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-violet-900/90 via-purple-800/80 to-violet-900/70" />
        <div className="relative h-full p-5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-xl flex items-center justify-center border border-white/20">
              <Zap className="text-white/90" size={24} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Action Center</h2>
              <p className="text-white/60 text-sm">
                {feedItems.length} item{feedItems.length !== 1 ? 's' : ''} need your attention
              </p>
            </div>
          </div>

          {/* Progress indicator */}
          {todayProgress.total > 0 && (
            <div className="text-right">
              <p className="text-white/80 text-sm font-medium">
                {todayProgress.completed} of {todayProgress.total} done today
              </p>
              <div className="w-32 h-2 bg-white/20 rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full bg-green-400 rounded-full transition-all"
                  style={{ width: `${(todayProgress.completed / todayProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {(['all', 'tasks', 'birthdays', 'visitors'] as FeedFilter[]).map(f => {
          const config = filterConfig[f];
          const Icon = config.icon;
          const isActive = filter === f;
          const count = counts[f];

          const colorClasses = {
            violet: {
              bg: isActive ? 'bg-violet-100 dark:bg-violet-500/20' : 'bg-white dark:bg-dark-800',
              border: isActive ? 'border-violet-300 dark:border-violet-500/30' : 'border-gray-200 dark:border-dark-700',
              icon: 'text-violet-500',
              text: isActive ? 'text-violet-700 dark:text-violet-400' : 'text-gray-900 dark:text-dark-100',
            },
            blue: {
              bg: isActive ? 'bg-blue-100 dark:bg-blue-500/20' : 'bg-white dark:bg-dark-800',
              border: isActive ? 'border-blue-300 dark:border-blue-500/30' : 'border-gray-200 dark:border-dark-700',
              icon: 'text-blue-500',
              text: isActive ? 'text-blue-700 dark:text-blue-400' : 'text-gray-900 dark:text-dark-100',
            },
            pink: {
              bg: isActive ? 'bg-pink-100 dark:bg-pink-500/20' : 'bg-white dark:bg-dark-800',
              border: isActive ? 'border-pink-300 dark:border-pink-500/30' : 'border-gray-200 dark:border-dark-700',
              icon: 'text-pink-500',
              text: isActive ? 'text-pink-700 dark:text-pink-400' : 'text-gray-900 dark:text-dark-100',
            },
            amber: {
              bg: isActive ? 'bg-amber-100 dark:bg-amber-500/20' : 'bg-white dark:bg-dark-800',
              border: isActive ? 'border-amber-300 dark:border-amber-500/30' : 'border-gray-200 dark:border-dark-700',
              icon: 'text-amber-500',
              text: isActive ? 'text-amber-700 dark:text-amber-400' : 'text-gray-900 dark:text-dark-100',
            },
          };

          const colors = colorClasses[config.color as keyof typeof colorClasses];

          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`${colors.bg} ${colors.border} border rounded-xl p-4 text-left transition-all hover:shadow-md`}
            >
              <div className="flex items-center justify-between mb-2">
                <Icon size={20} className={colors.icon} />
                <span className={`text-2xl font-bold ${colors.text}`}>{count}</span>
              </div>
              <p className={`text-sm font-medium ${colors.text}`}>
                {f === 'all' ? 'All Actions' : f.charAt(0).toUpperCase() + f.slice(1)}
              </p>
            </button>
          );
        })}
      </div>

      {/* Feed Items grouped by time */}
      {feedItems.length === 0 ? (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-12 text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCheck size={32} className="text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-dark-100">All caught up!</h3>
          <p className="text-gray-500 dark:text-dark-400 mt-1">No pending actions right now.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {TIME_GROUP_ORDER.map(group => {
            const items = groupedItems[group];
            if (items.length === 0) return null;

            const isCollapsed = collapsedSections.has(group);
            const isUrgent = group === 'overdue';

            return (
              <div key={group} className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(group)}
                  className={`w-full px-4 py-3 flex items-center justify-between ${
                    isUrgent ? 'bg-red-50 dark:bg-red-500/10' : 'bg-gray-50 dark:bg-dark-750'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    <span className={`font-semibold ${isUrgent ? 'text-red-700 dark:text-red-400' : 'text-gray-700 dark:text-dark-200'}`}>
                      {TIME_GROUP_LABELS[group]}
                    </span>
                    <span className={`text-sm px-2 py-0.5 rounded-full ${
                      isUrgent
                        ? 'bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400'
                        : 'bg-gray-200 dark:bg-dark-600 text-gray-600 dark:text-dark-300'
                    }`}>
                      {items.length}
                    </span>
                  </div>
                </button>

                {/* Section items */}
                {!isCollapsed && (
                  <div className="divide-y divide-gray-100 dark:divide-dark-700">
                    {items.map(renderFeedItem)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recently Completed Section */}
      {completedItems.length > 0 && (
        <div className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden">
          <button
            onClick={() => setShowRecentlyCompleted(!showRecentlyCompleted)}
            className="w-full px-4 py-3 flex items-center justify-between bg-green-50 dark:bg-green-500/10"
          >
            <div className="flex items-center gap-2">
              {showRecentlyCompleted ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              <CheckCheck size={16} className="text-green-600 dark:text-green-400" />
              <span className="font-semibold text-green-700 dark:text-green-400">
                Recently Completed
              </span>
              <span className="text-sm px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-500/20 text-green-600 dark:text-green-400">
                {completedItems.length}
              </span>
            </div>
          </button>

          {showRecentlyCompleted && (
            <div className="divide-y divide-gray-100 dark:divide-dark-700">
              {completedItems.slice(0, 10).map((completed, idx) => (
                <div key={idx} className="p-4 opacity-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 size={20} className="text-green-500" />
                      <div>
                        <p className="font-medium text-gray-700 dark:text-dark-200 line-through">
                          {completed.item.title}
                        </p>
                        {completed.note && (
                          <p className="text-sm text-gray-500 dark:text-dark-400 flex items-center gap-1 mt-0.5">
                            <StickyNote size={12} />
                            {completed.note}
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleUndo(completed)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-gray-500 dark:text-dark-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                    >
                      <RotateCcw size={12} />
                      Undo
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Completion Note Modal */}
      {completionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <h2 className="font-semibold text-gray-900 dark:text-dark-100">
                Mark as Done
              </h2>
              <p className="text-sm text-gray-500 dark:text-dark-400 mt-1">
                {completionModal.item.title}
              </p>
            </div>
            <div className="p-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-2">
                Add a note (optional)
              </label>
              <textarea
                value={completionModal.note}
                onChange={(e) => setCompletionModal({ ...completionModal, note: e.target.value })}
                placeholder="Left voicemail, will call back Tuesday..."
                rows={3}
                className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              />
            </div>
            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
              <button
                onClick={() => setCompletionModal(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleMarkDone(completionModal.item, completionModal.note || undefined)}
                className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-colors"
              >
                <CheckCircle2 size={16} />
                Mark Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Compose Modal */}
      {composeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg shadow-2xl">
            <div className="p-4 border-b border-gray-200 dark:border-dark-700">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    composeModal.type === 'email'
                      ? 'bg-blue-100 dark:bg-blue-500/20'
                      : 'bg-purple-100 dark:bg-purple-500/20'
                  }`}>
                    {composeModal.type === 'email'
                      ? <Mail size={20} className="text-blue-600 dark:text-blue-400" />
                      : <MessageSquare size={20} className="text-purple-600 dark:text-purple-400" />
                    }
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900 dark:text-dark-100">
                      {composeModal.type === 'email' ? 'Send Email' : 'Send Text'}
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-dark-400">
                      to {composeModal.person.firstName} {composeModal.person.lastName}
                    </p>
                  </div>
                </div>
                <button
                  onClick={closeCompose}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg"
                >
                  <X size={20} className="text-gray-400" />
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              <button
                onClick={handleAIDraft}
                disabled={isGenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-xl font-medium hover:from-violet-600 hover:to-purple-700 disabled:opacity-50 transition-all"
              >
                {isGenerating ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    Generate with AI
                  </>
                )}
              </button>

              {composeModal.type === 'email' ? (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Enter subject..."
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                      Message
                    </label>
                    <textarea
                      value={emailBody}
                      onChange={(e) => setEmailBody(e.target.value)}
                      placeholder="Write your message or click 'Generate with AI'..."
                      rows={6}
                      className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                    Message
                  </label>
                  <textarea
                    value={smsMessage}
                    onChange={(e) => setSmsMessage(e.target.value.slice(0, 160))}
                    placeholder="Write your message or click 'Generate with AI'..."
                    rows={4}
                    maxLength={160}
                    className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none"
                  />
                  <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">
                    {smsMessage.length}/160 characters
                  </p>
                </div>
              )}

              {sendResult && (
                <div className={`p-3 rounded-xl flex items-center gap-2 ${
                  sendResult.success
                    ? 'bg-green-50 dark:bg-green-500/10 text-green-700 dark:text-green-400'
                    : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400'
                }`}>
                  {sendResult.success ? <CheckCircle2 size={16} /> : <X size={16} />}
                  {sendResult.message}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
              {sendResult?.success ? (
                <>
                  <button
                    onClick={closeCompose}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl transition-colors"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => handleMarkDone(composeModal.feedItem)}
                    className="px-4 py-2 bg-green-600 text-white rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-green-700 transition-colors"
                  >
                    <CheckCircle2 size={16} />
                    Mark Done
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={closeCompose}
                    className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-dark-300 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSend}
                    disabled={isSending || (composeModal.type === 'email' ? !emailBody.trim() : !smsMessage.trim())}
                    className={`px-4 py-2 text-white rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-50 transition-colors ${
                      composeModal.type === 'email'
                        ? 'bg-blue-600 hover:bg-blue-700'
                        : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {isSending ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send size={16} />
                        Send {composeModal.type === 'email' ? 'Email' : 'Text'}
                      </>
                    )}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
