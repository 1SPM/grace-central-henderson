/**
 * Agent Dashboard Component
 *
 * Displays agent status, configuration, and activity logs.
 * Allows users to enable/disable agents and view upcoming actions.
 */

import { useState, useMemo, useCallback } from 'react';
import {
  Bot,
  Cake,
  DollarSign,
  UserPlus,
  Play,
  Pause,
  Settings,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Mail,
  MessageSquare,
  Bell,
  Calendar,
  Gift,
  Users,
} from 'lucide-react';
import type {
  AgentConfig,
  AgentLog,
  AgentStats,
  LifeEventConfig,
  DonationProcessingConfig,
  NewMemberConfig,
  LifeEvent,
} from '../lib/agents/types';

interface AgentDashboardProps {
  lifeEventConfig: LifeEventConfig;
  donationConfig: DonationProcessingConfig;
  newMemberConfig: NewMemberConfig;
  upcomingLifeEvents: LifeEvent[];
  recentLogs: AgentLog[];
  stats: {
    lifeEvent: AgentStats;
    donation: AgentStats;
    newMember: AgentStats;
  };
  onToggleAgent: (agentId: string, enabled: boolean) => void;
  onUpdateConfig: (agentId: string, config: Partial<AgentConfig>) => void;
  onRunAgent: (agentId: string) => void;
}

interface AgentCardProps {
  config: AgentConfig;
  icon: React.ReactNode;
  stats: AgentStats;
  description: string;
  children?: React.ReactNode;
  onToggle: (enabled: boolean) => void;
  onRun: () => void;
  onConfigure: () => void;
}

function AgentCard({
  config,
  icon,
  stats,
  description,
  children,
  onToggle,
  onRun,
  onConfigure,
}: AgentCardProps) {
  const [expanded, setExpanded] = useState(false);

  const statusColor = config.enabled
    ? config.status === 'active'
      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
      : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
    : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400';

  const successRate =
    stats.totalActions > 0
      ? Math.round((stats.successfulActions / stats.totalActions) * 100)
      : 100;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg text-indigo-600 dark:text-indigo-400">
              {icon}
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {config.name}
              </h3>
              <span
                className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${statusColor}`}
              >
                {config.enabled ? config.status : 'Disabled'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onConfigure}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
              title="Configure"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={() => onToggle(!config.enabled)}
              className={`p-1.5 rounded-lg transition-colors ${
                config.enabled
                  ? 'text-green-600 bg-green-100 dark:bg-green-900/30 hover:bg-green-200'
                  : 'text-gray-400 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200'
              }`}
              title={config.enabled ? 'Disable' : 'Enable'}
            >
              {config.enabled ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {description}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 divide-x divide-gray-200 dark:divide-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Actions</p>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">
            {stats.totalActions}
          </p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Success</p>
          <p
            className={`text-lg font-semibold ${
              successRate >= 90
                ? 'text-green-600'
                : successRate >= 70
                  ? 'text-yellow-600'
                  : 'text-red-600'
            }`}
          >
            {successRate}%
          </p>
        </div>
        <div className="p-3 text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">Last Run</p>
          <p className="text-sm font-medium text-gray-900 dark:text-white">
            {stats.lastRunAt
              ? new Date(stats.lastRunAt).toLocaleDateString()
              : 'Never'}
          </p>
        </div>
      </div>

      {/* Expandable content */}
      {children && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full px-4 py-2 flex items-center justify-center gap-1 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 border-t border-gray-200 dark:border-gray-700"
          >
            {expanded ? (
              <>
                <ChevronUp className="w-4 h-4" /> Hide Details
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4" /> Show Details
              </>
            )}
          </button>
          {expanded && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              {children}
            </div>
          )}
        </>
      )}

      {/* Run Button */}
      {config.enabled && (
        <div className="p-3 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onRun}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
          >
            <Play className="w-4 h-4" />
            Run Now
          </button>
        </div>
      )}
    </div>
  );
}

export function AgentDashboard({
  lifeEventConfig,
  donationConfig,
  newMemberConfig,
  upcomingLifeEvents,
  recentLogs,
  stats,
  onToggleAgent,
  onUpdateConfig,
  onRunAgent,
}: AgentDashboardProps) {
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
              {Object.values(stats).reduce((sum, s) => sum + s.totalActions, 0)}
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
      />
      <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Configure {config.name}
          </h2>
        </div>

        <div className="p-4 space-y-4">
          {agentId === 'life-event-agent' && (
            <>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable Birthdays
                </span>
                <input
                  type="checkbox"
                  checked={settings.enableBirthdays as boolean}
                  onChange={(e) => updateSetting('enableBirthdays', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable Membership Anniversaries
                </span>
                <input
                  type="checkbox"
                  checked={settings.enableMembershipAnniversaries as boolean}
                  onChange={(e) =>
                    updateSetting('enableMembershipAnniversaries', e.target.checked)
                  }
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Send Email
                </span>
                <input
                  type="checkbox"
                  checked={settings.sendEmail as boolean}
                  onChange={(e) => updateSetting('sendEmail', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Send SMS
                </span>
                <input
                  type="checkbox"
                  checked={settings.sendSMS as boolean}
                  onChange={(e) => updateSetting('sendSMS', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-send (vs. notify staff)
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoSend as boolean}
                  onChange={(e) => updateSetting('autoSend', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
            </>
          )}

          {agentId === 'donation-processing-agent' && (
            <>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Auto-send Receipts
                </span>
                <input
                  type="checkbox"
                  checked={settings.autoSendReceipts as boolean}
                  onChange={(e) => updateSetting('autoSendReceipts', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Receipt Method
                </span>
                <select
                  value={settings.receiptMethod as string}
                  onChange={(e) => updateSetting('receiptMethod', e.target.value)}
                  className="rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                >
                  <option value="email">Email Only</option>
                  <option value="sms">SMS Only</option>
                  <option value="both">Both</option>
                </select>
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Track First-Time Givers
                </span>
                <input
                  type="checkbox"
                  checked={settings.trackFirstTimeGivers as boolean}
                  onChange={(e) => updateSetting('trackFirstTimeGivers', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Alert on Large Gifts
                </span>
                <input
                  type="checkbox"
                  checked={settings.alertOnLargeGifts as boolean}
                  onChange={(e) => updateSetting('alertOnLargeGifts', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Large Gift Threshold ($)
                </span>
                <input
                  type="number"
                  value={settings.largeGiftThreshold as number}
                  onChange={(e) =>
                    updateSetting('largeGiftThreshold', parseInt(e.target.value) || 0)
                  }
                  className="rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
              </label>
            </>
          )}

          {agentId === 'new-member-agent' && (
            <>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable Welcome Sequence
                </span>
                <input
                  type="checkbox"
                  checked={settings.enableWelcomeSequence as boolean}
                  onChange={(e) => updateSetting('enableWelcomeSequence', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Enable Drip Campaign
                </span>
                <input
                  type="checkbox"
                  checked={settings.enableDripCampaign as boolean}
                  onChange={(e) => updateSetting('enableDripCampaign', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex items-center justify-between">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Assign Follow-up Task
                </span>
                <input
                  type="checkbox"
                  checked={settings.assignFollowUpTask as boolean}
                  onChange={(e) => updateSetting('assignFollowUpTask', e.target.checked)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Pastor Name
                </span>
                <input
                  type="text"
                  value={settings.pastorName as string}
                  onChange={(e) => updateSetting('pastorName', e.target.value)}
                  className="rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700"
                />
              </label>
            </>
          )}
        </div>

        <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(settings)}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}
