/**
 * Settings → Automation tab.
 *
 * Shows the pastor what GRACE does on her own: the daily rhythms
 * (scheduled jobs), the agent roster under discovery-aligned names,
 * connected services, offerings, and recent agent activity. Fed by
 * GET /api/automation/status; messaging toggles go through the
 * existing /api/agents/settings route.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Bot,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Play,
  Sparkles,
  XCircle,
} from 'lucide-react';
import { supabase, isSupabaseConfigured, getClerkTokenProvider } from '../../lib/supabase';
import { CATALOG_AGENTS, CATALOG_OFFERINGS, GROUP_LABELS, type AgentGroup } from '../../lib/automationCatalog';
import { TENANT_TIMEZONE } from '../../config/tenant';
import { useToast } from '../Toast';
import { createLogger } from '../../utils/logger';

const log = createLogger('automation-panel');

interface CronStatus {
  job: string;
  schedule: string;
  label: string;
  description: string;
  last_run: { ran_at: string; ok: boolean; duration_ms: number | null; summary: Record<string, unknown> | null } | null;
}

interface AutomationStatus {
  crons: CronStatus[];
  agents: {
    server: Array<{ id: string; enabled: boolean }>;
    messaging: Array<{ id: string; enabled: boolean; configured: boolean }>;
    thresholds: {
      member_care_inactive_days: number;
      stewardship_lapsed_days: number;
      stewardship_large_gift_usd: number;
      operations_event_no_leader_days: number;
    };
  };
  services: Record<string, { configured: boolean; detail?: string }>;
}

interface ActivityRow {
  id: string;
  agent_id: string;
  message: string;
  created_at: string;
}

async function authHeaders(): Promise<Record<string, string> | null> {
  const provider = getClerkTokenProvider();
  const token = provider ? await provider() : null;
  if (!token) return null;
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/** '0 7 * * *' → 'Every morning at 7:00 AM UTC (11:00 PM your time)'-style label. */
function scheduleLabel(schedule: string, timezone: string): string {
  const m = schedule.match(/^(\d+)\s+(\d+)\s+\*\s+\*\s+\*$/);
  if (!m) return schedule;
  const utcDate = new Date();
  utcDate.setUTCHours(Number(m[2]), Number(m[1]), 0, 0);
  const local = utcDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: timezone });
  return `Each day around ${local}`;
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(ms / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const SERVICE_LABELS: Record<string, { name: string; powers: string }> = {
  voice: { name: 'Neural voice', powers: "GRACE's spoken replies and tour narration" },
  ai: { name: 'AI assistant', powers: 'Ask GRACE, the Monday Brief, and message drafting' },
  email: { name: 'Email', powers: 'Welcome sequences, thank-yous, and birthday greetings' },
  sms: { name: 'Text messaging', powers: 'Text follow-ups and reminders' },
  stripe: { name: 'Giving rails', powers: 'Online giving and reconciliation' },
  supabase: { name: 'Database', powers: 'People, giving, care, and event records' },
};

export function AutomationPanel({ churchId }: { churchId: string }) {
  const toast = useToast();
  const [status, setStatus] = useState<AutomationStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [running, setRunning] = useState(false);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [togglePending, setTogglePending] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      setDemoMode(true);
      setLoading(false);
      return;
    }
    try {
      const res = await fetch('/api/automation/status', { headers });
      if (!res.ok) throw new Error(`status ${res.status}`);
      setStatus(await res.json() as AutomationStatus);
    } catch (err) {
      log.warn('automation status unavailable', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  // Recent agent observations (same source as the notification bell).
  useEffect(() => {
    if (!churchId || !isSupabaseConfigured() || !supabase) return;
    const sb = supabase;
    let cancelled = false;
    void (async () => {
      const sinceIso = new Date(Date.now() - 7 * 86_400_000).toISOString();
      const { data } = await sb
        .from('agent_logs')
        .select('id, agent_id, message, created_at')
        .eq('church_id', churchId)
        .like('message', 'observation:%')
        .gte('created_at', sinceIso)
        .order('created_at', { ascending: false })
        .limit(20);
      if (!cancelled && data) setActivity(data as ActivityRow[]);
    })();
    return () => { cancelled = true; };
  }, [churchId]);

  const runNow = useCallback(async () => {
    const headers = await authHeaders();
    if (!headers) {
      toast.error('Sign in to run the agents.');
      return;
    }
    setRunning(true);
    try {
      const res = await fetch('/api/agents/run', { method: 'POST', headers });
      const body = await res.json().catch(() => null) as { result?: { observationsWritten?: number } } | null;
      if (!res.ok) throw new Error('run failed');
      const written = body?.result?.observationsWritten ?? 0;
      toast.success(written > 0
        ? `Done — ${written} new observation${written === 1 ? '' : 's'} for you.`
        : 'Done — nothing new needed your attention.');
      void loadStatus();
    } catch {
      toast.error("The agents couldn't run just now. Try again in a moment.");
    } finally {
      setRunning(false);
    }
  }, [toast, loadStatus]);

  const toggleMessagingAgent = useCallback(async (agentId: string, enable: boolean) => {
    const headers = await authHeaders();
    if (!headers) {
      toast.error('Sign in to change agent settings.');
      return;
    }
    setTogglePending(agentId);
    try {
      // Read-modify-write the full messaging_settings so we never wipe config.
      const getRes = await fetch('/api/agents/settings', { headers });
      if (!getRes.ok) throw new Error('settings read failed');
      const data = await getRes.json() as { messaging_settings?: Record<string, Record<string, unknown>> };
      const settings = data.messaging_settings ?? {};
      settings[agentId] = { ...(settings[agentId] ?? {}), enabled: enable };
      const putRes = await fetch('/api/agents/settings', {
        method: 'PUT',
        headers,
        body: JSON.stringify({ messaging_settings: settings }),
      });
      if (!putRes.ok) throw new Error('settings write failed');
      setStatus(prev => prev ? {
        ...prev,
        agents: {
          ...prev.agents,
          messaging: prev.agents.messaging.map(a => a.id === agentId ? { ...a, enabled: enable, configured: true } : a),
        },
      } : prev);
    } catch {
      toast.error("Couldn't save that change. Try again in a moment.");
    } finally {
      setTogglePending(null);
    }
  }, [toast]);

  const enabledById = useMemo(() => {
    const m = new Map<string, boolean>();
    for (const a of status?.agents.server ?? []) m.set(a.id, a.enabled);
    for (const a of status?.agents.messaging ?? []) m.set(a.id, a.enabled);
    return m;
  }, [status]);

  const agentsByGroup = useMemo(() => {
    const groups = new Map<AgentGroup, typeof CATALOG_AGENTS>();
    for (const agent of CATALOG_AGENTS) {
      groups.set(agent.group, [...(groups.get(agent.group) ?? []), agent]);
    }
    return groups;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400 dark:text-dark-500">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 pt-6 pb-12 max-w-5xl mx-auto space-y-8">
      {demoMode && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          You're in demo mode — sign in to see live automation status for your church.
        </div>
      )}

      {/* Daily rhythms */}
      <section>
        <div className="flex items-center justify-between mb-1">
          <h2 className="serif text-xl text-slate-900 dark:text-dark-100 flex items-center gap-2">
            <Clock size={18} className="text-indigo-500" />
            GRACE's Daily Rhythms
          </h2>
          <button
            type="button"
            onClick={() => void runNow()}
            disabled={running || demoMode}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg transition-colors"
          >
            {running ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
            {running ? 'Looking now…' : 'Have a look now'}
          </button>
        </div>
        <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
          While you rest, GRACE keeps watch. Here's what she does each day, and when she last did it.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          {(status?.crons ?? []).map((cron) => (
            <div key={cron.job} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold text-gray-900 dark:text-dark-100">{cron.label}</div>
                  <div className="text-xs text-gray-400 dark:text-dark-500 mt-0.5">{scheduleLabel(cron.schedule, TENANT_TIMEZONE)}</div>
                </div>
                {cron.last_run ? (
                  cron.last_run.ok
                    ? <CheckCircle2 size={16} className="text-emerald-500 shrink-0 mt-0.5" />
                    : <XCircle size={16} className="text-brand-500 shrink-0 mt-0.5" />
                ) : (
                  <Circle size={16} className="text-gray-300 dark:text-dark-600 shrink-0 mt-0.5" />
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-2 leading-relaxed">{cron.description}</p>
              <div className="text-[11px] text-gray-400 dark:text-dark-500 mt-2">
                {cron.last_run
                  ? `Last ran ${timeAgo(cron.last_run.ran_at)}${cron.last_run.ok ? '' : ' — needs attention'}`
                  : 'No runs recorded yet'}
              </div>
            </div>
          ))}
          {!status && !demoMode && (
            <div className="text-sm text-gray-400 dark:text-dark-500 col-span-2">
              Couldn't reach the automation status just now.
            </div>
          )}
        </div>
      </section>

      {/* Agents */}
      <section>
        <h2 className="serif text-xl text-slate-900 dark:text-dark-100 flex items-center gap-2 mb-1">
          <Bot size={18} className="text-indigo-500" />
          Your Agents
        </h2>
        <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
          Each agent watches one part of church life and prepares work for you — nothing is sent or changed without a person in the loop.
        </p>
        <div className="space-y-5">
          {(['care', 'giving', 'operations', 'messaging'] as AgentGroup[]).map((group) => (
            <div key={group}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-2">
                {GROUP_LABELS[group]}
              </h3>
              <div className="space-y-2">
                {(agentsByGroup.get(group) ?? []).map((agent) => {
                  const enabled = enabledById.get(agent.id) ?? !agent.messaging;
                  return (
                    <div key={agent.id} className="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-4">
                      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-dark-600'}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-dark-100">{agent.name}</div>
                        <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5 leading-relaxed">{agent.description}</p>
                      </div>
                      {agent.messaging ? (
                        <button
                          type="button"
                          disabled={togglePending === agent.id || demoMode}
                          onClick={() => void toggleMessagingAgent(agent.id, !enabled)}
                          className={`relative shrink-0 w-9 h-5 rounded-full transition-colors ${enabled ? 'bg-indigo-600' : 'bg-gray-300 dark:bg-dark-600'} disabled:opacity-50`}
                          aria-label={`${enabled ? 'Disable' : 'Enable'} ${agent.name}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${enabled ? 'left-[18px]' : 'left-0.5'}`} />
                        </button>
                      ) : (
                        <span className="text-[11px] text-gray-400 dark:text-dark-500 shrink-0 mt-0.5">
                          {enabled ? 'Active' : 'Off'}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        {status && (
          <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-3">
            Care check-ins after {status.agents.thresholds.member_care_inactive_days} quiet days · lapsed givers after {status.agents.thresholds.stewardship_lapsed_days} days · large gifts from ${status.agents.thresholds.stewardship_large_gift_usd.toLocaleString()} · event leader checks {status.agents.thresholds.operations_event_no_leader_days} days out
          </p>
        )}
      </section>

      {/* Connected services */}
      <section>
        <h2 className="serif text-xl text-slate-900 dark:text-dark-100 flex items-center gap-2 mb-1">
          <Activity size={18} className="text-indigo-500" />
          Connected Services
        </h2>
        <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
          The connections GRACE relies on to do her work.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Object.entries(SERVICE_LABELS).map(([key, meta]) => {
            const svc = status?.services?.[key];
            const ok = svc?.configured ?? false;
            return (
              <div key={key} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-3.5">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${ok ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-dark-600'}`} />
                  <span className="text-sm font-medium text-gray-900 dark:text-dark-100">{meta.name}</span>
                </div>
                <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-1.5 leading-relaxed">
                  {svc?.detail ?? meta.powers}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Offerings */}
      <section>
        <h2 className="serif text-xl text-slate-900 dark:text-dark-100 flex items-center gap-2 mb-1">
          <Sparkles size={18} className="text-indigo-500" />
          More from GRACE
        </h2>
        <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
          Available for your church — talk to your GRACE team when you're ready.
        </p>
        <div className="grid sm:grid-cols-2 gap-2">
          {CATALOG_OFFERINGS.map((offering) => (
            <div key={offering.name} className="rounded-lg border border-dashed border-gray-200 dark:border-dark-700 px-3.5 py-2.5">
              <div className="text-sm text-gray-700 dark:text-dark-200">{offering.name}</div>
              <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-0.5">{offering.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="serif text-xl text-slate-900 dark:text-dark-100 mb-1">Recent Activity</h2>
        <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
          What the agents noticed over the last week.
        </p>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-dark-500">
            Nothing yet — after the next morning review, observations will appear here.
          </p>
        ) : (
          <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 divide-y divide-gray-100 dark:divide-dark-700/50">
            {activity.map((row) => {
              const agent = CATALOG_AGENTS.find(a => a.id === row.agent_id);
              const kind = row.message.slice('observation:'.length).replace(/[_-]/g, ' ');
              return (
                <div key={row.id} className="flex items-center gap-3 px-4 py-2.5">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-gray-700 dark:text-dark-200 capitalize">{kind}</span>
                    <span className="text-xs text-gray-400 dark:text-dark-500 ml-2">{agent?.name ?? row.agent_id}</span>
                  </div>
                  <span className="text-[11px] text-gray-400 dark:text-dark-500 shrink-0">{timeAgo(row.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
