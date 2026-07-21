import { useState } from 'react';
import { ClipboardList, Plus, Sparkles } from 'lucide-react';
import { useWorkOrders } from '../../hooks/useWorkOrders';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { WorkOrderCreateModal } from './WorkOrderCreateModal';
import { EmptyState } from '../ui/EmptyState';
import { StatusBadge } from '../ui/StatusBadge';
import type { WorkOrderStatus } from '../../types/shared-platform';

const STATUS_LABELS: Record<WorkOrderStatus, string> = {
  draft: 'Draft',
  planning: 'Planning',
  awaiting_approval: 'Awaiting Approval',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  under_review: 'Under Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const STATUS_VARIANT: Record<WorkOrderStatus, 'default' | 'info' | 'warning' | 'urgent' | 'success' | 'low'> = {
  draft: 'default',
  planning: 'info',
  awaiting_approval: 'warning',
  in_progress: 'info',
  blocked: 'urgent',
  under_review: 'warning',
  completed: 'success',
  cancelled: 'low',
};

interface WorkOrderListProps {
  onOpen: (id: string) => void;
}

export function WorkOrderList({ onOpen }: WorkOrderListProps) {
  const { workOrders, isLoading, forbidden, error, list, create, createPilotReadinessDemo } = useWorkOrders();
  const { has } = useWorkOsPermissions();
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WorkOrderStatus | ''>('');
  const [isSeedingDemo, setIsSeedingDemo] = useState(false);
  const [demoError, setDemoError] = useState<string | null>(null);

  const canManage = has('work_orders.manage');

  async function handleFilterChange(next: WorkOrderStatus | '') {
    setStatusFilter(next);
    await list(next ? { status: next } : undefined);
  }

  async function handleRunPilotDemo() {
    setIsSeedingDemo(true);
    setDemoError(null);
    try {
      const result = await createPilotReadinessDemo();
      onOpen(result.work_order.id);
    } catch (err) {
      setDemoError(err instanceof Error ? err.message : 'Could not create the demonstration Work Order.');
    } finally {
      setIsSeedingDemo(false);
    }
  }

  if (forbidden) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-dark-400">
        Your role doesn't include Work Order access. Contact a System Administrator if you believe this is wrong.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={e => void handleFilterChange(e.target.value as WorkOrderStatus | '')}
          className="rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-3 py-1.5 text-sm text-gray-700 dark:text-dark-200"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          {(Object.keys(STATUS_LABELS) as WorkOrderStatus[]).map(s => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={handleRunPilotDemo}
              disabled={isSeedingDemo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-slate-700 dark:text-dark-200 border border-gray-300 dark:border-dark-600 rounded-lg disabled:opacity-50"
              title="Creates the GRACE Impact Card Pilot Readiness Work Order with its ten tasks"
            >
              <Sparkles size={14} />
              {isSeedingDemo ? 'Creating…' : 'Create Impact Card Pilot Readiness Work Order'}
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium bg-slate-900 text-white rounded-lg"
            >
              <Plus size={14} /> New Work Order
            </button>
          </div>
        )}
      </div>

      {demoError && <p className="text-sm text-brand-600 dark:text-brand-400 mb-3">{demoError}</p>}
      {error && <p className="text-sm text-brand-600 dark:text-brand-400 mb-3">{error}</p>}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-gray-100 dark:bg-dark-800 animate-pulse" />
          ))}
        </div>
      ) : workOrders.length === 0 ? (
        <EmptyState
          icon={<ClipboardList size={22} />}
          title="No Work Orders yet"
          description="Work Orders track a piece of operational work from planning through completion, with tasks, evidence, and approvals attached."
          action={canManage ? { label: 'Create your first Work Order', onClick: () => setShowCreate(true) } : undefined}
        />
      ) : (
        <div className="divide-y divide-gray-100 dark:divide-dark-700 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850">
          {workOrders.map(wo => (
            <button
              key={wo.id}
              onClick={() => onOpen(wo.id)}
              className="w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-dark-800 flex items-center justify-between gap-3"
              data-testid="work-order-row"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-dark-100 truncate">{wo.title}</p>
                <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">
                  {wo.ministry ?? 'No ministry set'} · Priority: {wo.priority}
                  {wo.due_date ? ` · Due ${new Date(wo.due_date).toLocaleDateString()}` : ''}
                </p>
              </div>
              <StatusBadge variant={STATUS_VARIANT[wo.status]}>{STATUS_LABELS[wo.status]}</StatusBadge>
            </button>
          ))}
        </div>
      )}

      {showCreate && (
        <WorkOrderCreateModal
          onClose={() => setShowCreate(false)}
          onCreate={async (input) => {
            const wo = await create(input);
            onOpen(wo.id);
          }}
        />
      )}
    </div>
  );
}

export { STATUS_LABELS, STATUS_VARIANT };
