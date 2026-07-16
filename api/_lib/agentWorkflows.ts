/**
 * Runnable agent workflows — the "implemented: true" subset of the
 * registry (api/_lib/agentRegistry.ts).
 *
 * Deliberately simple and deterministic: each workflow reads real rows
 * from real tables and writes real agent_runs/agent_actions rows. No LLM
 * calls, no randomness, no simulated latency. This is what the WorkOS
 * spec means by "controlled local or server-side workflows" — a scanner,
 * not an autonomous actor. None of these workflows mutate product data;
 * every action they record is an observation (requires_approval: false,
 * status: 'executed' immediately) that a human then acts on elsewhere in
 * the dashboard (Work Order status changes, approval decisions, etc. all
 * go through their own permission-gated routes).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { bucketLedgerRows, detectReconciliationAnomalies } from './webhooks/reconcile.js';

export interface AgentFinding {
  action_type: string;
  target_entity_type: string;
  target_entity_id: string | null;
  payload: Record<string, unknown>;
}

export interface AgentWorkflowResult {
  findings: AgentFinding[];
  summary: string;
}

type Workflow = (supabase: SupabaseClient, churchId: string) => Promise<AgentWorkflowResult>;

async function runGraceOrchestrator(supabase: SupabaseClient, churchId: string): Promise<AgentWorkflowResult> {
  const today = new Date().toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

  const [{ data: overdueTasks }, { data: blockedWorkOrders }, { data: stalePendingApprovals }] = await Promise.all([
    supabase.from('tasks').select('id, title, due_date').eq('church_id', churchId).eq('completed', false).lt('due_date', today).limit(25),
    supabase.from('work_orders').select('id, title').eq('church_id', churchId).eq('status', 'blocked').limit(25),
    supabase.from('approvals').select('id, proposed_action, requested_at').eq('church_id', churchId).eq('status', 'pending').lt('requested_at', twoDaysAgo).limit(25),
  ]);

  const findings: AgentFinding[] = [
    ...(overdueTasks ?? []).map(t => ({
      action_type: 'flag_overdue_task',
      target_entity_type: 'task',
      target_entity_id: t.id,
      payload: { title: t.title, due_date: t.due_date },
    })),
    ...(blockedWorkOrders ?? []).map(w => ({
      action_type: 'flag_blocked_work_order',
      target_entity_type: 'work_order',
      target_entity_id: w.id,
      payload: { title: w.title },
    })),
    ...(stalePendingApprovals ?? []).map(a => ({
      action_type: 'flag_stale_approval',
      target_entity_type: 'approval',
      target_entity_id: a.id,
      payload: { proposed_action: a.proposed_action, requested_at: a.requested_at },
    })),
  ];

  const parts: string[] = [];
  if (overdueTasks?.length) parts.push(`${overdueTasks.length} overdue task${overdueTasks.length === 1 ? '' : 's'}`);
  if (blockedWorkOrders?.length) parts.push(`${blockedWorkOrders.length} blocked Work Order${blockedWorkOrders.length === 1 ? '' : 's'}`);
  if (stalePendingApprovals?.length) parts.push(`${stalePendingApprovals.length} approval${stalePendingApprovals.length === 1 ? '' : 's'} pending over 48 hours`);

  return {
    findings,
    summary: parts.length ? `Found ${parts.join(', ')}.` : 'No overdue tasks, blocked Work Orders, or stale approvals found.',
  };
}

async function runVerityQualityReview(supabase: SupabaseClient, churchId: string): Promise<AgentWorkflowResult> {
  const [{ data: unreachable }, { data: unownedWorkOrders }] = await Promise.all([
    supabase.from('people').select('id, first_name, last_name').eq('church_id', churchId).in('status', ['member', 'leader']).is('email', null).is('phone', null).limit(25),
    supabase.from('work_orders').select('id, title').eq('church_id', churchId).not('status', 'in', '(completed,cancelled)').is('owner_user_id', null).limit(25),
  ]);

  const findings: AgentFinding[] = [
    ...(unreachable ?? []).map(p => ({
      action_type: 'flag_missing_contact_info',
      target_entity_type: 'person',
      target_entity_id: p.id,
      payload: { name: `${p.first_name} ${p.last_name}` },
    })),
    ...(unownedWorkOrders ?? []).map(w => ({
      action_type: 'flag_unowned_work_order',
      target_entity_type: 'work_order',
      target_entity_id: w.id,
      payload: { title: w.title },
    })),
  ];

  const parts: string[] = [];
  if (unreachable?.length) parts.push(`${unreachable.length} member${unreachable.length === 1 ? '' : 's'} with no email or phone on file`);
  if (unownedWorkOrders?.length) parts.push(`${unownedWorkOrders.length} active Work Order${unownedWorkOrders.length === 1 ? '' : 's'} with no owner assigned`);

  return {
    findings,
    summary: parts.length ? `Found ${parts.join(', ')}.` : 'No data-quality issues found in this pass.',
  };
}

async function runSentinelComplianceReview(supabase: SupabaseClient, churchId: string): Promise<AgentWorkflowResult> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: staleRequests } = await supabase
    .from('data_subject_requests')
    .select('id, request_type, requested_at')
    .eq('church_id', churchId)
    .eq('status', 'pending')
    .lt('requested_at', sevenDaysAgo)
    .limit(25);

  const findings: AgentFinding[] = (staleRequests ?? []).map(r => ({
    action_type: 'flag_stale_data_subject_request',
    target_entity_type: 'data_subject_request',
    target_entity_id: r.id,
    payload: { request_type: r.request_type, requested_at: r.requested_at },
  }));

  return {
    findings,
    summary: staleRequests?.length
      ? `Found ${staleRequests.length} data-subject request${staleRequests.length === 1 ? '' : 's'} pending over 7 days.`
      : 'No overdue data-subject requests found.',
  };
}

async function runShepherdMemberCare(supabase: SupabaseClient, churchId: string): Promise<AgentWorkflowResult> {
  // "Awaiting assignment or response" — care_requests.status starts at
  // 'submitted', moves to 'triaged', then 'assigned'. Anything still in
  // the first two states hasn't been picked up by anyone yet.
  const { data: unassigned } = await supabase
    .from('care_requests')
    .select('id, category, priority, status, crisis_flagged, created_at')
    .eq('church_id', churchId)
    .in('status', ['submitted', 'triaged'])
    .order('created_at', { ascending: true })
    .limit(25);

  const requests = unassigned ?? [];
  const findings: AgentFinding[] = requests.map(r => ({
    action_type: 'flag_unassigned_care_request',
    target_entity_type: 'care_request',
    target_entity_id: r.id,
    // Deliberately no `summary` text here — care_requests is a
    // confidential-tier table; the finding says a request needs
    // attention, not what it's about.
    payload: { category: r.category, priority: r.priority, status: r.status, crisis_flagged: r.crisis_flagged, created_at: r.created_at },
  }));

  const crisisCount = requests.filter(r => r.crisis_flagged).length;
  const parts: string[] = [];
  if (requests.length) parts.push(`${requests.length} care request${requests.length === 1 ? '' : 's'} awaiting assignment or response`);
  if (crisisCount) parts.push(`${crisisCount} crisis-flagged`);

  return {
    findings,
    summary: parts.length ? `Found ${parts.join(', ')}.` : 'No care requests awaiting assignment or response.',
  };
}

async function runStewardFinancialOperations(supabase: SupabaseClient, churchId: string): Promise<AgentWorkflowResult> {
  // Same math as the nightly reconcile-stripe cron (api/_lib/webhooks/
  // reconcile.ts) — reused, not reimplemented — just scoped to one
  // church instead of a full-table cron sweep, and run on demand
  // instead of waiting for 06:00 UTC.
  const TRAILING_DAYS = 7;
  const now = new Date();
  const yesterdayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const yesterdayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const trailingStart = new Date(yesterdayStart.getTime() - TRAILING_DAYS * 86_400_000);

  const { data: rows } = await supabase
    .from('ledger_entries')
    .select('church_id, source, kind, direction, amount_micro_usd, occurred_at')
    .eq('church_id', churchId)
    .gte('occurred_at', trailingStart.toISOString())
    .order('occurred_at', { ascending: true })
    .limit(2000);

  const allRows = (rows ?? []) as {
    church_id: string; source: string; kind: string;
    direction: 'credit' | 'debit'; amount_micro_usd: number; occurred_at: string;
  }[];
  const yesterdayIso = yesterdayStart.toISOString();
  const yesterdayEndIso = yesterdayEnd.toISOString();
  const yesterdayRows = allRows.filter(r => r.occurred_at >= yesterdayIso && r.occurred_at < yesterdayEndIso);
  const trailingRows = allRows.filter(r => r.occurred_at < yesterdayIso);

  const anomalies = detectReconciliationAnomalies(bucketLedgerRows(yesterdayRows), bucketLedgerRows(trailingRows));

  const findings: AgentFinding[] = anomalies.map(a => ({
    action_type: 'flag_reconciliation_anomaly',
    target_entity_type: 'ledger_reconciliation',
    target_entity_id: null,
    payload: {
      source: a.source,
      date: a.date,
      kind: a.kind,
      detail: a.detail,
      today_usd: a.todayMicroUsd / 1_000_000,
      trailing_avg_usd: a.trailingAvgMicroUsd / 1_000_000,
    },
  }));

  return {
    findings,
    summary: anomalies.length
      ? `Found ${anomalies.length} reconciliation anomal${anomalies.length === 1 ? 'y' : 'ies'} in yesterday's giving ledger.`
      : 'No reconciliation anomalies found in the trailing 7-day ledger window.',
  };
}

const WORKFLOWS: Record<string, Workflow> = {
  grace: runGraceOrchestrator,
  verity: runVerityQualityReview,
  sentinel: runSentinelComplianceReview,
  shepherd: runShepherdMemberCare,
  steward: runStewardFinancialOperations,
};

export function getWorkflow(agentKey: string): Workflow | undefined {
  return WORKFLOWS[agentKey];
}
