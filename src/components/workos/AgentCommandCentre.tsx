import { Bot } from 'lucide-react';
import { useAgentCommandCentre } from '../../hooks/useAgentCommandCentre';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { StatusBadge } from '../ui/StatusBadge';
import { AgentFindingsPanel } from './AgentFindingsPanel';

const STATUS_LABEL: Record<string, string> = {
  not_implemented: 'Not yet implemented',
  not_yet_run: 'Not yet run',
  queued: 'Queued',
  running: 'Running',
  succeeded: 'Ran successfully',
  failed: 'Last run failed',
  cancelled: 'Cancelled',
};

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'urgent' | 'low'> = {
  not_implemented: 'low',
  not_yet_run: 'default',
  queued: 'info',
  running: 'info',
  succeeded: 'success',
  failed: 'urgent',
  cancelled: 'low',
};

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
}

export function AgentCommandCentre() {
  const { agents, isLoading, error, forbidden, runningKey, runAgent } = useAgentCommandCentre();
  const { has } = useWorkOsPermissions();
  const canManage = has('agents.manage');

  if (forbidden) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-dark-400">
        Your role doesn't include Agent Command Centre access. Contact a System Administrator if you believe this is wrong.
      </div>
    );
  }
  if (error) return <div className="p-6 text-sm text-rose-600 dark:text-rose-400">{error}</div>;
  if (isLoading) return <div className="p-6 text-sm text-gray-500 dark:text-dark-400">Loading agent registry…</div>;

  return (
    <div className="p-4 sm:p-6">
      <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
        Each agent below either has a real, recorded run history or is registered but not yet built —
        nothing shown here is simulated activity.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map(agent => (
          <div key={agent.key} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4" data-testid={`agent-card-${agent.key}`}>
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-dark-800 flex items-center justify-center shrink-0">
                  <Bot size={16} className="text-slate-500 dark:text-dark-300" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-dark-100 truncate">{agent.name}</p>
                  <p className="text-xs text-gray-500 dark:text-dark-400 truncate">{agent.role}</p>
                </div>
              </div>
              <StatusBadge variant={STATUS_VARIANT[agent.status] ?? 'default'}>{STATUS_LABEL[agent.status] ?? agent.status}</StatusBadge>
            </div>

            <p className="text-xs text-gray-500 dark:text-dark-400 mt-2">{agent.description}</p>

            {agent.latest_run ? (
              <div className="mt-3 text-xs text-gray-500 dark:text-dark-400 space-y-0.5">
                <p>Last run: {formatTime(agent.latest_run.finished_at ?? agent.latest_run.started_at)}</p>
                {agent.latest_run.output?.summary && <p className="text-gray-700 dark:text-dark-200">{agent.latest_run.output.summary}</p>}
                {agent.latest_run.error && <p className="text-rose-600 dark:text-rose-400">{agent.latest_run.error}</p>}
              </div>
            ) : (
              <p className="mt-3 text-xs text-gray-400 dark:text-dark-500">
                {agent.implemented ? 'No executions recorded yet.' : 'This agent workflow has not been built yet.'}
              </p>
            )}

            {canManage && agent.implemented && (
              <button
                onClick={() => void runAgent(agent.key)}
                disabled={runningKey === agent.key}
                className="mt-3 w-full px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200 disabled:opacity-50"
              >
                {runningKey === agent.key ? 'Running…' : 'Run now'}
              </button>
            )}
          </div>
        ))}
      </div>

      <AgentFindingsPanel />
    </div>
  );
}
