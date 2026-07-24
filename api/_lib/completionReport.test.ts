/**
 * Unit tests for the Work Order completion-report builder (Work Order test).
 */
import { describe, it, expect } from 'vitest';
import { buildCompletionReport, type CompletionReportInput } from './completionReport.js';

const BASE_WORK_ORDER = {
  id: 'wo-1',
  title: 'GRACE Impact Card Pilot Readiness — 1,000-Member Pilot',
  status: 'in_progress',
  priority: 'high',
  ministry: 'Impact Card Operations',
  owner_user_id: 'user-1',
  due_date: null,
  created_at: '2026-07-01T00:00:00.000Z',
  completed_at: null,
};

function baseInput(overrides: Partial<CompletionReportInput> = {}): CompletionReportInput {
  return {
    workOrder: BASE_WORK_ORDER,
    tasks: [],
    evidence: [],
    approvals: [],
    generatedAt: '2026-07-13T12:00:00.000Z',
    ...overrides,
  };
}

describe('buildCompletionReport', () => {
  it('reports 0 of 0 tasks complete when there are no tasks', () => {
    const report = buildCompletionReport(baseInput());
    expect(report.task_summary).toMatchObject({ total: 0, completed: 0, percent_complete: 0 });
  });

  it('computes percent complete from real task counts', () => {
    const report = buildCompletionReport(baseInput({
      tasks: [
        { id: 't1', title: 'Document inventory', status: 'completed' },
        { id: 't2', title: 'Product readiness', status: 'completed' },
        { id: 't3', title: 'Financial assumptions', status: 'in_progress' },
        { id: 't4', title: 'Risk review', status: 'blocked' },
      ],
    }));
    expect(report.task_summary).toMatchObject({ total: 4, completed: 2, in_progress: 1, blocked: 1, pending: 0, percent_complete: 50 });
  });

  it('flags completed tasks that have no evidence attached', () => {
    const report = buildCompletionReport(baseInput({
      tasks: [{ id: 't1', title: 'Privacy review', status: 'completed' }],
      evidence: [],
    }));
    expect(report.tasks_missing_evidence).toEqual(['Privacy review']);
  });

  it('does not flag a completed task that has evidence', () => {
    const report = buildCompletionReport(baseInput({
      tasks: [{ id: 't1', title: 'Privacy review', status: 'completed' }],
      evidence: [{ id: 'e1', task_id: 't1', kind: 'note' }],
    }));
    expect(report.tasks_missing_evidence).toEqual([]);
  });

  it('summarizes approval decisions correctly', () => {
    const report = buildCompletionReport(baseInput({
      approvals: [
        { id: 'a1', status: 'decided', decision: 'approve', risk_level: 'medium' },
        { id: 'a2', status: 'decided', decision: 'reject', risk_level: 'high' },
        { id: 'a3', status: 'pending', decision: null, risk_level: 'low' },
      ],
    }));
    expect(report.approval_summary).toMatchObject({
      total: 3,
      pending: 1,
      decided_favorably: 1,
      decided_unfavorably: 1,
    });
  });

  it('narrative mentions blocked tasks and pending approvals when present', () => {
    const report = buildCompletionReport(baseInput({
      tasks: [{ id: 't1', title: 'Risk review', status: 'blocked' }],
      approvals: [{ id: 'a1', status: 'pending', decision: null, risk_level: 'medium' }],
    }));
    expect(report.narrative).toMatch(/blocked/i);
    expect(report.narrative).toMatch(/pending/i);
  });

  it('narrative notes when all tasks are complete but the Work Order itself is not yet marked completed', () => {
    const report = buildCompletionReport(baseInput({
      workOrder: { ...BASE_WORK_ORDER, status: 'under_review' },
      tasks: [{ id: 't1', title: 'Launch checklist', status: 'completed' }],
    }));
    expect(report.narrative).toMatch(/Work Order itself has not yet been marked completed/i);
  });

  it('never claims a live financial-provider connection in the narrative', () => {
    const report = buildCompletionReport(baseInput({
      tasks: [{ id: 't1', title: 'Financial assumptions', status: 'completed' }],
      evidence: [{ id: 'e1', task_id: 't1', kind: 'note' }],
    }));
    expect(report.narrative.toLowerCase()).not.toContain('stripe');
    expect(report.narrative.toLowerCase()).not.toContain('i2c');
    expect(report.narrative.toLowerCase()).not.toContain('connected to');
  });
});
