/**
 * Pure Work Order completion-report builder — no database, no network,
 * fully unit-testable. Template-generated from real rows the caller
 * already fetched; this module only shapes and narrates them.
 *
 * The output shape (`CompletionReport`) lives in
 * src/types/shared-platform.ts, not here, so the frontend can import it
 * without reaching into `api/` (outside the frontend's tsconfig
 * `include`) — see that file's "Work Order completion report" section.
 */

import type { CompletionReport } from '../../src/types/shared-platform.js';

export type { CompletionReport };

export interface ReportWorkOrder {
  id: string;
  title: string;
  status: string;
  priority: string;
  ministry: string | null;
  owner_user_id: string | null;
  due_date: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ReportTask {
  id: string;
  title: string;
  status: string;
}

export interface ReportEvidence {
  id: string;
  task_id: string | null;
  kind: string;
}

export interface ReportApproval {
  id: string;
  status: string;
  decision: string | null;
  risk_level: string;
}

export interface CompletionReportInput {
  workOrder: ReportWorkOrder;
  tasks: ReportTask[];
  evidence: ReportEvidence[];
  approvals: ReportApproval[];
  generatedAt: string;
}

export function buildCompletionReport(input: CompletionReportInput): CompletionReport {
  const { workOrder, tasks, evidence, approvals, generatedAt } = input;

  const total = tasks.length;
  const completed = tasks.filter(t => t.status === 'completed').length;
  const inProgress = tasks.filter(t => t.status === 'in_progress').length;
  const blocked = tasks.filter(t => t.status === 'blocked').length;
  const pending = tasks.filter(t => t.status === 'pending').length;
  const percentComplete = total > 0 ? Math.round((completed / total) * 100) : 0;

  const taskIdsWithEvidence = new Set(evidence.filter(e => e.task_id).map(e => e.task_id));
  const tasksMissingEvidence = tasks
    .filter(t => t.status === 'completed' && !taskIdsWithEvidence.has(t.id))
    .map(t => t.title);

  const favorable = new Set(['approve', 'approve_with_changes']);
  const unfavorable = new Set(['reject', 'return_for_revision']);
  const decidedFavorably = approvals.filter(a => a.decision && favorable.has(a.decision)).length;
  const decidedUnfavorably = approvals.filter(a => a.decision && unfavorable.has(a.decision)).length;
  const pendingApprovals = approvals.filter(a => a.status === 'pending').length;

  const narrativeParts: string[] = [
    `${completed} of ${total} tasks complete (${percentComplete}%).`,
  ];
  if (blocked > 0) narrativeParts.push(`${blocked} task${blocked === 1 ? ' is' : 's are'} blocked.`);
  if (pendingApprovals > 0) narrativeParts.push(`${pendingApprovals} approval${pendingApprovals === 1 ? ' is' : 's are'} still pending.`);
  if (tasksMissingEvidence.length > 0) {
    narrativeParts.push(`${tasksMissingEvidence.length} completed task${tasksMissingEvidence.length === 1 ? '' : 's'} ${tasksMissingEvidence.length === 1 ? 'has' : 'have'} no evidence attached.`);
  }
  if (workOrder.status === 'completed') {
    narrativeParts.push('This Work Order is marked completed.');
  } else if (percentComplete === 100 && total > 0) {
    narrativeParts.push('All tasks are complete; the Work Order itself has not yet been marked completed.');
  }

  return {
    work_order_id: workOrder.id,
    title: workOrder.title,
    status: workOrder.status,
    generated_at: generatedAt,
    task_summary: {
      total,
      completed,
      in_progress: inProgress,
      blocked,
      pending,
      percent_complete: percentComplete,
    },
    evidence_count: evidence.length,
    tasks_missing_evidence: tasksMissingEvidence,
    approval_summary: {
      total: approvals.length,
      pending: pendingApprovals,
      decided_favorably: decidedFavorably,
      decided_unfavorably: decidedUnfavorably,
      latest_status: approvals[0]?.status ?? null,
    },
    narrative: narrativeParts.join(' '),
  };
}
