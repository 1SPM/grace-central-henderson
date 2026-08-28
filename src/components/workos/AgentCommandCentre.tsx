import { useState } from 'react';
import { Bot, Settings2, Plus, X } from 'lucide-react';
import { useAgentCommandCentre, type AgentRegistryEntry } from '../../hooks/useAgentCommandCentre';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { useAgentSettings, type AgentConfig } from '../../hooks/useAgentSettings';
import { StatusBadge } from '../ui/StatusBadge';
import { AgentFindingsPanel } from './AgentFindingsPanel';
import { useMinistryAreas } from '../../hooks/useMinistryAreas';
import { ROOM_LABEL, roleLabel } from './AreaPairing';
import type { AreaWithCounts } from '../../hooks/useMinistryAreas';

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

interface AgentCardProps {
  agent: AgentRegistryEntry;
  supports: AreaWithCounts[];
  config: AgentConfig | undefined;
  canManage: boolean;
  running: boolean;
  runError: string | undefined;
  saving: boolean;
  saveError: string | undefined;
  onRun: () => void;
  onSave: (instructions: string, tasks: string[]) => Promise<AgentConfig | null>;
}

function AgentCard({ agent, supports, config, canManage, running, runError, saving, saveError, onRun, onSave }: AgentCardProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [instructions, setInstructions] = useState(config?.instructions ?? '');
  const [tasks, setTasks] = useState<string[]>(config?.tasks ?? []);
  const [draftTask, setDraftTask] = useState('');

  function openSettings() {
    // Re-seed the draft from the saved config each time the panel opens,
    // so a discarded edit (closed without saving) never lingers as stale
    // local state the next time it's reopened.
    setInstructions(config?.instructions ?? '');
    setTasks(config?.tasks ?? []);
    setDraftTask('');
    setSettingsOpen(true);
  }

  function addTask() {
    const trimmed = draftTask.trim();
    if (!trimmed) return;
    setTasks(prev => [...prev, trimmed]);
    setDraftTask('');
  }

  async function handleSave() {
    const saved = await onSave(instructions, tasks);
    if (saved) setSettingsOpen(false);
  }

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4" data-testid={`agent-card-${agent.key}`}>
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

      {supports.map(a => (
        <div key={a.key} className="mt-2 text-[11px] text-gray-500 dark:text-dark-400" data-testid={`agent-supports-${agent.key}`}>
          <span className="uppercase tracking-wide text-[10px] text-gray-400 dark:text-dark-500">Supports</span>{' '}
          <span className="text-gray-700 dark:text-dark-200">{a.name}</span>
          {' · '}
          {a.owner
            ? <span>{a.owner.name}</span>
            : <span className="text-amber-700 dark:text-amber-400">no owner yet ({roleLabel(a.default_role_key)})</span>}
          {' · '}
          <span>{ROOM_LABEL[a.room_id] ?? a.room_id}</span>
        </div>
      ))}

      {agent.latest_run ? (
        <div className="mt-3 text-xs text-gray-500 dark:text-dark-400 space-y-0.5">
          <p>Last run: {formatTime(agent.latest_run.finished_at ?? agent.latest_run.started_at)}</p>
          {agent.latest_run.output?.summary && <p className="text-gray-700 dark:text-dark-200">{agent.latest_run.output.summary}</p>}
          {agent.latest_run.error && <p className="text-brand-600 dark:text-brand-400">{agent.latest_run.error}</p>}
        </div>
      ) : (
        <p className="mt-3 text-xs text-gray-400 dark:text-dark-500">
          {agent.implemented ? 'No executions recorded yet.' : 'This agent workflow has not been built yet.'}
        </p>
      )}

      {!settingsOpen && (config?.instructions || config?.tasks.length) ? (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-dark-700 text-xs text-gray-500 dark:text-dark-400">
          {config.instructions && <p className="line-clamp-2">{config.instructions}</p>}
          {config.tasks.length > 0 && (
            <p className="mt-1 text-[11px] text-gray-400 dark:text-dark-500">{config.tasks.length} task{config.tasks.length === 1 ? '' : 's'} assigned</p>
          )}
        </div>
      ) : null}

      {runError && (
        <p className="mt-2 text-xs text-brand-600 dark:text-brand-400" data-testid={`agent-run-error-${agent.key}`}>{runError}</p>
      )}

      <div className="mt-3 flex gap-2">
        {canManage && agent.implemented && (
          <button
            onClick={onRun}
            disabled={running}
            className="flex-1 px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200 disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run now'}
          </button>
        )}
        {canManage && (
          <button
            onClick={() => (settingsOpen ? setSettingsOpen(false) : openSettings())}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200 inline-flex items-center gap-1"
            data-testid={`agent-settings-toggle-${agent.key}`}
          >
            <Settings2 size={12} /> {settingsOpen ? 'Close' : 'Settings'}
          </button>
        )}
      </div>

      {settingsOpen && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-dark-700 space-y-3" data-testid={`agent-settings-panel-${agent.key}`}>
          <div>
            <label className="block text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-1" htmlFor={`instructions-${agent.key}`}>
              Instructions
            </label>
            <textarea
              id={`instructions-${agent.key}`}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              rows={3}
              placeholder="What should this agent focus on or avoid?"
              className="w-full text-xs rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-850 text-gray-800 dark:text-dark-100 px-2 py-1.5 resize-y"
              maxLength={4000}
            />
          </div>

          <div>
            <label className="block text-[11px] uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-1">Tasks</label>
            {tasks.length === 0 && <p className="text-[11px] text-gray-400 dark:text-dark-500 mb-1.5">No tasks assigned yet.</p>}
            <ul className="space-y-1 mb-1.5">
              {tasks.map((t, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs text-gray-700 dark:text-dark-200 bg-gray-50 dark:bg-dark-800 rounded-lg px-2 py-1">
                  <span className="flex-1 truncate">{t}</span>
                  <button
                    type="button"
                    onClick={() => setTasks(prev => prev.filter((_, idx) => idx !== i))}
                    aria-label={`Remove task: ${t}`}
                    className="text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 shrink-0"
                  >
                    <X size={12} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={draftTask}
                onChange={e => setDraftTask(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addTask(); } }}
                placeholder="Add a task…"
                maxLength={300}
                className="flex-1 text-xs rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-850 text-gray-800 dark:text-dark-100 px-2 py-1.5"
              />
              <button
                type="button"
                onClick={addTask}
                disabled={!draftTask.trim()}
                className="px-2 py-1.5 rounded-lg border border-gray-300 dark:border-dark-600 text-gray-500 dark:text-dark-300 disabled:opacity-40"
                aria-label="Add task"
              >
                <Plus size={13} />
              </button>
            </div>
          </div>

          {saveError && (
            <p className="text-xs text-brand-600 dark:text-brand-400" data-testid={`agent-save-error-${agent.key}`}>{saveError}</p>
          )}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full px-3 py-1.5 text-xs font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save instructions & tasks'}
          </button>
        </div>
      )}
    </div>
  );
}

