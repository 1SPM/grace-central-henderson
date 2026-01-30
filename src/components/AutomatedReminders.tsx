import { useState, useMemo } from 'react';
import {
  Bell,
  Clock,
  Mail,
  MessageSquare,
  Calendar,
  Cake,
  Heart,
  CheckSquare,
  Users,
  Plus,
  Trash2,
  Play,
  Pause,
  Settings,
  AlertCircle,
} from 'lucide-react';
import type { Person, Task, CalendarEvent, PrayerRequest } from '../types';

// Reminder types
type ReminderType = 'task' | 'event' | 'birthday' | 'anniversary' | 'prayer' | 'follow-up';
type ReminderChannel = 'email' | 'sms' | 'both';
type ReminderTiming = '1hour' | '1day' | '3days' | '1week' | '2weeks' | 'custom';

interface ReminderRule {
  id: string;
  name: string;
  type: ReminderType;
  channel: ReminderChannel;
  timing: ReminderTiming;
  customDays?: number;
  enabled: boolean;
  recipients: 'person' | 'staff' | 'custom';
  customRecipients?: string[];
  messageTemplate?: string;
  lastRun?: string;
  nextRun?: string;
}

interface PendingReminder {
  id: string;
  ruleId: string;
  ruleName: string;
  type: ReminderType;
  channel: ReminderChannel;
  scheduledFor: string;
  recipientName: string;
  recipientEmail?: string;
  recipientPhone?: string;
  subject: string;
  status: 'pending' | 'sent' | 'failed';
}

interface AutomatedRemindersProps {
  people: Person[];
  tasks: Task[];
  events: CalendarEvent[];
  prayers: PrayerRequest[];
  emailConfigured: boolean;
  smsConfigured: boolean;
  onBack?: () => void;
}

const defaultRules: ReminderRule[] = [
  {
    id: 'birthday-reminder',
    name: 'Birthday Reminders',
    type: 'birthday',
    channel: 'email',
    timing: '1week',
    enabled: true,
    recipients: 'staff',
    messageTemplate: 'Reminder: {{name}}\'s birthday is coming up on {{date}}. Consider sending a card or personal message!',
  },
  {
    id: 'event-reminder',
    name: 'Event Reminders',
    type: 'event',
    channel: 'email',
    timing: '1day',
    enabled: true,
    recipients: 'person',
    messageTemplate: 'Reminder: {{event}} is tomorrow at {{time}}. We look forward to seeing you!',
  },
  {
    id: 'task-reminder',
    name: 'Task Due Reminders',
    type: 'task',
    channel: 'email',
    timing: '1day',
    enabled: true,
    recipients: 'staff',
    messageTemplate: 'Reminder: Task "{{task}}" is due tomorrow. Please complete it or update its status.',
  },
  {
    id: 'visitor-followup',
    name: 'New Visitor Follow-up',
    type: 'follow-up',
    channel: 'email',
    timing: '3days',
    enabled: false,
    recipients: 'person',
    messageTemplate: 'Hi {{name}}, it was great meeting you at our service! We hope you felt welcome.',
  },
  {
    id: 'prayer-update',
    name: 'Prayer Request Check-in',
    type: 'prayer',
    channel: 'email',
    timing: '1week',
    enabled: false,
    recipients: 'person',
    messageTemplate: 'Hi {{name}}, we wanted to check in on your prayer request. How are things going?',
  },
  {
    id: 'anniversary-reminder',
    name: 'Member Anniversary Reminders',
    type: 'anniversary',
    channel: 'email',
    timing: '1week',
    enabled: false,
    recipients: 'staff',
    messageTemplate: '{{name}} will celebrate {{years}} years as a member on {{date}}. Consider acknowledging this milestone!',
  },
];

const timingLabels: Record<ReminderTiming, string> = {
  '1hour': '1 hour before',
  '1day': '1 day before',
  '3days': '3 days before',
  '1week': '1 week before',
  '2weeks': '2 weeks before',
  'custom': 'Custom',
};

