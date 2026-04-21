import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  ArrowLeft,
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  Save,
  X,
  Users,
  Calendar,
  CheckCircle2,
  Bell,
  UserPlus,
  Clock,
  Filter,
  AlertCircle,
  Activity,
  Settings,
  RefreshCw,
} from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthContext } from '../contexts/AuthContext';
import type { Person, Task, Interaction } from '../types';

interface FollowUpAutomationProps {
  people: Person[];
  tasks: Task[];
  interactions: Interaction[];
  onAddTask: (task: Omit<Task, 'id' | 'createdAt'>) => void;
  onBack: () => void;
}

type TriggerType =
  | 'first_visit'
  | 'visit_count'
  | 'no_attendance'
  | 'status_change'
  | 'birthday_upcoming'
  | 'new_member'
  | 'tag_added'
  | 'joined_group';

type ActionType =
  | 'create_task'
  | 'send_notification'
  | 'add_tag'
  | 'assign_to_group';

interface AutomationRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: {
    type: TriggerType;
    config: Record<string, unknown>;
  };
  conditions: {
    field: string;
    operator: 'equals' | 'contains' | 'greater_than' | 'less_than';
    value: string | number;
  }[];
  action: {
    type: ActionType;
    config: Record<string, unknown>;
  };
  createdAt: string;
  lastTriggered?: string;
  triggerCount: number;
}

interface TriggeredEvent {
  id: string;
  ruleId: string;
  ruleName: string;
  personId: string;
  personName: string;
  triggeredAt: string;
  actionTaken: string;
  status: 'success' | 'pending' | 'failed';
}

const defaultRules: AutomationRule[] = [
  {
    id: '1',
    name: 'First Visit Follow-up',
    description: 'Create a follow-up task when someone marks their first visit',
    enabled: true,
    trigger: {
      type: 'first_visit',
      config: {},
    },
    conditions: [],
    action: {
      type: 'create_task',
      config: {
        title: 'Follow up with {firstName} - First Time Visitor',
        category: 'follow-up',
        priority: 'high',
        daysUntilDue: 2,
      },
    },
    createdAt: '2024-01-15',
    lastTriggered: '2024-01-28',
    triggerCount: 12,
  },
  {
    id: '2',
    name: 'Third Visit Alert',
    description: 'Send notification when someone visits 3 times',
    enabled: true,
    trigger: {
      type: 'visit_count',
      config: { count: 3 },
    },
    conditions: [
      { field: 'status', operator: 'equals', value: 'visitor' },
    ],
    action: {
      type: 'send_notification',
      config: {
        message: '{firstName} {lastName} has visited 3 times! Consider reaching out.',
        notifyRoles: ['pastor', 'admin'],
      },
    },
    createdAt: '2024-01-15',
    lastTriggered: '2024-01-25',
    triggerCount: 5,
  },
  {
    id: '3',
    name: 'Inactive Member Check-in',
    description: 'Create care task when member hasn\'t attended in 4 weeks',
    enabled: true,
    trigger: {
      type: 'no_attendance',
      config: { weeks: 4 },
    },
    conditions: [
      { field: 'status', operator: 'equals', value: 'member' },
    ],
    action: {
      type: 'create_task',
      config: {
        title: 'Check in with {firstName} - No attendance in 4 weeks',
        category: 'care',
        priority: 'medium',
        daysUntilDue: 7,
      },
    },
    createdAt: '2024-01-15',
    lastTriggered: '2024-01-20',
    triggerCount: 8,
  },
  {
    id: '4',
    name: 'Birthday Greeting',
    description: 'Create task to send birthday wishes 3 days before',
    enabled: false,
    trigger: {
      type: 'birthday_upcoming',
      config: { daysBefore: 3 },
    },
    conditions: [],
    action: {
      type: 'create_task',
      config: {
        title: 'Send birthday wishes to {firstName}',
        category: 'care',
        priority: 'low',
        daysUntilDue: 0,
      },
    },
    createdAt: '2024-01-15',
    triggerCount: 0,
  },
];

