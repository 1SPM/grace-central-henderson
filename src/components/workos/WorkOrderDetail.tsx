import { useEffect, useState, useCallback } from 'react';
import { ArrowLeft, FileText, Paperclip, ShieldCheck } from 'lucide-react';
import { useWorkOrders, type WorkOrderDetail as WorkOrderDetailData } from '../../hooks/useWorkOrders';
import { useWorkOsPermissions } from '../../hooks/useWorkOsPermissions';
import { ProgressBar } from '../ui/ProgressBar';
import { StatusBadge } from '../ui/StatusBadge';
import { STATUS_LABELS, STATUS_VARIANT } from './WorkOrderList';
import type { CompletionReport } from '../../types/shared-platform';

const TASK_STATUS_LABELS: Record<string, string> = {
  pending: 'To Do',
  in_progress: 'In Progress',
  blocked: 'Blocked',
  under_review: 'Under Review',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

interface WorkOrderDetailProps {
  workOrderId: string;
  onBack: () => void;
}

export function WorkOrderDetail({ workOrderId, onBack }: WorkOrderDetailProps) {
  const { getDetail, updateStatus, updateTask, addEvidence, requestApproval, getCompletionReport } = useWorkOrders();
  const { has } = useWorkOsPermissions();
  const [detail, setDetail] = useState<WorkOrderDetailData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [evidenceDraft, setEvidenceDraft] = useState<Record<string, string>>({});
  const [report, setReport] = useState<CompletionReport | null>(null);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = has('work_orders.manage');

  const load = useCallback(async () => {
    setIsLoading(true);
    const data = await getDetail(workOrderId);
    if (!data) setNotFound(true);
    else setDetail(data);
    setIsLoading(false);
  }, [getDetail, workOrderId]);

  useEffect(() => { void load(); }, [load]);

  async function handleStatusChange(status: string) {
    setActionError(null);
    try {
      await updateStatus(workOrderId, status as never);
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update status.');
    }
  }

  async function handleTaskStatusChange(taskId: string, status: string) {
    setActionError(null);
    try {
      await updateTask(taskId, { status: status as never });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not update task.');
    }
  }

  async function handleAddEvidence(taskId: string) {
    const content = evidenceDraft[taskId]?.trim();
    if (!content) return;
    setActionError(null);
    try {
      await addEvidence({ work_order_id: workOrderId, task_id: taskId, kind: 'note', content });
      setEvidenceDraft(prev => ({ ...prev, [taskId]: '' }));
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not add evidence.');
    }
  }

  async function handleRequestApproval() {
    setActionError(null);
    try {
      await requestApproval(workOrderId, {
        proposed_action: `Approve completion readiness for "${detail?.work_order.title}"`,
        risk_level: 'medium',
      });
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not request approval.');
    }
  }

  async function handleGenerateReport() {
    setIsGeneratingReport(true);
    setActionError(null);
    try {
      const data = await getCompletionReport(workOrderId);
      setReport(data.report);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not generate the completion report.');
    } finally {
      setIsGeneratingReport(false);
    }
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-gray-500 dark:text-dark-400">Loading Work Order…</div>;
  }
  if (notFound || !detail) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="text-sm text-indigo-600 dark:text-indigo-400 mb-3 inline-flex items-center gap-1">
          <ArrowLeft size={14} /> Back to Work Orders
        </button>
        <p className="text-sm text-gray-500 dark:text-dark-400">This Work Order wasn't found, or you don't have access to it.</p>
      </div>
    );
  }

  const { work_order: wo, tasks, dependencies, evidence } = detail;
  const completedCount = tasks.filter(t => t.status === 'completed').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const evidenceByTask = new Map<string, number>();
  for (const e of evidence) {
    if (e.task_id) evidenceByTask.set(e.task_id, (evidenceByTask.get(e.task_id) ?? 0) + 1);
  }

  return (
    <div className="p-4 sm:p-6">
      <button onClick={onBack} className="text-sm text-indigo-600 dark:text-indigo-400 mb-3 inline-flex items-center gap-1">
        <ArrowLeft size={14} /> Back to Work Orders
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-dark-100">{wo.title}</h2>
          {wo.description && <p className="text-sm text-gray-500 dark:text-dark-400 mt-1 max-w-2xl">{wo.description}</p>}
          <p className="text-xs text-gray-400 dark:text-dark-500 mt-2">
            {wo.ministry ?? 'No ministry set'} · Priority: {wo.priority} · Sensitivity: {wo.sensitivity}
            {wo.due_date ? ` · Due ${new Date(wo.due_date).toLocaleDateString()}` : ''}
          </p>
        </div>
        <StatusBadge variant={STATUS_VARIANT[wo.status]}>{STATUS_LABELS[wo.status]}</StatusBadge>
      </div>

      <div className="mb-6">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-dark-400 mb-1">
          <span>Progress</span>
          <span>{completedCount} of {tasks.length} tasks complete</span>
        </div>
        <ProgressBar value={progressPercent} color={progressPercent === 100 ? 'emerald' : 'blue'} />
      </div>

      {actionError && <p className="text-sm text-brand-600 dark:text-brand-400 mb-4">{actionError}</p>}

      {canManage && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <label htmlFor="wo-status-select" className="text-xs font-medium text-gray-500 dark:text-dark-400">Status:</label>
          <select
            id="wo-status-select"
            value={wo.status}
            onChange={e => void handleStatusChange(e.target.value)}
            className="rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1 text-sm text-gray-700 dark:text-dark-200"
          >
            {(Object.keys(STATUS_LABELS) as (keyof typeof STATUS_LABELS)[]).map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          {wo.status === 'planning' && (
            <button
              onClick={() => void handleRequestApproval()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200"
            >
              <ShieldCheck size={14} /> Request approval
            </button>
          )}
          <button
            onClick={() => void handleGenerateReport()}
            disabled={isGeneratingReport}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium border border-gray-300 dark:border-dark-600 rounded-lg text-gray-700 dark:text-dark-200 disabled:opacity-50"
          >
            <FileText size={14} /> {isGeneratingReport ? 'Generating…' : 'Generate completion report'}
          </button>
        </div>
      )}

      {dependencies.length > 0 && (
        <div className="mb-6 text-sm text-gray-500 dark:text-dark-400">
          Depends on {dependencies.length} other Work Order{dependencies.length === 1 ? '' : 's'}.
        </div>
      )}

      <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-2">Tasks</h3>
      <div className="divide-y divide-gray-100 dark:divide-dark-700 rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 mb-6">
        {tasks.map(task => (
          <div key={task.id} className="px-4 py-3" data-testid="work-order-task-row">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-900 dark:text-dark-100">{task.title}</p>
                {task.description && <p className="text-xs text-gray-500 dark:text-dark-400 mt-0.5">{task.description}</p>}
              </div>
              {canManage ? (
                <select
                  value={task.status}
                  onChange={e => void handleTaskStatusChange(task.id, e.target.value)}
                  className="rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1 text-xs text-gray-700 dark:text-dark-200 shrink-0"
                  aria-label={`Status for ${task.title}`}
                >
                  {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              ) : (
                <StatusBadge variant={task.status === 'completed' ? 'success' : task.status === 'blocked' ? 'urgent' : 'default'}>
                  {TASK_STATUS_LABELS[task.status]}
                </StatusBadge>
              )}
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400 dark:text-dark-500">
              <Paperclip size={12} />
              {evidenceByTask.get(task.id) ?? 0} piece{(evidenceByTask.get(task.id) ?? 0) === 1 ? '' : 's'} of evidence
            </div>

            {canManage && (
              <div className="mt-2 flex gap-2">
                <input
                  value={evidenceDraft[task.id] ?? ''}
                  onChange={e => setEvidenceDraft(prev => ({ ...prev, [task.id]: e.target.value }))}
                  placeholder="Add a note as evidence…"
                  className="flex-1 rounded-lg border border-gray-300 dark:border-dark-600 bg-white dark:bg-dark-800 px-2 py-1 text-xs text-gray-700 dark:text-dark-200"
                />
                <button
                  onClick={() => void handleAddEvidence(task.id)}
                  className="px-2 py-1 text-xs font-medium text-indigo-600 dark:text-indigo-400"
                >
                  Add
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {report && (
        <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4" data-testid="completion-report">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100 mb-2">Completion report</h3>
          <p className="text-sm text-gray-700 dark:text-dark-200">{report.narrative}</p>
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3 text-xs text-gray-500 dark:text-dark-400">
            <div><dt className="font-medium">Tasks complete</dt><dd>{report.task_summary.completed} / {report.task_summary.total}</dd></div>
            <div><dt className="font-medium">Evidence</dt><dd>{report.evidence_count}</dd></div>
            <div><dt className="font-medium">Approvals</dt><dd>{report.approval_summary.total} total, {report.approval_summary.pending} pending</dd></div>
            <div><dt className="font-medium">Generated</dt><dd>{new Date(report.generated_at).toLocaleString()}</dd></div>
          </dl>
        </div>
      )}
    </div>
  );
}