const typeIcons: Record<ReminderType, React.ReactNode> = {
  task: <CheckSquare size={16} />,
  event: <Calendar size={16} />,
  birthday: <Cake size={16} />,
  anniversary: <Heart size={16} />,
  prayer: <Bell size={16} />,
  'follow-up': <Users size={16} />,
};

const typeLabels: Record<ReminderType, string> = {
  task: 'Tasks',
  event: 'Events',
  birthday: 'Birthdays',
  anniversary: 'Anniversaries',
  prayer: 'Prayer Requests',
  'follow-up': 'Follow-ups',
};

export function AutomatedReminders({
  people,
  tasks,
  events,
  // prayers - will be used for prayer check-in reminders in future
  emailConfigured,
  smsConfigured,
  // onBack - can be used for navigation later
}: AutomatedRemindersProps) {
  const [rules, setRules] = useState<ReminderRule[]>(() => {
    const stored = localStorage.getItem('reminder-rules');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return defaultRules;
      }
    }
    return defaultRules;
  });

  const [selectedRule, setSelectedRule] = useState<ReminderRule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'rules' | 'pending' | 'history'>('rules');

  // Save rules to localStorage
  const saveRules = (newRules: ReminderRule[]) => {
    setRules(newRules);
    localStorage.setItem('reminder-rules', JSON.stringify(newRules));
  };

  // Calculate upcoming reminders based on rules
  const upcomingReminders = useMemo(() => {
    const reminders: PendingReminder[] = [];
    const now = new Date();

    rules.filter(r => r.enabled).forEach((rule) => {
      if (rule.type === 'birthday') {
        people.forEach((person) => {
          if (person.birthDate) {
            const birthDate = new Date(person.birthDate);
            const thisYearBirthday = new Date(now.getFullYear(), birthDate.getMonth(), birthDate.getDate());
            if (thisYearBirthday < now) {
              thisYearBirthday.setFullYear(thisYearBirthday.getFullYear() + 1);
            }

            const reminderDate = new Date(thisYearBirthday);
            if (rule.timing === '1week') reminderDate.setDate(reminderDate.getDate() - 7);
            else if (rule.timing === '3days') reminderDate.setDate(reminderDate.getDate() - 3);
            else if (rule.timing === '1day') reminderDate.setDate(reminderDate.getDate() - 1);

            if (reminderDate > now && reminderDate.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
              reminders.push({
                id: `${rule.id}-${person.id}`,
                ruleId: rule.id,
                ruleName: rule.name,
                type: 'birthday',
                channel: rule.channel,
                scheduledFor: reminderDate.toISOString(),
                recipientName: `${person.firstName} ${person.lastName}`,
                recipientEmail: person.email,
                recipientPhone: person.phone,
                subject: `Birthday Reminder: ${person.firstName} ${person.lastName}`,
                status: 'pending',
              });
            }
          }
        });
      } else if (rule.type === 'event') {
        events.forEach((event) => {
          const eventDate = new Date(event.startDate);
          if (eventDate > now) {
            const reminderDate = new Date(eventDate);
            if (rule.timing === '1day') reminderDate.setDate(reminderDate.getDate() - 1);
            else if (rule.timing === '1hour') reminderDate.setTime(reminderDate.getTime() - 60 * 60 * 1000);

            if (reminderDate > now && reminderDate.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
              reminders.push({
                id: `${rule.id}-${event.id}`,
                ruleId: rule.id,
                ruleName: rule.name,
                type: 'event',
                channel: rule.channel,
                scheduledFor: reminderDate.toISOString(),
                recipientName: 'All Attendees',
                subject: `Event Reminder: ${event.title}`,
                status: 'pending',
              });
            }
          }
        });
      } else if (rule.type === 'task') {
        tasks.filter(t => !t.completed).forEach((task) => {
          const dueDate = new Date(task.dueDate);
          if (dueDate > now) {
            const reminderDate = new Date(dueDate);
            if (rule.timing === '1day') reminderDate.setDate(reminderDate.getDate() - 1);
            else if (rule.timing === '1hour') reminderDate.setTime(reminderDate.getTime() - 60 * 60 * 1000);

            if (reminderDate > now && reminderDate.getTime() - now.getTime() < 30 * 24 * 60 * 60 * 1000) {
              const assignee = task.assignedTo ? people.find(p => p.id === task.assignedTo) : null;
              reminders.push({
                id: `${rule.id}-${task.id}`,
                ruleId: rule.id,
                ruleName: rule.name,
                type: 'task',
                channel: rule.channel,
                scheduledFor: reminderDate.toISOString(),
                recipientName: assignee ? `${assignee.firstName} ${assignee.lastName}` : 'Staff',
                recipientEmail: assignee?.email,
                subject: `Task Due: ${task.title}`,
                status: 'pending',
              });
            }
          }
        });
      }
    });

    return reminders.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
  }, [rules, people, tasks, events]);

  const toggleRule = (ruleId: string) => {
    const newRules = rules.map((r) =>
      r.id === ruleId ? { ...r, enabled: !r.enabled } : r
    );
    saveRules(newRules);
  };

  const updateRule = (updatedRule: ReminderRule) => {
    const newRules = rules.map((r) =>
      r.id === updatedRule.id ? updatedRule : r
    );
    saveRules(newRules);
    setSelectedRule(null);
  };

  const deleteRule = (ruleId: string) => {
    if (confirm('Are you sure you want to delete this reminder rule?')) {
      const newRules = rules.filter((r) => r.id !== ruleId);
      saveRules(newRules);
      setSelectedRule(null);
    }
  };

  const createRule = (newRule: Omit<ReminderRule, 'id'>) => {
    const rule: ReminderRule = {
      ...newRule,
      id: `rule-${Date.now()}`,
    };
    saveRules([...rules, rule]);
    setShowCreateModal(false);
  };

  const enabledCount = rules.filter((r) => r.enabled).length;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-dark-100">
            Automated Reminders
          </h1>
          <p className="text-gray-500 dark:text-dark-400 mt-1">
            {enabledCount} active reminder rules · {upcomingReminders.length} pending reminders
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 flex items-center gap-2"
          >
            <Plus size={18} />
            Add Rule
          </button>
        </div>
      </div>

      {/* Integration Status */}
      {(!emailConfigured || !smsConfigured) && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-500/10 rounded-xl border border-amber-200 dark:border-amber-500/20">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-amber-500 mt-0.5" size={20} />
            <div>
              <h3 className="font-medium text-amber-900 dark:text-amber-400">
                Setup Required
              </h3>
              <p className="text-sm text-amber-700 dark:text-amber-400/80 mt-1">
                {!emailConfigured && !smsConfigured
                  ? 'Email and SMS are not configured. Go to Settings to enable notifications.'
                  : !emailConfigured
                  ? 'Email is not configured. Email reminders will not be sent.'
                  : 'SMS is not configured. Text message reminders will not be sent.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 dark:bg-dark-800 p-1 rounded-xl w-fit">
        {[
          { id: 'rules', label: 'Reminder Rules', count: rules.length },
          { id: 'pending', label: 'Pending', count: upcomingReminders.length },
          { id: 'history', label: 'History', count: 0 },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as typeof activeTab)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-dark-100 shadow-sm'
                : 'text-gray-600 dark:text-dark-400 hover:text-gray-900 dark:hover:text-dark-200'
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className="ml-1.5 px-1.5 py-0.5 text-xs bg-gray-200 dark:bg-dark-600 rounded-full">
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-white dark:bg-dark-800 rounded-xl border ${
                rule.enabled
                  ? 'border-gray-200 dark:border-dark-700'
                  : 'border-gray-100 dark:border-dark-750'
              } p-4 transition-opacity ${!rule.enabled ? 'opacity-60' : ''}`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      rule.enabled
                        ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-dark-500'
                    }`}
                  >
                    {typeIcons[rule.type]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-dark-100">
                      {rule.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500 dark:text-dark-400">
                      <span className="flex items-center gap-1">
                        {rule.channel === 'email' ? (
                          <Mail size={12} />
                        ) : rule.channel === 'sms' ? (
                          <MessageSquare size={12} />
                        ) : (
                          <>
                            <Mail size={12} />
                            <MessageSquare size={12} />
                          </>
                        )}
                        {rule.channel === 'both' ? 'Email & SMS' : rule.channel === 'email' ? 'Email' : 'SMS'}
                      </span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {timingLabels[rule.timing]}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRule(rule.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      rule.enabled
                        ? 'bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-500/30'
                        : 'bg-gray-100 dark:bg-dark-700 text-gray-400 dark:text-dark-500 hover:bg-gray-200 dark:hover:bg-dark-600'
                    }`}
                  >
                    {rule.enabled ? <Play size={18} /> : <Pause size={18} />}
                  </button>
                  <button
                    onClick={() => setSelectedRule(rule)}
                    className="p-2 bg-gray-100 dark:bg-dark-700 text-gray-500 dark:text-dark-400 rounded-lg hover:bg-gray-200 dark:hover:bg-dark-600"
                  >
                    <Settings size={18} />
                  </button>
                  <button
                    onClick={() => deleteRule(rule.id)}
                    className="p-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {rules.length === 0 && (
            <div className="text-center py-12 bg-gray-50 dark:bg-dark-850 rounded-xl">
              <Bell className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={40} />
              <h3 className="font-medium text-gray-900 dark:text-dark-100 mb-1">
                No Reminder Rules
              </h3>
              <p className="text-sm text-gray-500 dark:text-dark-400">
                Create your first reminder rule to automate notifications
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pending Tab */}
      {activeTab === 'pending' && (
        <div className="space-y-3">
          {upcomingReminders.map((reminder) => (
            <div
              key={reminder.id}
              className="bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                    {typeIcons[reminder.type]}
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-dark-100">
                      {reminder.subject}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-sm text-gray-500 dark:text-dark-400">
                      <span>To: {reminder.recipientName}</span>
                      <span>·</span>
                      <span className="flex items-center gap-1">
                        <Clock size={12} />
                        {new Date(reminder.scheduledFor).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 rounded-full">
                    Scheduled
                  </span>
                  <span className="text-xs text-gray-400 dark:text-dark-500">
                    via {reminder.ruleName}
                  </span>
                </div>
              </div>
            </div>
          ))}

          {upcomingReminders.length === 0 && (
            <div className="text-center py-12 bg-gray-50 dark:bg-dark-850 rounded-xl">
              <Clock className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={40} />
              <h3 className="font-medium text-gray-900 dark:text-dark-100 mb-1">
                No Pending Reminders
              </h3>
              <p className="text-sm text-gray-500 dark:text-dark-400">
                Reminders will appear here when they're scheduled
              </p>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="text-center py-12 bg-gray-50 dark:bg-dark-850 rounded-xl">
          <Clock className="mx-auto text-gray-300 dark:text-dark-600 mb-3" size={40} />
          <h3 className="font-medium text-gray-900 dark:text-dark-100 mb-1">
            No Reminder History
          </h3>
          <p className="text-sm text-gray-500 dark:text-dark-400">
            Past reminders will be shown here
          </p>
        </div>
      )}

      {/* Edit Rule Modal */}
      {selectedRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
                Edit Reminder Rule
              </h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={selectedRule.name}
                  onChange={(e) =>
                    setSelectedRule({ ...selectedRule, name: e.target.value })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Reminder Type
                </label>
                <select
                  value={selectedRule.type}
                  onChange={(e) =>
                    setSelectedRule({
                      ...selectedRule,
                      type: e.target.value as ReminderType,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Send Via
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: 'email', label: 'Email', icon: <Mail size={16} /> },
                    { value: 'sms', label: 'SMS', icon: <MessageSquare size={16} /> },
                    { value: 'both', label: 'Both', icon: null },
                  ].map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setSelectedRule({
                          ...selectedRule,
                          channel: option.value as ReminderChannel,
                        })
                      }
                      className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${
                        selectedRule.channel === option.value
                          ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-2 border-indigo-500'
                          : 'bg-gray-50 dark:bg-dark-800 text-gray-600 dark:text-dark-400 border border-gray-200 dark:border-dark-600'
                      }`}
                    >
                      {option.icon}
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  When to Send
                </label>
                <select
                  value={selectedRule.timing}
                  onChange={(e) =>
                    setSelectedRule({
                      ...selectedRule,
                      timing: e.target.value as ReminderTiming,
                    })
                  }
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                >
                  {Object.entries(timingLabels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
                  Message Template
                </label>
                <textarea
                  value={selectedRule.messageTemplate || ''}
                  onChange={(e) =>
                    setSelectedRule({
                      ...selectedRule,
                      messageTemplate: e.target.value,
                    })
                  }
                  rows={3}
                  placeholder="Use {{name}}, {{date}}, {{event}}, etc."
                  className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
                />
                <p className="mt-1 text-xs text-gray-400 dark:text-dark-500">
                  Variables: {"{{name}}, {{date}}, {{event}}, {{task}}, {{time}}, {{years}}"}
                </p>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex gap-3">
              <button
                onClick={() => setSelectedRule(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
              >
                Cancel
              </button>
              <button
                onClick={() => updateRule(selectedRule)}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Rule Modal */}
      {showCreateModal && (
        <CreateRuleModal
          onClose={() => setShowCreateModal(false)}
          onCreate={createRule}
        />
      )}
    </div>
  );
}

// Create Rule Modal Component
function CreateRuleModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (rule: Omit<ReminderRule, 'id'>) => void;
}) {
  const [formData, setFormData] = useState<Omit<ReminderRule, 'id'>>({
    name: '',
    type: 'event',
    channel: 'email',
    timing: '1day',
    enabled: true,
    recipients: 'person',
    messageTemplate: '',
  });

  const handleSubmit = () => {
    if (!formData.name) return;
    onCreate(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-dark-850 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-dark-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-dark-100">
            Create Reminder Rule
          </h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Rule Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              placeholder="e.g., Weekly Prayer Reminder"
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Reminder Type
            </label>
            <select
              value={formData.type}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  type: e.target.value as ReminderType,
                })
              }
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
            >
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Send Via
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'email', label: 'Email', icon: <Mail size={16} /> },
                { value: 'sms', label: 'SMS', icon: <MessageSquare size={16} /> },
                { value: 'both', label: 'Both', icon: null },
              ].map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() =>
                    setFormData({
                      ...formData,
                      channel: option.value as ReminderChannel,
                    })
                  }
                  className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center justify-center gap-2 ${
                    formData.channel === option.value
                      ? 'bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 border-2 border-indigo-500'
                      : 'bg-gray-50 dark:bg-dark-800 text-gray-600 dark:text-dark-400 border border-gray-200 dark:border-dark-600'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              When to Send
            </label>
            <select
              value={formData.timing}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  timing: e.target.value as ReminderTiming,
                })
              }
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
            >
              {Object.entries(timingLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-dark-300 mb-1">
              Message Template
            </label>
            <textarea
              value={formData.messageTemplate || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  messageTemplate: e.target.value,
                })
              }
              rows={3}
              placeholder="Use {{name}}, {{date}}, {{event}}, etc."
              className="w-full px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl bg-white dark:bg-dark-800 text-gray-900 dark:text-dark-100"
            />
          </div>
        </div>
        <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-gray-200 dark:border-dark-600 rounded-xl text-gray-700 dark:text-dark-300 font-medium hover:bg-gray-50 dark:hover:bg-dark-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!formData.name}
            className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50"
          >
            Create Rule
          </button>
        </div>
      </div>
    </div>
  );
}
