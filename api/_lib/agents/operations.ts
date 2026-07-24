/**
 * Operations agent.
 *
 * Surfaces operational health issues that risk a Sunday going sideways:
 *   1. Upcoming events within N days (default 7) with no leader assigned.
 *   2. Overdue tasks — past due_date + still pending. Stewardship of
 *      the to-do list.
 *
 * Operations observations are mostly TASKS (admin needs to act).
 */

import type { AgentFunction, AgentObservation } from './types.js';

export const operationsAgent: AgentFunction = (input) => {
  if (!input.settings.operations_enabled) return [];

  const { now, settings, events, tasks } = input;
  const observations: AgentObservation[] = [];

  // ----- EVENTS WITHOUT LEADERS -----
  const horizonMs = settings.operations_event_no_leader_days * 86_400_000;
  for (const e of events) {
    if (e.leader_id) continue;
    const starts = new Date(e.starts_at);
    if (Number.isNaN(starts.getTime())) continue;
    if (starts <= now) continue;                                  // already started
    const msAway = starts.getTime() - now.getTime();
    if (msAway > horizonMs) continue;

    const daysAway = Math.floor(msAway / 86_400_000);
    observations.push({
      dedupKey: `operations:no-leader:${e.id}`,
      agentId: 'operations',
      kind: 'event_no_leader',
      severity: daysAway <= 2 ? 'urgent' : 'attention',
      // Absolute date, not "in N days" — persistObservation inserts once
      // per dedupKey and never updates the row on later runs (the runner
      // skips re-processing a finding it's already seen), so a relative
      // phrase baked in here goes stale the moment a day passes and
      // eventually contradicts the task's own Overdue badge.
      title: `"${e.title}" on ${starts.toISOString().slice(0, 10)} — no leader assigned`,
      detail: `Event is ${starts.toISOString().slice(0, 16).replace('T', ' ')}Z. Assign someone before it lands on Sunday with no owner.`,
      relatedId: e.id,
      metadata: { days_until_event: daysAway, event_starts_at: e.starts_at },
      outputSink: 'task',
    });
  }

  // ----- OVERDUE TASKS -----
  // We don't want to spam observations for tasks that are decades old;
  // cap at 60 days overdue. Beyond that someone has bigger problems.
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  for (const t of tasks) {
    if (t.status !== 'pending' && t.status !== 'in_progress') continue;
    if (!t.due_date) continue;
    const due = new Date(t.due_date + 'T00:00:00Z');
    if (Number.isNaN(due.getTime())) continue;
    if (due >= today) continue;                                   // not overdue
    const daysLate = Math.floor((today.getTime() - due.getTime()) / 86_400_000);
    if (daysLate > 60) continue;

    observations.push({
      dedupKey: `operations:overdue:${t.id}`,
      agentId: 'operations',
      kind: 'task_overdue',
      severity: daysLate >= 14 ? 'urgent' : daysLate >= 7 ? 'attention' : 'info',
      // Absolute due date, not "is N days overdue" — see the no-leader
      // observation above for why a relative phrase baked in here goes
      // stale (this row is inserted once per dedupKey and never updated).
      title: `Task "${t.title}" overdue (was due ${t.due_date})`,
      detail: `Originally due ${t.due_date}. Reassign, reschedule, or close.`,
      relatedId: t.id,
      metadata: { days_overdue: daysLate, original_due_date: t.due_date },
      outputSink: 'log_only',
    });
  }

  return observations;
};
