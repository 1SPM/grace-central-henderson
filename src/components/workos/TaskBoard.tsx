import { LayoutGrid } from 'lucide-react';
import { useTaskBoard, type TaskBoardTask } from '../../hooks/useTaskBoard';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { EmptyState } from '../ui/EmptyState';
import type { WorkOrderTaskStatus } from '../../types/shared-platform';

const COLUMNS: { status: WorkOrderTaskStatus; label: string }[] = [
  { status: 'pending', label: 'To Do' },
  { status: 'in_progress', label: 'In Progress' },
  { status: 'blocked', label: 'Blocked' },
  { status: 'under_review', label: 'Under Review' },
  { status: 'completed', label: 'Completed' },
];

function priorityDot(priority: string): string {
  switch (priority) {
    case 'urgent': return 'bg-rose-500';
    case 'high': return 'bg-amber-500';
    case 'medium': return 'bg-blue-400';
    default: return 'bg-gray-300 dark:bg-dark-600';
  }
}

export function TaskBoard({ onOpenWorkOrder }: { onOpenWorkOrder: (id: string) => void }) {
  const { tasks, isLoading, error, forbidden, moveTask } = useTaskBoard();
  const { has } = useWorkOsPermissions();
  const canManage = has('work_orders.manage');

  if (forbidden) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-dark-400">
        Your role doesn't include task-board access. Contact a System Administrator if you believe this is wrong.
      </div>
    );
  }
  if (error) {
    return <div className="p-6 text-sm text-rose-600 dark:text-rose-400">{error}</div>;
  }
  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500 dark:text-dark-400">Loading task board…</div>;
  }
  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={<LayoutGrid size={22} />}
        title="No Work Order tasks yet"
        description="Tasks show up here once a Work Order has tasks assigned to it."
      />
    );
  }

  return (
    <div className="p-4 sm:p-6 overflow-x-auto">
      <div className="flex gap-3 min-w-[900px]">
        {COLUMNS.map(col => {
          const columnTasks = tasks.filter((t: TaskBoardTask) => t.status === col.status);
          return (
            <div key={col.status} className="flex-1 min-w-[170px]" data-testid={`task-column-${col.status}`}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-xs font-semibold text-gray-600 dark:text-dark-300 uppercase tracking-wide">{col.label}</h3>
                <span className="text-xs text-gray-400 dark:text-dark-500">{columnTasks.length}</span>
              </div>
              <div className="space-y-2">
                {columnTasks.map(task => (
                  <div
                    key={task.id}
                    className="rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-3"
                    data-testid="task-board-card"
                  >
                    <div className="flex items-start gap-1.5">
                      <span className={`mt-1 h-1.5 w-1.5 rounded-full shrink-0 ${priorityDot(task.priority)}`} />
                      <p className="text-xs font-medium text-gray-900 dark:text-dark-100">{task.title}</p>
                    </div>
                    <button
                      onClick={() => onOpenWorkOrder(task.work_order_id)}
                      className="text-[11px] text-indigo-600 dark:text-indigo-400 mt-1 block truncate max-w-full"
                    >
                      {task.work_orders?.title ?? 'Open Work Order'}
                    </button>
                    {task.due_date && (
                      <p className="text-[11px] text-gray-400 dark:text-dark-500 mt-1">
                        Due {new Date(task.due_date).toLocaleDateString()}
                      </p>
                    )}
                    {canManage && (
                      <select
                        value={task.status}
                        onChange={e => void moveTask(task.id, e.target.value as WorkOrderTaskStatus)}
                        className="mt-2 w-full rounded border border-gray-200 dark:border-dark-600 bg-white dark:bg-dark-800 px-1.5 py-1 text-[11px] text-gray-600 dark:text-dark-300"
                        aria-label={`Move ${task.title}`}
                      >
                        {COLUMNS.map(c => (
                          <option key={c.status} value={c.status}>{c.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
