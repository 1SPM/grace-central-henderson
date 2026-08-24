/**
 * "My Work" — the staff-facing view GRACE WorkOS used to be, before it
 * became pastor-privileged (migration 068): what I'm accountable for,
 * what GRACE's agents are doing on my behalf, and a way to flag it for
 * the pastor's attention if I need to step in as the human.
 */
import { useState } from 'react';
import { Bot, Flag, ArrowUpRight } from 'lucide-react';
import { useMyWork, type MyWorkAgentActivity, type MyWorkOrder, type MyWorkArea } from '../hooks/useMyWork';
import { StatusBadge } from './ui/StatusBadge';

const STATUS_VARIANT: Record<string, 'default' | 'info' | 'success' | 'urgent' | 'low'> = {
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

function AgentActivityRow({ activity }: { activity: MyWorkAgentActivity | null }) {
  if (!activity) {
    return <p className="text-xs text-gray-400 dark:text-dark-500 mt-1.5">No agent supports this yet — you're on your own here.</p>;
  }
  return (
    <div className="mt-1.5 flex items-start gap-1.5 text-xs text-gray-600 dark:text-dark-300">
      <Bot size={13} className="mt-0.5 shrink-0 text-slate-400 dark:text-dark-500" />
      <div className="min-w-0">
        <span className="font-medium text-gray-700 dark:text-dark-200">{activity.agent_name}</span>
        {' · '}
        <StatusBadge variant={STATUS_VARIANT[activity.status] ?? 'default'}>{activity.status.replace('_', ' ')}</StatusBadge>
        {activity.summary && <p className="text-gray-500 dark:text-dark-400 mt-0.5">{activity.summary}</p>}
        {activity.error && <p className="text-brand-600 dark:text-brand-400 mt-0.5">{activity.error}</p>}
        <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-0.5">Last activity: {formatTime(activity.finished_at)}</p>
      </div>
    </div>
  );
}

function FlagControl({ flagKey, flagging, onFlag }: { flagKey: string; flagging: boolean; onFlag: (note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  if (sent) {
    return <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-400">Flagged for your Senior Pastor — it'll show in their queue.</p>;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-2 inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-dark-400 hover:text-brand-600 dark:hover:text-brand-400"
        data-testid={`flag-toggle-${flagKey}`}
      >
        <Flag size={11} /> I need to step in
      </button>
    );
  }

  return (
    <div className="mt-2 space-y-1.5">
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        rows={2}
        placeholder="What does the pastor need to know?"
        maxLength={2000}
        className="w-full text-xs rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-850 text-gray-800 dark:text-dark-100 px-2 py-1.5 resize-y"
      />
      <div className="flex gap-1.5">
        <button
          type="button"
          disabled={!note.trim() || flagging}
          onClick={() => void onFlag(note).then(() => setSent(true))}
          className="px-2.5 py-1 text-[11px] font-semibold bg-brand-600 hover:bg-brand-700 text-white rounded-lg disabled:opacity-50"
        >
          {flagging ? 'Flagging…' : 'Flag for pastor'}
        </button>
        <button
          type="button"
          onClick={() => { setOpen(false); setNote(''); }}
          className="px-2.5 py-1 text-[11px] font-medium text-gray-500 dark:text-dark-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

function WorkOrderCard({ wo, flagging, onFlag }: { wo: MyWorkOrder; flagging: boolean; onFlag: (note: string) => Promise<void> }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-3.5" data-testid={`my-work-order-${wo.id}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">{wo.title}</p>
        <span className="text-[11px] text-gray-400 dark:text-dark-500 whitespace-nowrap">{wo.status.replace('_', ' ')}</span>
      </div>
      {wo.ministry && <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-0.5">{wo.ministry}</p>}
      <AgentActivityRow activity={wo.agent_activity} />
      {wo.agent_activity && <FlagControl flagKey={`wo:${wo.id}`} flagging={flagging} onFlag={onFlag} />}
    </div>
  );
}

function AreaCard({ area, flagging, onFlag }: { area: MyWorkArea; flagging: boolean; onFlag: (note: string) => Promise<void> }) {
  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-3.5" data-testid={`my-work-area-${area.area_key}`}>
      <p className="text-sm font-semibold text-gray-900 dark:text-dark-100">{area.area_name}</p>
      <AgentActivityRow activity={area.agent_activity} />
      {area.agent_activity && <FlagControl flagKey={`area:${area.area_key}`} flagging={flagging} onFlag={onFlag} />}
    </div>
  );
}

export function MyWorkPanel() {
  const { workOrders, areas, isLoading, flaggingKey, flagWorkOrder, flagArea } = useMyWork();

  if (isLoading) return <div className="p-6 text-sm text-gray-500 dark:text-dark-400">Loading your work…</div>;

  if (workOrders.length === 0 && areas.length === 0) {
    return (
      <div className="p-6 text-center">
        <ArrowUpRight size={22} className="mx-auto text-gray-300 dark:text-dark-600 mb-2" />
        <p className="text-sm text-gray-500 dark:text-dark-400">Nothing is assigned to you yet — no open Work Orders and no ministry area ownership.</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <p className="text-sm text-gray-500 dark:text-dark-400">
        What's on your plate, and what GRACE's agents are doing on your behalf. Flag anything that
        needs your Senior Pastor's attention — it lands directly in their queue.
      </p>

      {areas.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-2">Your ministry areas</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {areas.map(a => (
              <AreaCard key={a.area_key} area={a} flagging={flaggingKey === `area:${a.area_key}`} onFlag={note => flagArea(a.area_key, note)} />
            ))}
          </div>
        </div>
      )}

      {workOrders.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-dark-500 mb-2">Your Work Orders</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {workOrders.map(wo => (
              <WorkOrderCard key={wo.id} wo={wo} flagging={flaggingKey === `wo:${wo.id}`} onFlag={note => flagWorkOrder(wo.id, note)} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
