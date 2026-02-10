/**
 * Agent Dashboard Component
 *
 * Simple automation management inspired by Breeze, Planning Center, and Churchteams.
 * Uses "When → Then" pattern for clarity.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Cake,
  DollarSign,
  UserPlus,
  Mail,
  MessageSquare,
  Zap,
  ChevronRight,
  Sparkles,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Bell,
  Calendar,
  Gift,
  Users,
  BookOpen,
  FileText,
  Lightbulb,
  ShoppingBasket,
  Bot,
} from 'lucide-react';
import type {
  AgentConfig,
  AgentLog,
  AgentStats,
  LifeEventConfig,
  DonationProcessingConfig,
  NewMemberConfig,
  SermonProgrammingConfig,
  CharityBasketConfig,
  LifeEvent,
} from '../lib/agents/types';

interface AgentDashboardProps {
  lifeEventConfig: LifeEventConfig;
  donationConfig: DonationProcessingConfig;
  newMemberConfig: NewMemberConfig;
  sermonConfig?: SermonProgrammingConfig;
  charityBasketConfig?: CharityBasketConfig;
  upcomingLifeEvents: LifeEvent[];
  recentLogs: AgentLog[];
  stats: {
    lifeEvent: AgentStats;
    donation: AgentStats;
    newMember: AgentStats;
    sermon?: AgentStats;
    charityBasket?: AgentStats;
  };
  onToggleAgent: (agentId: string, enabled: boolean) => void;
  onUpdateConfig: (agentId: string, config: Partial<AgentConfig>) => void;
  onRunAgent: (agentId: string) => void;
  onGenerateSermon?: (topic: string, scripture?: string) => void;
}

// Simple toggle switch component
function Toggle({
  enabled,
  onChange,
  label,
}: {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-gray-600'
      }`}
      aria-label={label}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// Automation rule card - simple "When X → Then Y" pattern
function AutomationCard({
  icon,
  iconBg,
  title,
  trigger,
  action,
  enabled,
  onToggle,
  hasAI,
  onToggleAI,
  aiEnabled,
  children,
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  trigger: string;
  action: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  hasAI?: boolean;
  onToggleAI?: (enabled: boolean) => void;
  aiEnabled?: boolean;
  children?: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`bg-white dark:bg-gray-800 rounded-lg border transition-all ${
        enabled
          ? 'border-indigo-200 dark:border-indigo-800 shadow-sm'
          : 'border-gray-200 dark:border-gray-700 opacity-75'
      }`}
    >
      <div className="p-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${iconBg}`}>{icon}</div>
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white">{title}</h3>
              {enabled && aiEnabled && (
                <span className="inline-flex items-center gap-1 text-xs text-purple-600 dark:text-purple-400">
                  <Sparkles className="w-3 h-3" /> AI personalization on
                </span>
              )}
            </div>
          </div>
          <Toggle enabled={enabled} onChange={onToggle} label={`Toggle ${title}`} />
        </div>

        {/* When → Then description */}
        <div className="flex items-start gap-2 text-sm">
          <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded text-xs font-medium shrink-0">
            When
          </span>
          <span className="text-gray-700 dark:text-gray-300">{trigger}</span>
        </div>
        <div className="flex items-start gap-2 text-sm mt-2">
          <span className="px-2 py-0.5 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded text-xs font-medium shrink-0">
            Then
          </span>
          <span className="text-gray-700 dark:text-gray-300">{action}</span>
        </div>

        {/* AI toggle if available */}
        {hasAI && enabled && (
          <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <Sparkles className="w-4 h-4 text-purple-500" />
                Use AI for personalized messages
              </span>
              <Toggle
                enabled={aiEnabled || false}
                onChange={onToggleAI || (() => {})}
                label="Toggle AI messages"
              />
            </label>
          </div>
        )}

        {/* Expandable options */}
        {children && enabled && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 flex items-center gap-1 text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-700"
          >
            <ChevronRight
              className={`w-4 h-4 transition-transform ${expanded ? 'rotate-90' : ''}`}
            />
            {expanded ? 'Hide options' : 'More options'}
          </button>
        )}

        {expanded && children && <div className="mt-3 space-y-3">{children}</div>}
      </div>
    </div>
  );
}

