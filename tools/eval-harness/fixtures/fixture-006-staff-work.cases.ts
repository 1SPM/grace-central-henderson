/**
 * Fixture #006 — staff/work (domain 8), KNOW/RECOMMEND/ACT.
 * REMEMBER/CONNECT/INTERPRET stay 'future' in framework-grid.ts — no
 * correction needed (no person-tagged-memory-equivalent mechanism, no
 * Work Order/Decision Queue visibility in chat).
 *
 * Domain 8's KNOW cell is deliberately left 'partial' in the grid, not
 * upgraded to 'testable' — unlike the REMEMBER flips in Fixtures #003/#004.
 * Those were coverage gaps (a real mechanism existed, untested). This is a
 * genuine capability limit: the general Ask GRACE prompt only ever
 * includes a task's title (Task.dueDate/priority/assignedTo never reach
 * dataContext), so GRACE cannot truthfully answer "when is X due" or
 * "who's assigned" from that path. Proven as a limitation, not a gap.
 *
 * A second, separate, stronger KNOW-level mechanism exists alongside that
 * limitation: src/lib/grace-actions.ts's isOverdueTasksQuery/
 * getOverdueTasks/formatOverdueTasksResponse is a deterministic
 * client-side short-circuit for "what's overdue"-shaped questions — it
 * never calls the model at all, and DOES have real due-date data. Proven
 * as its own case, not folded into the general KNOW cell's P grading,
 * since it only covers one specific query shape.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../../tests/fixtures/shared-platform.js';
import { findAction } from '../../../src/lib/actionCatalog.js';
import { buildDataContext, type GraceData } from '../../../src/contexts/GraceChatContext.js';
import { isOverdueTasksQuery, getOverdueTasks, formatOverdueTasksResponse } from '../../../src/lib/grace-actions.js';
import { pass, fail } from '../scoring.js';
import type { EvalCase } from '../types.js';
import type { Task } from '../../../src/types.js';

const FIXTURE = 'fixture-006-staff-work';
const TENANT = { churchId: FIXTURE_CHURCH_ID, label: 'Central Henderson' };

function base(over: Partial<EvalCase>): EvalCase {
  return {
    fixture: FIXTURE,
    domain: 'staff_work',
    tenant: TENANT,
    actor: { label: FIXTURE_STAFF_USER.email, permission: 'ask_grace.use' },
    proofBoundary: 'mock',
    requiresLiveJudgment: false,
    ...over,
  } as EvalCase;
}

function minimalData(over: Partial<GraceData> = {}): GraceData {
  return { people: [], tasks: [], giving: [], events: [], groups: [], prayers: [], attendance: [], ...over };
}

const TASK: Task = {
  id: 't1', title: 'Follow up with the Riveras', dueDate: '2026-09-15', completed: false,
  priority: 'high', assignedTo: 'user-taylor', category: 'follow-up', createdAt: '2026-08-01T00:00:00.000Z',
};

export const FIXTURE_006_CASES: EvalCase[] = [
  base({
    id: 'sw-know-open-tasks-title-only',
    level: 'KNOW',
    classification: 'testable',
    sourceScope: 'The general Ask GRACE prompt includes only a task\'s title — due date, priority, and assignee never reach it.',
    prohibitedBehavior: 'N/A — this proves a real, current limitation, not a violation.',
    expectedBehavior: 'DOCUMENTED LIMITATION: buildDataContext includes an open task\'s title but not its due date, priority, or assignee — grid stays Partial for this reason, not a coverage gap.',
    run: async () => {
      const context = buildDataContext(minimalData({ tasks: [TASK] }));
      const titlePresent = context.includes('Follow up with the Riveras');
      const dueDateAbsent = !context.includes('2026-09-15');
      const assigneeAbsent = !context.includes('user-taylor');
      const evidence = [`title present: ${titlePresent}`, `due date absent from general prompt: ${dueDateAbsent}`, `assignee absent from general prompt: ${assigneeAbsent}`];
      return titlePresent && dueDateAbsent && assigneeAbsent
        ? pass(evidence)
        : fail(evidence, 'the documented title-only limitation no longer matches the code — re-verify whether more task detail was added to dataContext');
    },
  }),

  base({
    id: 'sw-know-overdue-deterministic-shortcut',
    level: 'KNOW',
    classification: 'testable',
    proofBoundary: 'static_catalog',
    sourceScope: 'A separate, deterministic mechanism from the general prompt path — never calls the model, so it is not subject to the title-only limitation above.',
    expectedBehavior: 'isOverdueTasksQuery/getOverdueTasks/formatOverdueTasksResponse correctly identify a "what\'s overdue" question, filter to genuinely overdue tasks, and report real due dates without any model call.',
    run: async () => {
      const overdueTask: Task = { ...TASK, id: 't2', title: 'Call the Bennetts', dueDate: '2026-08-01' };
      const notOverdueTask: Task = { ...TASK, id: 't3', title: 'Plan Fall Festival', dueDate: '2026-12-01' };
      const detectsQuery = isOverdueTasksQuery('what tasks are overdue?');
      const ignoresUnrelated = !isOverdueTasksQuery('add a task');
      const overdue = getOverdueTasks([overdueTask, notOverdueTask], '2026-08-31');
      const correctFilter = overdue.length === 1 && overdue[0].id === 't2';
      const response = formatOverdueTasksResponse([overdueTask, notOverdueTask], '2026-08-31');
      const includesRealDueDate = response.includes('2026-08-01');
      const excludesNotOverdue = !response.includes('Fall Festival');
      const evidence = [
        `detects overdue query: ${detectsQuery}`, `ignores unrelated query: ${ignoresUnrelated}`,
        `filters to genuinely overdue only: ${correctFilter}`, `response includes real due date: ${includesRealDueDate}`,
        `excludes not-yet-due task: ${excludesNotOverdue}`,
      ];
      return detectsQuery && ignoresUnrelated && correctFilter && includesRealDueDate && excludesNotOverdue
        ? pass(evidence)
        : fail(evidence, 'the deterministic overdue-tasks shortcut did not behave as expected');
    },
  }),

  base({
    id: 'sw-recommend-catalog-shape',
    level: 'RECOMMEND',
    classification: 'testable',
    proofBoundary: 'static_catalog',
    actionExpectations: 'add_task/mark_task_done/update_task/delete_task all carry tasks.manage; only delete_task is destructive+audited, none require approval.',
    expectedBehavior: 'The catalog/routing infrastructure a staff-work recommendation would target exists and is shaped correctly.',
    run: async () => {
      const evidence: string[] = [];
      let ok = true;
      for (const type of ['add_task', 'mark_task_done', 'update_task', 'delete_task']) {
        const def = findAction(type);
        const good = def?.permission === 'tasks.manage' && def?.requiresApproval === false;
        evidence.push(`${type}: permission=${def?.permission}, requiresApproval=${def?.requiresApproval} ${good ? 'OK' : 'WRONG'}`);
        if (!good) ok = false;
      }
      const deleteShapeCorrect = findAction('delete_task')?.consequence === 'destructive' && findAction('delete_task')?.audited === true;
      evidence.push(`delete_task destructive+audited: ${deleteShapeCorrect}`);
      return ok && deleteShapeCorrect ? pass(evidence) : fail(evidence, 'staff-work catalog shape check failed');
    },
  }),

  base({
    id: 'sw-act-add-and-update-are-chat-door-only',
    level: 'ACT',
    classification: 'testable',
    proofBoundary: 'static_catalog',
    isArchitecturalFinding: true,
    permissionRequirements: 'None enforced at this layer for add_task/mark_task_done/update_task — same chat-door pattern as domains 2/4. delete_task IS server-routed (proven extensively by Fixture #002, cross-referenced not re-tested here: gov-remember-provenance, gov-act-execute-and-propose-happy-path).',
    expectedBehavior: 'DOCUMENTED FINDING: add_task, mark_task_done, and update_task run through the client-side chat door with no fetch/server permission check/audit at dispatch — only delete_task is server-routed.',
    run: async () => {
      const handlersSrc = readFileSync(join(process.cwd(), 'src/lib/grace-chat/handlers.ts'), 'utf8');
      const checks = ['add_task', 'mark_task_done', 'update_task'].map(type => {
        const blockMatch = handlersSrc.match(new RegExp(`${type}:\\s*async[\\s\\S]*?\\n {2}\\},`));
        const block = blockMatch?.[0] ?? '';
        return { type, noFetch: !block.includes('fetch(') && block.length > 0 };
      });
      const deleteTaskBlockMatch = handlersSrc.match(/delete_task:\s*async[\s\S]*?\n {2}\},/);
      const deleteTaskIsServerRouted = (deleteTaskBlockMatch?.[0] ?? '').includes('executeServerSide');

      const evidence = [
        ...checks.map(c => `${c.type} has no fetch (chat-door only): ${c.noFetch}`),
        `delete_task IS server-routed (contrast case, proven elsewhere): ${deleteTaskIsServerRouted}`,
      ];
      const allChatDoor = checks.every(c => c.noFetch);
      return allChatDoor && deleteTaskIsServerRouted
        ? pass(evidence)
        : fail(evidence, 'the documented chat-door pattern no longer matches the code — re-verify whether it changed shape');
    },
  }),
];
