/**
 * Accountable agent-findings lifecycle: everything an agent has flagged,
 * with status chips, per-agent precision stats, and Triage / Dismiss /
 * Resolve / Convert-to-Work-Order actions. Sits below the agent registry
 * grid in the Command Centre.
 */
import { useState } from 'react';
import { CheckCircle2, ClipboardList, Workflow } from 'lucide-react';
import { useAgentFindings, type AgentFindingStatus } from '../../hooks/useAgentFindings';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { EmptyState } from '../ui/EmptyState';
import { StatusBadge } from '../ui/StatusBadge';

const STATUS_FILTERS: { value: AgentFindingStatus | ''; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'triaged', label: 'Triaged' },
  { value: 'actioned', label: 'Actioned' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'dismissed', label: 'Dismissed' },
  { value: '', label: 'All' },
];

const SEVERITY_VARIANT: Record<string, 'urgent' | 'warning' | 'normal' | 'low'> = {
  critical: 'urgent',
  high: 'warning',
  normal: 'normal',
  info: 'low',
};

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'urgent' | 'low'> = {
  open: 'info',
  triaged: 'default',
  actioned: 'info',
  resolved: 'success',
  dismissed: 'low',
};

function formatAge(iso: string): string {
  const hours = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (hours < 1) return '<1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function formatMedianHours(hours: number | null): string {
  if (hours === null) return 'Needs more data';
  if (hours < 1) return '<1h';
  if (hours < 48) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

export function AgentFindingsPanel() {
  const [statusFilter, setStatusFilter] = useState<AgentFindingStatus | ''>('open');
  const { findings, stats, isLoading, error, forbidden, dismiss, triage, resolve, convertToWorkOrder } =
    useAgentFindings(statusFilter || undefined);
  const { has } = useWorkOsPermissions();
  const canManage = has('agents.manage');

  const [dismissReasons, setDismissReasons] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function runAction(id: string, fn: () => Promise<unknown>) {
    setActionError(null);
    setBusyId(id);
    try {
      await fn();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'That action failed.');
    } finally {
      setBusyId(null);
    }
  }

  if (forbidden) {
    return (
      <div className="p-4 sm:p-6 text-sm text-gray-500 dark:text-dark-400">
        Your role doesn't include agent findings access.
      </div>
    );
  }

  const statsEntries = Object.entries(stats);

  return (
    <div className="p-4 sm:p-6 border-t border-gray-200 dark:border-dark-700">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Agent Findings</h3>
        <div className="flex gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value || 'all'}
              onClick={() => setStatusFilter(f.value)}
              className={`px-2 py-1 text-xs font-medium rounded-lg ${
                statusFilter === f.value
                  ? 'bg-gray-900 text-white dark:bg-dark-100 dark:text-dark-900'
                  : 'text-gray-500 dark:text-dark-400 hover:bg-gray-100 dark:hover:bg-dark-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {statsEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-4">
          {statsEntries.map(([agentId, s]) => (
            <div key={agentId} className="rounded-lg border border-gray-200 dark:border-dark-700 px-3 py-2 text-xs">
              <p className="font-medium text-gray-700 dark:text-dark-200">{agentId}</p>
              <p className="text-gray-500 dark:text-dark-400 mt-0.5">
                {s.generated} generated · {Math.round(s.dismissal_rate * 100)}% dismissed
              </p>
              <p className="text-gray-500 dark:text-dark-400">
                Median resolution: {formatMedianHours(s.median_hours_to_resolve)}
              </p>
            </div>
          ))}
        </div>
      )}

      {actionError && <p className="text-sm text-brand-600 dark:text-brand-400 mb-2">{actionError}</p>}
      {error && <p className="text-sm text-brand-600 dark:text-brand-400 mb-2">{error}</p>}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-gray-100 dark:bg-dark-800 animate-pulse" />
          ))}
        </div>
      ) : findings.length === 0 ? (
        <EmptyState icon={<CheckCircle2 size={22} />} title="No findings in this view" />
      ) : (
        <div className="space-y-2">
          {findings.map(f => (
            <div
              key={f.id}
              data-testid={`finding-${f.id}`}
              className="rounded-lg border border-gray-200 dark:border-dark-700 p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <StatusBadge variant={SEVERITY_VARIANT[f.severity] ?? 'default'}>{f.severity}</StatusBadge>
                    <StatusBadge variant={STATUS_VARIANT[f.status] ?? 'default'}>{f.status}</StatusBadge>
                    <span className="text-xs text-gray-400 dark:text-dark-500">{f.agent_id} · {formatAge(f.created_at)}</span>
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-dark-100 mt-1">{f.title}</p>
                  {f.detail && <p className="text-xs text-gray-500 dark:text-dark-400">{f.detail}</p>}
                  {f.status === 'dismissed' && f.dismissed_reason && (
                    <p className="text-xs text-gray-400 dark:text-dark-500 mt-1">Dismissed: {f.dismissed_reason}</p>
                  )}
                </div>
              </div>

              {canManage && (f.status === 'open' || f.status === 'triaged') && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {f.status === 'open' && (
                    <button
                      onClick={() => void runAction(f.id, () => triage(f.id))}
                      disabled={busyId === f.id}
                      className="px-2 py-1 text-xs font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200 disabled:opacity-50"
                    >
                      Triage
                    </button>
                  )}
                  <button
                    onClick={() => void runAction(f.id, () => convertToWorkOrder(f.id))}
                    disabled={busyId === f.id}
                    className="flex items-center gap-1 px-2 py-1 text-xs font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200 disabled:opacity-50"
                  >
                    <Workflow size={12} /> Convert to Work Order
                  </button>
                  <button
                    onClick={() => void runAction(f.id, () => resolve(f.id))}
                    disabled={busyId === f.id}
                    className="px-2 py-1 text-xs font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200 disabled:opacity-50"
                  >
                    Resolve
                  </button>
                  <input
                    type="text"
                    value={dismissReasons[f.id] ?? ''}
                    onChange={e => setDismissReasons(prev => ({ ...prev, [f.id]: e.target.value }))}
                    placeholder="Dismiss reason (optional)"
                    className="text-xs px-2 py-1 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-850 text-gray-700 dark:text-dark-200 w-40"
                  />
                  <button
                    onClick={() => void runAction(f.id, () => dismiss(f.id, dismissReasons[f.id], 7))}
                    disabled={busyId === f.id}
                    className="px-2 py-1 text-xs font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-500 dark:text-dark-400 disabled:opacity-50"
                  >
                    Dismiss (7d)
                  </button>
                </div>
              )}

              {f.status === 'actioned' && f.work_order_id && (
                <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-2 flex items-center gap-1">
                  <ClipboardList size={12} /> Converted to a Work Order — resolves automatically when it completes.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