export function AgentCommandCentre() {
  const { agents, isLoading, error, forbidden, runningKeys, runErrors, runAgent } = useAgentCommandCentre();
  // Same map the Campus and the Overview read, so an agent's card names the
  // area and the person it supports rather than floating free of the church.
  const { areas } = useMinistryAreas();
  const { has } = useWorkOsPermissions();
  const { configs, savingKey, saveErrors, save } = useAgentSettings();
  const canManage = has('agents.manage');

  if (forbidden) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-dark-400">
        Your role doesn't include Agent Command Centre access. Contact a System Administrator if you believe this is wrong.
      </div>
    );
  }
  if (error) return <div className="p-6 text-sm text-brand-600 dark:text-brand-400">{error}</div>;
  if (isLoading) return <div className="p-6 text-sm text-gray-500 dark:text-dark-400">Loading agent registry…</div>;

  return (
    <div className="p-4 sm:p-6">
      <p className="text-sm text-gray-500 dark:text-dark-400 mb-4">
        Each agent below either has a real, recorded run history or is registered but not yet built —
        nothing shown here is simulated activity. Instructions and tasks are what you've told the agent
        to do; the agent won't act outside its area of responsibility on its own.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map(agent => (
          <AgentCard
            key={agent.key}
            agent={agent}
            supports={areas.filter(a => a.agent_key === agent.key)}
            config={configs.get(agent.key)}
            canManage={canManage}
            running={runningKeys.has(agent.key)}
            runError={runErrors.get(agent.key)}
            saving={savingKey === agent.key}
            saveError={saveErrors.get(agent.key)}
            onRun={() => void runAgent(agent.key)}
            onSave={(instructions, tasks) => save(agent.key, instructions, tasks)}
          />
        ))}
      </div>

      <AgentFindingsPanel />
    </div>
  );
}