const triggerLabels: Record<TriggerType, { label: string; icon: React.ReactNode; description: string }> = {
  first_visit: { label: 'First Visit', icon: <UserPlus size={16} />, description: 'When someone marks their first visit' },
  visit_count: { label: 'Visit Count', icon: <RefreshCw size={16} />, description: 'When someone reaches X number of visits' },
  no_attendance: { label: 'No Attendance', icon: <AlertCircle size={16} />, description: 'When someone hasn\'t attended for X weeks' },
  status_change: { label: 'Status Change', icon: <Activity size={16} />, description: 'When someone\'s membership status changes' },
  birthday_upcoming: { label: 'Birthday Upcoming', icon: <Calendar size={16} />, description: 'X days before someone\'s birthday' },
  new_member: { label: 'New Member', icon: <Users size={16} />, description: 'When someone becomes a member' },
  tag_added: { label: 'Tag Added', icon: <Filter size={16} />, description: 'When a specific tag is added to someone' },
  joined_group: { label: 'Joined Group', icon: <Users size={16} />, description: 'When someone joins a small group' },
};

const actionLabels: Record<ActionType, { label: string; icon: React.ReactNode }> = {
  create_task: { label: 'Create Task', icon: <CheckCircle2 size={16} /> },
  send_notification: { label: 'Send Notification', icon: <Bell size={16} /> },
  add_tag: { label: 'Add Tag', icon: <Filter size={16} /> },
  assign_to_group: { label: 'Assign to Group', icon: <Users size={16} /> },
};