// Simple option toggle row
function OptionRow({
  label,
  enabled,
  onChange,
}: {
  label: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between py-2 cursor-pointer">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <Toggle enabled={enabled} onChange={onChange} />
    </label>
  );
}

export function AgentDashboard({
  lifeEventConfig,
  donationConfig,
  newMemberConfig,
  sermonConfig,
  charityBasketConfig,
  upcomingLifeEvents,
  recentLogs,
  stats,
  onToggleAgent,
  onUpdateConfig,
  onRunAgent,
  onGenerateSermon: _onGenerateSermon,
}: AgentDashboardProps) {
  // Note: _onGenerateSermon will be used in sermon generation modal (future enhancement)
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'upcoming'>('overview');
  const [configModal, setConfigModal] = useState<string | null>(null);

  // Filter logs by level
  const errorLogs = useMemo(
    () => recentLogs.filter((log) => log.level === 'error'),
    [recentLogs]
  );

  const handleConfigSave = useCallback(
    (agentId: string, settings: Record<string, unknown>) => {
      onUpdateConfig(agentId, { settings });
      setConfigModal(null);
    },
    [onUpdateConfig]
  );

  // Inline settings update helper (from simple automation view)
  const updateSettings = (agentId: string, key: string, value: unknown) => {
    const config =
      agentId === 'life-event-agent'
        ? lifeEventConfig
        : agentId === 'donation-processing-agent'
          ? donationConfig
          : newMemberConfig;
    onUpdateConfig(agentId, { settings: { ...config.settings, [key]: value } });
  };

  const totalActions = Object.values(stats).reduce((sum, s) => sum + s.totalActions, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
            <Bot className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              AI Agents
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Automate engagement, finance, and pastoral care
            </p>
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-2xl font-bold text-indigo-600">
              {totalActions}
            </p>
            <p className="text-xs text-gray-500">Total Actions</p>
          </div>
          {errorLogs.length > 0 && (
            <div className="flex items-center gap-1 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-full">
              <AlertCircle className="w-4 h-4" />
              <span className="text-sm font-medium">{errorLogs.length} errors</span>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex gap-4">
          {(['overview', 'upcoming', 'logs'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Life Event Agent */}
          <AgentCard
            config={lifeEventConfig}
            icon={<Cake className="w-5 h-5" />}
            stats={stats.lifeEvent}
            description="Sends birthday and anniversary greetings automatically"
            onToggle={(enabled) => onToggleAgent('life-event-agent', enabled)}
            onRun={() => onRunAgent('life-event-agent')}
            onConfigure={() => setConfigModal('life-event-agent')}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Birthdays</span>
                <span
                  className={
                    lifeEventConfig.settings.enableBirthdays
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }
                >
                  {lifeEventConfig.settings.enableBirthdays ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Membership Anniversaries
                </span>
                <span
                  className={
                    lifeEventConfig.settings.enableMembershipAnniversaries
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }
                >
                  {lifeEventConfig.settings.enableMembershipAnniversaries
                    ? 'Enabled'
                    : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <Mail className="w-4 h-4" />
                <span>Email: {lifeEventConfig.settings.sendEmail ? 'On' : 'Off'}</span>
                <MessageSquare className="w-4 h-4 ml-2" />
                <span>SMS: {lifeEventConfig.settings.sendSMS ? 'On' : 'Off'}</span>
              </div>
            </div>
          </AgentCard>

          {/* Donation Processing Agent */}
          <AgentCard
            config={donationConfig}
            icon={<DollarSign className="w-5 h-5" />}
            stats={stats.donation}
            description="Processes donations with receipts and thank-you messages"
            onToggle={(enabled) => onToggleAgent('donation-processing-agent', enabled)}
            onRun={() => onRunAgent('donation-processing-agent')}
            onConfigure={() => setConfigModal('donation-processing-agent')}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Auto Receipts</span>
                <span
                  className={
                    donationConfig.settings.autoSendReceipts
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }
                >
                  {donationConfig.settings.autoSendReceipts ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  First-Time Giver Tracking
                </span>
                <span
                  className={
                    donationConfig.settings.trackFirstTimeGivers
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }
                >
                  {donationConfig.settings.trackFirstTimeGivers ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Large Gift Alert
                </span>
                <span className="text-gray-900 dark:text-white">
                  ${donationConfig.settings.largeGiftThreshold}+
                </span>
              </div>
            </div>
          </AgentCard>

          {/* New Member Agent */}
          <AgentCard
            config={newMemberConfig}
            icon={<UserPlus className="w-5 h-5" />}
            stats={stats.newMember}
            description="Onboards new members with welcome sequences"
            onToggle={(enabled) => onToggleAgent('new-member-agent', enabled)}
            onRun={() => onRunAgent('new-member-agent')}
            onConfigure={() => setConfigModal('new-member-agent')}
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Welcome Sequence
                </span>
                <span
                  className={
                    newMemberConfig.settings.enableWelcomeSequence
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }
                >
                  {newMemberConfig.settings.enableWelcomeSequence ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Drip Campaign</span>
                <span
                  className={
                    newMemberConfig.settings.enableDripCampaign
                      ? 'text-green-600'
                      : 'text-gray-400'
                  }
                >
                  {newMemberConfig.settings.enableDripCampaign ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Drip Days: {newMemberConfig.settings.dripCampaignDays.join(', ')}
              </div>
            </div>
          </AgentCard>

          {/* Sermon Programming Agent */}
          {sermonConfig && stats.sermon && (
            <AgentCard
              config={sermonConfig}
              icon={<BookOpen className="w-5 h-5" />}
              stats={stats.sermon}
              description="Generate sermon outlines, series plans, and illustrations"
              onToggle={(enabled) => onToggleAgent('sermon-programming-agent', enabled)}
              onRun={() => onRunAgent('sermon-programming-agent')}
              onConfigure={() => setConfigModal('sermon-programming-agent')}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Sermon Outlines</span>
                  <span
                    className={
                      sermonConfig.settings.enableSermonOutlines
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }
                  >
                    {sermonConfig.settings.enableSermonOutlines ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Series Planning</span>
                  <span
                    className={
                      sermonConfig.settings.enableSeriesPlanning
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }
                  >
                    {sermonConfig.settings.enableSeriesPlanning ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <FileText className="w-4 h-4" />
                  <span>Style: {sermonConfig.settings.preferredStyle}</span>
                  <Lightbulb className="w-4 h-4 ml-2" />
                  <span>Illustrations: {sermonConfig.settings.enableIllustrations ? 'On' : 'Off'}</span>
                </div>
              </div>
            </AgentCard>
          )}

          {/* Charity Basket Automation Agent */}
          {charityBasketConfig && stats.charityBasket && (
            <AgentCard
              config={charityBasketConfig}
              icon={<ShoppingBasket className="w-5 h-5" />}
              stats={stats.charityBasket}
              description="Automate weekly charity basket reminders and holiday scheduling"
              onToggle={(enabled) => onToggleAgent('charity-basket-agent', enabled)}
              onRun={() => onRunAgent('charity-basket-agent')}
              onConfigure={() => setConfigModal('charity-basket-agent')}
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Weekly Reminders</span>
                  <span
                    className={
                      charityBasketConfig.settings.enableWeeklyReminders
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }
                  >
                    {charityBasketConfig.settings.enableWeeklyReminders ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Auto Create Baskets</span>
                  <span
                    className={
                      charityBasketConfig.settings.enableAutoBasketCreation
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }
                  >
                    {charityBasketConfig.settings.enableAutoBasketCreation ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Calendar className="w-4 h-4" />
                  <span className="capitalize">Reminder Day: {charityBasketConfig.settings.reminderDay}</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {charityBasketConfig.settings.holidaySchedule.thanksgiving && (
                    <span className="text-xs px-2 py-0.5 bg-orange-100 dark:bg-orange-500/15 text-orange-700 dark:text-orange-400 rounded">Thanksgiving</span>
                  )}
                  {charityBasketConfig.settings.holidaySchedule.christmas && (
                    <span className="text-xs px-2 py-0.5 bg-red-100 dark:bg-red-500/15 text-red-700 dark:text-red-400 rounded">Christmas</span>
                  )}
                  {charityBasketConfig.settings.holidaySchedule.easter && (
                    <span className="text-xs px-2 py-0.5 bg-purple-100 dark:bg-purple-500/15 text-purple-700 dark:text-purple-400 rounded">Easter</span>
                  )}
                  {charityBasketConfig.settings.holidaySchedule.backToSchool && (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400 rounded">Back to School</span>
                  )}
                </div>
              </div>
            </AgentCard>
          )}
        </div>
      )}

      {activeTab === 'upcoming' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-indigo-600" />
              Upcoming Life Events (Next 7 Days)
            </h2>
          </div>

          {upcomingLifeEvents.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No upcoming life events in the next 7 days</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
              {upcomingLifeEvents.map((event, idx) => (
                <div
                  key={`${event.personId}-${event.type}-${idx}`}
                  className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        event.type === 'birthday'
                          ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                      }`}
                    >
                      {event.type === 'birthday' ? (
                        <Cake className="w-5 h-5" />
                      ) : (
                        <Users className="w-5 h-5" />
                      )}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {event.personName}
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {event.type === 'birthday'
                          ? `Birthday${event.yearsCount ? ` - Turning ${event.yearsCount}` : ''}`
                          : `${event.yearsCount} Year Membership Anniversary`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {new Date(event.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      {event.email && <Mail className="w-3 h-3" />}
                      {event.phone && <MessageSquare className="w-3 h-3" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <h2 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-600" />
              Recent Activity
            </h2>
          </div>

          {recentLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-500 dark:text-gray-400">
              <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No recent activity logs</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {recentLogs.slice(0, 50).map((log) => (
                <div
                  key={log.id}
                  className="p-3 flex items-start gap-3 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                >
                  <div
                    className={`mt-0.5 ${
                      log.level === 'error'
                        ? 'text-red-500'
                        : log.level === 'warning'
                          ? 'text-yellow-500'
                          : 'text-green-500'
                    }`}
                  >
                    {log.level === 'error' ? (
                      <XCircle className="w-4 h-4" />
                    ) : log.level === 'warning' ? (
                      <AlertCircle className="w-4 h-4" />
                    ) : (
                      <CheckCircle className="w-4 h-4" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white">
                      {log.message}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {new Date(log.timestamp).toLocaleString()} • {log.agentId}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Configuration Modal */}
      {configModal && (
        <AgentConfigModal
          agentId={configModal}
          config={
            configModal === 'life-event-agent'
              ? lifeEventConfig
              : configModal === 'donation-processing-agent'
                ? donationConfig
                : configModal === 'sermon-programming-agent' && sermonConfig
                  ? sermonConfig
                  : newMemberConfig
          }
          onSave={(settings) => handleConfigSave(configModal, settings)}
          onClose={() => setConfigModal(null)}
        />
      )}
    </div>
  );
}

// Configuration Modal Component
function AgentConfigModal({
  agentId,
  config,
  onSave,
  onClose,
}: {
  agentId: string;
  config: AgentConfig;
  onSave: (settings: Record<string, unknown>) => void;
  onClose: () => void;
}) {
  const [settings, setSettings] = useState(config.settings);

  const updateSetting = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Configure {agentId}
        </h2>
        <div className="space-y-3">
          {Object.entries(settings).map(([key, value]) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">{key}</span>
              {typeof value === 'boolean' ? (
                <Toggle enabled={value} onChange={(v) => updateSetting(key, v)} />
              ) : (
                <input
                  type="text"
                  value={String(value)}
                  onChange={(e) => updateSetting(key, e.target.value)}
                  className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                />
              )}
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(settings)}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// Simplified automation-focused dashboard view
export function AgentDashboardSimple({
  lifeEventConfig,
  donationConfig,
  newMemberConfig,
  upcomingLifeEvents,
  recentLogs,
  stats,
  onToggleAgent,
  onUpdateConfig,
}: AgentDashboardProps) {
  const totalActions = Object.values(stats).reduce((sum, s) => sum + s.totalActions, 0);

  const updateSettings = (agentId: string, key: string, value: unknown) => {
    const config =
      agentId === 'life-event-agent'
        ? lifeEventConfig
        : agentId === 'donation-processing-agent'
          ? donationConfig
          : newMemberConfig;
    onUpdateConfig(agentId, { settings: { ...config.settings, [key]: value } });
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Automations</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Set it and forget it. Automations run in the background.
          </p>
        </div>
        {totalActions > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold text-indigo-600">{totalActions}</p>
            <p className="text-xs text-gray-500">messages sent</p>
          </div>
        )}
      </div>

      {/* Automations Grid */}
      <div className="space-y-4">
        {/* Birthdays & Anniversaries */}
        <AutomationCard
          icon={<Cake className="w-5 h-5 text-pink-600" />}
          iconBg="bg-pink-100 dark:bg-pink-900/30"
          title="Birthday & Anniversary Greetings"
          trigger="Someone has a birthday or membership anniversary"
          action="Send them a personalized greeting via email or SMS"
          enabled={lifeEventConfig.enabled}
          onToggle={(enabled) => onToggleAgent('life-event-agent', enabled)}
          hasAI
          aiEnabled={lifeEventConfig.settings.useAIMessages}
          onToggleAI={(enabled) => updateSettings('life-event-agent', 'useAIMessages', enabled)}
        >
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
            <OptionRow
              label="Birthdays"
              enabled={lifeEventConfig.settings.enableBirthdays}
              onChange={(v) => updateSettings('life-event-agent', 'enableBirthdays', v)}
            />
            <OptionRow
              label="Membership anniversaries"
              enabled={lifeEventConfig.settings.enableMembershipAnniversaries}
              onChange={(v) =>
                updateSettings('life-event-agent', 'enableMembershipAnniversaries', v)
              }
            />
            <OptionRow
              label="Send via email"
              enabled={lifeEventConfig.settings.sendEmail}
              onChange={(v) => updateSettings('life-event-agent', 'sendEmail', v)}
            />
            <OptionRow
              label="Send via SMS"
              enabled={lifeEventConfig.settings.sendSMS}
              onChange={(v) => updateSettings('life-event-agent', 'sendSMS', v)}
            />
          </div>
        </AutomationCard>

        {/* Donation Thank You */}
        <AutomationCard
          icon={<DollarSign className="w-5 h-5 text-green-600" />}
          iconBg="bg-green-100 dark:bg-green-900/30"
          title="Donation Receipts & Thank You"
          trigger="Someone makes a donation"
          action="Send a receipt and personalized thank-you message"
          enabled={donationConfig.enabled}
          onToggle={(enabled) => onToggleAgent('donation-processing-agent', enabled)}
          hasAI
          aiEnabled={donationConfig.settings.useAIMessages}
          onToggleAI={(enabled) =>
            updateSettings('donation-processing-agent', 'useAIMessages', enabled)
          }
        >
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
            <OptionRow
              label="Auto-send receipts"
              enabled={donationConfig.settings.autoSendReceipts}
              onChange={(v) => updateSettings('donation-processing-agent', 'autoSendReceipts', v)}
            />
            <OptionRow
              label="Track first-time givers"
              enabled={donationConfig.settings.trackFirstTimeGivers}
              onChange={(v) =>
                updateSettings('donation-processing-agent', 'trackFirstTimeGivers', v)
              }
            />
            <OptionRow
              label="Alert on large gifts"
              enabled={donationConfig.settings.alertOnLargeGifts}
              onChange={(v) => updateSettings('donation-processing-agent', 'alertOnLargeGifts', v)}
            />
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Large gift threshold</span>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">$</span>
                <input
                  type="number"
                  value={donationConfig.settings.largeGiftThreshold}
                  onChange={(e) =>
                    updateSettings(
                      'donation-processing-agent',
                      'largeGiftThreshold',
                      parseInt(e.target.value) || 0
                    )
                  }
                  className="w-20 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                />
              </div>
            </div>

            {/* Lapsed Giver Detection */}
            <div className="border-t border-gray-100 dark:border-gray-700 pt-3 mt-3">
              <OptionRow
                label="Detect lapsed givers"
                enabled={donationConfig.settings.detectLapsedGivers ?? false}
                onChange={(v) => updateSettings('donation-processing-agent', 'detectLapsedGivers', v)}
              />
              {donationConfig.settings.detectLapsedGivers && (
                <>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Days without giving
                    </span>
                    <input
                      type="number"
                      value={donationConfig.settings.lapsedGiverDays ?? 30}
                      onChange={(e) =>
                        updateSettings(
                          'donation-processing-agent',
                          'lapsedGiverDays',
                          parseInt(e.target.value) || 30
                        )
                      }
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                    />
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      Min. past donations
                    </span>
                    <input
                      type="number"
                      value={donationConfig.settings.lapsedGiverMinDonations ?? 3}
                      onChange={(e) =>
                        updateSettings(
                          'donation-processing-agent',
                          'lapsedGiverMinDonations',
                          parseInt(e.target.value) || 3
                        )
                      }
                      className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        </AutomationCard>

        {/* New Member Welcome */}
        <AutomationCard
          icon={<UserPlus className="w-5 h-5 text-indigo-600" />}
          iconBg="bg-indigo-100 dark:bg-indigo-900/30"
          title="New Member Welcome"
          trigger="Someone joins as a new member"
          action="Send a welcome message and start follow-up sequence"
          enabled={newMemberConfig.enabled}
          onToggle={(enabled) => onToggleAgent('new-member-agent', enabled)}
          hasAI
          aiEnabled={newMemberConfig.settings.useAIMessages}
          onToggleAI={(enabled) => updateSettings('new-member-agent', 'useAIMessages', enabled)}
        >
          <div className="border-t border-gray-100 dark:border-gray-700 pt-3 space-y-1">
            <OptionRow
              label="Welcome email sequence"
              enabled={newMemberConfig.settings.enableWelcomeSequence}
              onChange={(v) => updateSettings('new-member-agent', 'enableWelcomeSequence', v)}
            />
            <OptionRow
              label="Follow-up drip campaign"
              enabled={newMemberConfig.settings.enableDripCampaign}
              onChange={(v) => updateSettings('new-member-agent', 'enableDripCampaign', v)}
            />
            <OptionRow
              label="Create follow-up task for staff"
              enabled={newMemberConfig.settings.assignFollowUpTask}
              onChange={(v) => updateSettings('new-member-agent', 'assignFollowUpTask', v)}
            />
          </div>
        </AutomationCard>
      </div>

      {/* Coming Soon - Missing Features from Competitors */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">Coming Soon</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <ComingSoonCard
            icon={<Zap className="w-4 h-4" />}
            title="Custom Workflows"
            description="Build your own multi-step automations"
          />
          <ComingSoonCard
            icon={<Clock className="w-4 h-4" />}
            title="Scheduled Reports"
            description="Auto-email weekly giving & attendance summaries"
          />
        </div>
      </div>

      {/* Upcoming Events Preview */}
      {upcomingLifeEvents.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Upcoming This Week
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {upcomingLifeEvents.slice(0, 5).map((event, idx) => (
              <div
                key={`${event.personId}-${idx}`}
                className="p-3 flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-1.5 rounded ${
                      event.type === 'birthday'
                        ? 'bg-pink-100 text-pink-600'
                        : 'bg-purple-100 text-purple-600'
                    }`}
                  >
                    <Cake className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white text-sm">
                      {event.personName}
                    </p>
                    <p className="text-xs text-gray-500">
                      {event.type === 'birthday' ? 'Birthday' : 'Anniversary'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  {event.email && <Mail className="w-3 h-3" />}
                  {event.phone && <MessageSquare className="w-3 h-3" />}
                  <span>
                    {new Date(event.date).toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentLogs.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
            Recent Activity
          </h2>
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
            {recentLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="p-3 flex items-start gap-3">
                <div
                  className={`mt-0.5 ${
                    log.level === 'error'
                      ? 'text-red-500'
                      : log.level === 'warning'
                        ? 'text-yellow-500'
                        : 'text-green-500'
                  }`}
                >
                  {log.level === 'error' ? (
                    <XCircle className="w-4 h-4" />
                  ) : log.level === 'warning' ? (
                    <AlertCircle className="w-4 h-4" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-900 dark:text-white">{log.message}</p>
                  <p className="text-xs text-gray-500">
                    <Clock className="w-3 h-3 inline mr-1" />
                    {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Coming soon feature placeholder
function ComingSoonCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-dashed border-gray-300 dark:border-gray-600">
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        {icon}
        <span className="font-medium text-sm">{title}</span>
      </div>
      <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{description}</p>
    </div>
  );
}
