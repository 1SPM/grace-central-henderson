/**
 * Agent Dashboard Component
 *
 * Simple automation management inspired by Breeze, Planning Center, and Churchteams.
 * Uses "When → Then" pattern for clarity.
 */

import { useState } from 'react';
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
  TrendingDown,
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
            icon={<TrendingDown className="w-4 h-4" />}
            title="Lapsed Giver Alerts"
            description="Get notified when regular donors stop giving"
          />
          <ComingSoonCard
            icon={<Zap className="w-4 h-4" />}
            title="Custom Workflows"
            description="Build your own multi-step automations"
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