export function FollowUpAutomation({
  people,
  tasks: _tasks,
  interactions: _interactions,
  onAddTask: _onAddTask,
  onBack,
}: FollowUpAutomationProps) {
  void _tasks;
  void _interactions;
  void _onAddTask;
  const { churchId } = useAuthContext();
  const [rules, setRules] = useState<AutomationRule[]>(defaultRules);
  const [activeTab, setActiveTab] = useState<'rules' | 'activity' | 'create'>('rules');
  const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [triggeredEvents, setTriggeredEvents] = useState<TriggeredEvent[]>([]);
  const [, setIsLoaded] = useState(false);

  // Build person lookup for event display
  const personMap = useMemo(() => new Map(people.map(p => [p.id, p])), [people]);

  // Load rules and events from Supabase
  useEffect(() => {
    const sb = isSupabaseConfigured() ? supabase : null;
    if (!sb) {
      setIsLoaded(true);
      return;
    }

    const loadData = async () => {
      // Load rules
      const { data: dbRules, error: rulesErr } = await sb
        .from('automation_rules')
        .select('*')
        .eq('church_id', churchId)
        .order('created_at', { ascending: false });

      if (!rulesErr && dbRules && dbRules.length > 0) {
        setRules(dbRules.map((r: Record<string, unknown>) => ({
          id: r.id as string,
          name: r.name as string,
          description: (r.description as string) || '',
          enabled: r.is_active as boolean,
          trigger: {
            type: (r.trigger_type as TriggerType),
            config: ((r.trigger_config as Record<string, unknown>) || {}),
          },
          conditions: ((r.trigger_config as Record<string, unknown>)?.conditions as AutomationRule['conditions']) || [],
          action: {
            type: (r.action_type as ActionType),
            config: ((r.action_config as Record<string, unknown>) || {}),
          },
          createdAt: r.created_at as string,
          lastTriggered: (r.last_run_at as string) || undefined,
          triggerCount: (r.run_count as number) || 0,
        })));
      }
      // If no DB rules, keep defaultRules for demo

      // Load recent events (last 30 days)
      const { data: dbEvents, error: eventsErr } = await sb
        .from('automation_events')
        .select('*')
        .eq('church_id', churchId)
        .gte('triggered_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .order('triggered_at', { ascending: false })
        .limit(50);

      if (!eventsErr && dbEvents) {
        setTriggeredEvents(dbEvents.map((e: Record<string, unknown>) => {
          const person = personMap.get(e.person_id as string);
          const rule = rules.find(r => r.id === (e.rule_id as string));
          return {
            id: e.id as string,
            ruleId: e.rule_id as string,
            ruleName: rule?.name || 'Unknown Rule',
            personId: (e.person_id as string) || '',
            personName: person ? `${person.firstName} ${person.lastName}` : 'Unknown',
            triggeredAt: e.triggered_at as string,
            actionTaken: (e.details as string) || (e.result as string) || 'Action executed',
            status: ((e.result as string) === 'failed' ? 'failed' : 'success') as TriggeredEvent['status'],
          };
        }));
      }

      setIsLoaded(true);
    };

    loadData();
  }, [churchId, personMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // New rule form state
  const [newRule, setNewRule] = useState<Partial<AutomationRule>>({
    name: '',
    description: '',
    enabled: true,
    trigger: { type: 'first_visit', config: {} },
    conditions: [],
    action: { type: 'create_task', config: { title: '', category: 'follow-up', priority: 'medium', daysUntilDue: 3 } },
  });

  // Stats
  const stats = useMemo(() => {
    const activeRules = rules.filter(r => r.enabled).length;
    const totalTriggers = rules.reduce((sum, r) => sum + r.triggerCount, 0);
    const recentTriggers = triggeredEvents.filter(e => {
      const triggeredDate = new Date(e.triggeredAt);
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      return triggeredDate > weekAgo;
    }).length;

    return { activeRules, totalTriggers, recentTriggers };
  }, [rules, triggeredEvents]);

  const toggleRule = useCallback(async (ruleId: string) => {
    const rule = rules.find(r => r.id === ruleId);
    if (!rule) return;
    const newEnabled = !rule.enabled;

    // Optimistic update
    setRules(prev => prev.map(r =>
      r.id === ruleId ? { ...r, enabled: newEnabled } : r
    ));

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('automation_rules')
        .update({ is_active: newEnabled, updated_at: new Date().toISOString() })
        .eq('id', ruleId);
      if (error) {
        console.error('Failed to toggle rule:', error.message);
        // Revert on failure
        setRules(prev => prev.map(r =>
          r.id === ruleId ? { ...r, enabled: !newEnabled } : r
        ));
      }
    }
  }, [rules]);

  const deleteRule = useCallback(async (ruleId: string) => {
    if (!confirm('Are you sure you want to delete this automation rule?')) return;

    setRules(prev => prev.filter(r => r.id !== ruleId));

    if (isSupabaseConfigured() && supabase) {
      const { error } = await supabase
        .from('automation_rules')
        .delete()
        .eq('id', ruleId);
      if (error) {
        console.error('Failed to delete rule:', error.message);
      }
    }
  }, []);

  const handleCreateRule = useCallback(async () => {
    if (!newRule.name || !newRule.trigger || !newRule.action) return;

    const triggerConfig = {
      ...newRule.trigger.config,
      conditions: newRule.conditions || [],
    };

    if (isSupabaseConfigured() && supabase) {
      const { data, error } = await supabase
        .from('automation_rules')
        .insert({
          church_id: churchId,
          name: newRule.name,
          description: newRule.description || null,
          trigger_type: newRule.trigger.type,
          trigger_config: triggerConfig,
          action_type: newRule.action.type,
          action_config: newRule.action.config,
          is_active: newRule.enabled ?? true,
        })
        .select()
        .single();

      if (!error && data) {
        const rule: AutomationRule = {
          id: data.id,
          name: data.name,
          description: data.description || '',
          enabled: data.is_active,
          trigger: { type: data.trigger_type as TriggerType, config: data.trigger_config || {} },
          conditions: (data.trigger_config as Record<string, unknown>)?.conditions as AutomationRule['conditions'] || [],
          action: { type: data.action_type as ActionType, config: data.action_config || {} },
          createdAt: data.created_at,
          triggerCount: 0,
        };
        setRules(prev => [rule, ...prev]);
      } else if (error) {
        console.error('Failed to create rule:', error.message);
      }
    } else {
      // Fallback: local-only
      const rule: AutomationRule = {
        id: Date.now().toString(),
        name: newRule.name,
        description: newRule.description || '',
        enabled: newRule.enabled ?? true,
        trigger: newRule.trigger as AutomationRule['trigger'],
        conditions: newRule.conditions || [],
        action: newRule.action as AutomationRule['action'],
        createdAt: new Date().toISOString(),
        triggerCount: 0,
      };
      setRules(prev => [rule, ...prev]);
    }

    setShowCreateModal(false);
    setNewRule({
      name: '',
      description: '',
      enabled: true,
      trigger: { type: 'first_visit', config: {} },
      conditions: [],
      action: { type: 'create_task', config: { title: '', category: 'follow-up', priority: 'medium', daysUntilDue: 3 } },
    });
    setActiveTab('rules');
  }, [newRule, churchId]);

  const runRuleManually = useCallback((rule: AutomationRule) => {
    alert(`Running "${rule.name}" would check all people matching the trigger conditions and execute the action. In production, this would create tasks, send notifications, etc.`);
  }, []);

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2 hover:bg-gray-100 dark:hover:bg-dark-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              <Zap className="text-amber-500" size={28} />
              Follow-up Automation
            </h1>
            <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
              Automate tasks and notifications based on member activity
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
        >
          <Plus size={18} />
          New Rule
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl p-4 border border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-500/20 rounded-lg">
              <Play size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.activeRules}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Active Rules</p>
            </div>
          </div>
        </div>
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl p-4 border border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 dark:bg-slate-500/20 rounded-lg">
              <Zap size={20} className="text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalTriggers}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Triggers</p>
            </div>
          </div>
        </div>
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl p-4 border border-gray-200 dark:border-dark-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-500/20 rounded-lg">
              <Clock size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.recentTriggers}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">This Week</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-dark-700">
        <button
          onClick={() => setActiveTab('rules')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'rules'
              ? 'border-slate-600 text-slate-600 dark:text-slate-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Settings size={16} />
            Rules ({rules.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
            activeTab === 'activity'
              ? 'border-slate-600 text-slate-600 dark:text-slate-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <div className="flex items-center gap-2">
            <Activity size={16} />
            Activity Log
          </div>
        </button>
      </div>

      {/* Rules Tab */}
      {activeTab === 'rules' && (
        <div className="space-y-4">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={`bg-stone-100 dark:bg-dark-800 rounded-xl border transition-all ${
                rule.enabled
                  ? 'border-gray-200 dark:border-dark-700'
                  : 'border-gray-200 dark:border-dark-700 opacity-60'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      rule.enabled
                        ? 'bg-slate-100 dark:bg-slate-500/20'
                        : 'bg-gray-100 dark:bg-dark-700'
                    }`}>
                      {triggerLabels[rule.trigger.type].icon}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                        {rule.name}
                        {rule.enabled ? (
                          <span className="px-2 py-0.5 text-xs bg-green-100 dark:bg-green-500/20 text-green-700 dark:text-green-400 rounded-full">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 text-xs bg-gray-100 dark:bg-dark-700 text-gray-500 rounded-full">
                            Paused
                          </span>
                        )}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {rule.description}
                      </p>
                      <div className="flex items-center gap-4 mt-3 text-xs text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                          <Zap size={12} />
                          Trigger: {triggerLabels[rule.trigger.type].label}
                        </span>
                        <span className="flex items-center gap-1">
                          {actionLabels[rule.action.type].icon}
                          Action: {actionLabels[rule.action.type].label}
                        </span>
                        <span>
                          Triggered {rule.triggerCount} times
                        </span>
                        {rule.lastTriggered && (
                          <span>
                            Last: {formatTimeAgo(rule.lastTriggered)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => runRuleManually(rule)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                      title="Run now"
                    >
                      <Play size={16} className="text-gray-500" />
                    </button>
                    <button
                      onClick={() => toggleRule(rule.id)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                      title={rule.enabled ? 'Pause' : 'Enable'}
                    >
                      {rule.enabled ? (
                        <Pause size={16} className="text-amber-500" />
                      ) : (
                        <Play size={16} className="text-green-500" />
                      )}
                    </button>
                    <button
                      onClick={() => setEditingRule(rule)}
                      className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
                      title="Edit"
                    >
                      <Edit2 size={16} className="text-gray-500" />
                    </button>
                    <button
                      onClick={() => deleteRule(rule.id)}
                      className="p-2 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={16} className="text-red-500" />
                    </button>
                  </div>
                </div>

                {/* Conditions */}
                {rule.conditions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-dark-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Conditions:</p>
                    <div className="flex flex-wrap gap-2">
                      {rule.conditions.map((cond, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 text-xs bg-gray-100 dark:bg-dark-700 text-gray-600 dark:text-gray-300 rounded"
                        >
                          {cond.field} {cond.operator.replace('_', ' ')} "{cond.value}"
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}

          {rules.length === 0 && (
            <div className="text-center py-12 bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
              <Zap size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                No automation rules yet
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Create your first rule to automate follow-ups
              </p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
              >
                Create First Rule
              </button>
            </div>
          )}
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === 'activity' && (
        <div className="bg-stone-100 dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700">
          <div className="divide-y divide-gray-100 dark:divide-dark-700">
            {triggeredEvents.map((event) => (
              <div key={event.id} className="p-4 flex items-start gap-3">
                <div className={`p-2 rounded-lg ${
                  event.status === 'success'
                    ? 'bg-green-100 dark:bg-green-500/20'
                    : event.status === 'pending'
                    ? 'bg-amber-100 dark:bg-amber-500/20'
                    : 'bg-red-100 dark:bg-red-500/20'
                }`}>
                  {event.status === 'success' ? (
                    <CheckCircle2 size={16} className="text-green-600 dark:text-green-400" />
                  ) : event.status === 'pending' ? (
                    <Clock size={16} className="text-amber-600 dark:text-amber-400" />
                  ) : (
                    <AlertCircle size={16} className="text-red-600 dark:text-red-400" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {event.ruleName}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Triggered for <span className="font-medium">{event.personName}</span>
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                    {event.actionTaken}
                  </p>
                </div>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  {formatTimeAgo(event.triggeredAt)}
                </span>
              </div>
            ))}

            {triggeredEvents.length === 0 && (
              <div className="p-12 text-center">
                <Activity size={48} className="mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  No automation activity yet
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-100 dark:bg-dark-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Create Automation Rule
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Rule Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={newRule.name || ''}
                  onChange={(e) => setNewRule(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g., First Visit Follow-up"
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={newRule.description || ''}
                  onChange={(e) => setNewRule(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Describe what this rule does..."
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-700 text-gray-900 dark:text-gray-100"
                />
              </div>

              {/* Trigger */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Trigger (When)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(triggerLabels) as TriggerType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewRule(prev => ({
                        ...prev,
                        trigger: { type, config: {} }
                      }))}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        newRule.trigger?.type === type
                          ? 'border-slate-500 bg-slate-50 dark:bg-slate-500/10'
                          : 'border-gray-200 dark:border-dark-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={newRule.trigger?.type === type ? 'text-slate-600' : 'text-gray-400'}>
                          {triggerLabels[type].icon}
                        </span>
                        <span className={`text-sm font-medium ${
                          newRule.trigger?.type === type
                            ? 'text-slate-700 dark:text-slate-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {triggerLabels[type].label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {triggerLabels[type].description}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Trigger Config */}
              {newRule.trigger?.type === 'visit_count' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Visit Count
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={(newRule.trigger.config.count as number) || 3}
                    onChange={(e) => setNewRule(prev => ({
                      ...prev,
                      trigger: {
                        ...prev.trigger!,
                        config: { count: parseInt(e.target.value) }
                      }
                    }))}
                    className="w-32 px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-700"
                  />
                </div>
              )}

              {newRule.trigger?.type === 'no_attendance' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Weeks without attendance
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={(newRule.trigger.config.weeks as number) || 4}
                    onChange={(e) => setNewRule(prev => ({
                      ...prev,
                      trigger: {
                        ...prev.trigger!,
                        config: { weeks: parseInt(e.target.value) }
                      }
                    }))}
                    className="w-32 px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-700"
                  />
                </div>
              )}

              {newRule.trigger?.type === 'birthday_upcoming' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Days before birthday
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={(newRule.trigger.config.daysBefore as number) || 3}
                    onChange={(e) => setNewRule(prev => ({
                      ...prev,
                      trigger: {
                        ...prev.trigger!,
                        config: { daysBefore: parseInt(e.target.value) }
                      }
                    }))}
                    className="w-32 px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-700"
                  />
                </div>
              )}

              {/* Action */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Action (Then)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {(Object.keys(actionLabels) as ActionType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => setNewRule(prev => ({
                        ...prev,
                        action: { type, config: prev.action?.config || {} }
                      }))}
                      className={`p-3 rounded-lg border text-left transition-colors ${
                        newRule.action?.type === type
                          ? 'border-slate-500 bg-slate-50 dark:bg-slate-500/10'
                          : 'border-gray-200 dark:border-dark-600 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={newRule.action?.type === type ? 'text-slate-600' : 'text-gray-400'}>
                          {actionLabels[type].icon}
                        </span>
                        <span className={`text-sm font-medium ${
                          newRule.action?.type === type
                            ? 'text-slate-700 dark:text-slate-400'
                            : 'text-gray-700 dark:text-gray-300'
                        }`}>
                          {actionLabels[type].label}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Task Config */}
              {newRule.action?.type === 'create_task' && (
                <div className="space-y-4 p-4 bg-gray-50 dark:bg-dark-700 rounded-lg">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Task Title (use {'{firstName}'}, {'{lastName}'} for personalization)
                    </label>
                    <input
                      type="text"
                      value={(newRule.action.config.title as string) || ''}
                      onChange={(e) => setNewRule(prev => ({
                        ...prev,
                        action: {
                          ...prev.action!,
                          config: { ...prev.action!.config, title: e.target.value }
                        }
                      }))}
                      placeholder="Follow up with {firstName}"
                      className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Category
                      </label>
                      <select
                        value={(newRule.action.config.category as string) || 'follow-up'}
                        onChange={(e) => setNewRule(prev => ({
                          ...prev,
                          action: {
                            ...prev.action!,
                            config: { ...prev.action!.config, category: e.target.value }
                          }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-800"
                      >
                        <option value="follow-up">Follow-up</option>
                        <option value="care">Care</option>
                        <option value="admin">Admin</option>
                        <option value="outreach">Outreach</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Priority
                      </label>
                      <select
                        value={(newRule.action.config.priority as string) || 'medium'}
                        onChange={(e) => setNewRule(prev => ({
                          ...prev,
                          action: {
                            ...prev.action!,
                            config: { ...prev.action!.config, priority: e.target.value }
                          }
                        }))}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-800"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Days until due
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={(newRule.action.config.daysUntilDue as number) || 3}
                      onChange={(e) => setNewRule(prev => ({
                        ...prev,
                        action: {
                          ...prev.action!,
                          config: { ...prev.action!.config, daysUntilDue: parseInt(e.target.value) }
                        }
                      }))}
                      className="w-32 px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-800"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateRule}
                disabled={!newRule.name || !newRule.trigger || !newRule.action}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center gap-2"
              >
                <Save size={16} />
                Create Rule
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rule Modal - Similar structure */}
      {editingRule && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-stone-100 dark:bg-dark-800 rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                Edit Rule
              </h2>
              <button
                onClick={() => setEditingRule(null)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
              >
                <X size={20} className="text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Rule Name
                </label>
                <input
                  type="text"
                  value={editingRule.name}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, name: e.target.value } : null)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-700"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={editingRule.description}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, description: e.target.value } : null)}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-dark-600 rounded-lg bg-stone-100 dark:bg-dark-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={editingRule.enabled}
                  onChange={(e) => setEditingRule(prev => prev ? { ...prev, enabled: e.target.checked } : null)}
                  className="w-4 h-4 text-slate-600 rounded"
                />
                <label htmlFor="enabled" className="text-sm text-gray-700 dark:text-gray-300">
                  Rule enabled
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingRule(null)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setRules(prev => prev.map(r => r.id === editingRule.id ? editingRule : r));
                  setEditingRule(null);
                }}
                className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg flex items-center gap-2"
              >
                <Save size={16} />
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
