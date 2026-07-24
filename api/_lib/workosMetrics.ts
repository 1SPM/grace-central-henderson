/**
 * Executive Overview metric catalog — pure metadata, no queries.
 *
 * Every metric the Admin Dashboard shows must be traceable to a real
 * table and carry a definition, reporting period, and source (per the
 * WorkOS spec: "only show metrics that are currently supportable by real
 * data" and "every metric must include definition, reporting period,
 * source, last-updated time, and drill-down where available").
 *
 * `api/workos/_summary.ts` computes `value` for each key at request time
 * and merges it with this catalog. Split out so the catalog itself
 * (labels, definitions, sourcing) is unit-testable without a database.
 */

export type MetricKey =
  | 'active_members'
  | 'households'
  | 'attendance_last_7_days'
  | 'newcomers_last_30_days'
  | 'volunteers_placed'
  | 'open_care_requests'
  | 'unresolved_follow_ups'
  | 'active_work_orders'
  | 'overdue_tasks'
  | 'pending_approvals'
  | 'recent_agent_runs'
  | 'data_quality_unreachable_members';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  definition: string;
  period: string;
  source: string;
  drilldown?: { view: string; tab?: string };
}

export const METRIC_CATALOG: MetricDefinition[] = [
  {
    key: 'active_members',
    label: 'Active members',
    definition: "People whose status is 'member' or 'leader'.",
    period: 'Point-in-time (as of now)',
    source: 'people',
    drilldown: { view: 'people' },
  },
  {
    key: 'households',
    label: 'Households',
    definition: 'Household records on file.',
    period: 'Point-in-time (as of now)',
    source: 'households',
  },
  {
    key: 'attendance_last_7_days',
    label: 'Attendance (last 7 days)',
    definition: 'Check-in records with a date in the last 7 days.',
    period: 'Trailing 7 days',
    source: 'attendance',
    drilldown: { view: 'attendance' },
  },
  {
    key: 'newcomers_last_30_days',
    label: 'Newcomers (last 30 days)',
    definition: 'People whose first_visit date falls in the last 30 days.',
    period: 'Trailing 30 days',
    source: 'people.first_visit',
    drilldown: { view: 'pipeline' },
  },
  {
    key: 'volunteers_placed',
    label: 'Volunteers placed',
    definition: "Volunteer interest submissions with status = 'placed'.",
    period: 'Point-in-time (as of now)',
    source: 'volunteer_interests',
  },
  {
    key: 'open_care_requests',
    label: 'Open care requests',
    definition: "Care requests not in 'resolved' or 'closed' status.",
    period: 'Point-in-time (as of now)',
    source: 'care_requests',
    drilldown: { view: 'pastoral-care' },
  },
  {
    key: 'unresolved_follow_ups',
    label: 'Unresolved follow-ups',
    definition: "Tasks with category = 'follow-up' and completed = false.",
    period: 'Point-in-time (as of now)',
    source: 'tasks',
    drilldown: { view: 'tasks' },
  },
  {
    key: 'active_work_orders',
    label: 'Active Work Orders',
    definition: "Work Orders not in 'completed' or 'cancelled' status.",
    period: 'Point-in-time (as of now)',
    source: 'work_orders',
    drilldown: { view: 'workos', tab: 'work-orders' },
  },
  {
    key: 'overdue_tasks',
    label: 'Overdue tasks',
    definition: 'Tasks with completed = false and due_date before today.',
    period: 'Point-in-time (as of now)',
    source: 'tasks',
    drilldown: { view: 'tasks' },
  },
  {
    key: 'pending_approvals',
    label: 'Pending approvals',
    definition: "Approval requests with status = 'pending'.",
    period: 'Point-in-time (as of now)',
    source: 'approvals',
    drilldown: { view: 'workos', tab: 'approvals' },
  },
  {
    key: 'recent_agent_runs',
    label: 'Agent runs (last 7 days)',
    definition: 'Agent run records started in the last 7 days, any status.',
    period: 'Trailing 7 days',
    source: 'agent_runs',
    drilldown: { view: 'workos', tab: 'agents' },
  },
  {
    key: 'data_quality_unreachable_members',
    label: 'Members with no contact info',
    definition: "Members ('member' or 'leader' status) with no email AND no phone on file.",
    period: 'Point-in-time (as of now)',
    source: 'people',
    drilldown: { view: 'people' },
  },
];
