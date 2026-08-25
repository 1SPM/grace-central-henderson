/**
 * Runnable agent workflows — the "implemented: true" subset of the
 * registry (api/_lib/agentRegistry.ts).
 *
 * Deliberately simple and deterministic: each workflow reads real rows
 * from real tables and writes real agent_runs/agent_actions rows. No LLM
 * calls, no randomness, no simulated latency. This is what the WorkOS
 * spec means by "controlled local or server-side workflows" — a scanner,
 * not an autonomous actor. None of these workflows mutate product data;
 * every action they record is an observation that a human then acts on
 * elsewhere in the dashboard (Work Order status changes, approval
 * decisions, etc. all go through their own permission-gated routes).
 * A future workflow that proposes a mutation must set
 * requires_approval: true on the finding — the run endpoint records it
 * as 'proposed' and never auto-executes it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { bucketLedgerRows, detectReconciliationAnomalies } from './webhooks/reconcile.js';
import { PLATFORM_FEE_BPS, PLATFORM_FEE_PERCENT } from './billing/givingFee.js';

export interface AgentFinding {
  action_type: string;
  target_entity_type: string;
  target_entity_id: string | null;
  payload: Record<string, unknown>;
  /**
   * A finding that proposes a real mutation must declare it. Omitted or
   * false = pure observation, recorded as executed immediately. True =
   * never auto-executed: actionRowForFinding maps it to status
   * 'proposed' with no executed_at, and — because no consumer of
   * 'proposed' agent_actions rows exists yet (nothing links an approvals
   * row or executes on approval, and persistWorkflowFindings is
   * observation-only) — the run endpoint currently fails the run loudly
   * rather than writing a proposal nothing will ever read. Build that
   * pipeline, then remove the endpoint guard, before shipping the first
   * workflow that sets this flag.
   */
  requires_approval?: boolean;
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

interface LedgerRowForSteward {
  id: string; church_id: string; source: string; kind: string; direction: 'credit' | 'debit';
  amount_micro_usd: number; occurred_at: string;
  metadata: Record<string, unknown> | null;
}

interface PlatformFeeMismatch {
  id: string; occurredAt: string; detail: string;
  expected: number; actual: number; reference: string | null;
}

// Ground truth is whatever Stripe actually applied to the transaction
// (recorded into ledger metadata by the webhook handlers — see
// webhooks/stripe-handlers.ts), not the rate constant alone: this catches
// both a future code drift AND any transaction Stripe itself charged
// incorrectly. Rows with no recorded fee data (older than this check, or
// a non-donation credit) are skipped rather than flagged — silence there
// means "nothing to compare," not "compliant."
function detectPlatformFeeMismatches(rows: LedgerRowForSteward[]): PlatformFeeMismatch[] {
  const mismatches: PlatformFeeMismatch[] = [];

  for (const row of rows) {
    if (row.source !== 'stripe' || row.kind !== 'donation' || row.direction !== 'credit') continue;
    const meta = row.metadata ?? {};

    const feeAmountCents = meta.platform_fee_amount_cents;
    if (typeof feeAmountCents === 'number') {
      const grossCents = row.amount_micro_usd / 10_000;
      const expectedCents = Math.floor((grossCents * PLATFORM_FEE_BPS) / 10_000);
      if (feeAmountCents !== expectedCents) {
        mismatches.push({
          id: row.id,
          occurredAt: row.occurred_at,
          detail: 'one_time_fee_amount',
          expected: expectedCents,
          actual: feeAmountCents,
          reference: typeof meta.stripe_payment_intent_id === 'string' ? meta.stripe_payment_intent_id : null,
        });
      }
      continue;
    }

    const feePercent = meta.platform_fee_percent;
    if (typeof feePercent === 'number') {
      if (Math.abs(feePercent - PLATFORM_FEE_PERCENT) > 1e-9) {
        mismatches.push({
          id: row.id,
          occurredAt: row.occurred_at,
          detail: 'recurring_fee_percent',
          expected: PLATFORM_FEE_PERCENT,
          actual: feePercent,
          reference: typeof meta.stripe_subscription_id === 'string' ? meta.stripe_subscription_id : null,
        });
      }
    }
    // Neither field present: pre-dates fee-recording or not a card
    // charge we take a percentage of — nothing to verify, skip.
  }

  return mismatches;
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
    .select('id, church_id, source, kind, direction, amount_micro_usd, occurred_at, metadata')
    .eq('church_id', churchId)
    .gte('occurred_at', trailingStart.toISOString())
    .order('occurred_at', { ascending: true })
    .limit(2000);

  const allRows = (rows ?? []) as LedgerRowForSteward[];
  const yesterdayIso = yesterdayStart.toISOString();
  const yesterdayEndIso = yesterdayEnd.toISOString();
  const yesterdayRows = allRows.filter(r => r.occurred_at >= yesterdayIso && r.occurred_at < yesterdayEndIso);
  const trailingRows = allRows.filter(r => r.occurred_at < yesterdayIso);

  const anomalies = detectReconciliationAnomalies(bucketLedgerRows(yesterdayRows), bucketLedgerRows(trailingRows));
  const feeMismatches = detectPlatformFeeMismatches(allRows);

  const findings: AgentFinding[] = [
    ...anomalies.map(a => ({
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
    })),
    ...feeMismatches.map(m => ({
      action_type: 'flag_platform_fee_mismatch',
      target_entity_type: 'ledger_entry',
      target_entity_id: m.id,
      payload: {
        detail: m.detail,
        expected: m.expected,
        actual: m.actual,
        occurred_at: m.occurredAt,
        stripe_reference: m.reference,
      },
    })),
  ];

  const parts: string[] = [];
  if (anomalies.length) parts.push(`${anomalies.length} reconciliation anomal${anomalies.length === 1 ? 'y' : 'ies'} in yesterday's giving ledger`);
  if (feeMismatches.length) parts.push(`${feeMismatches.length} transaction${feeMismatches.length === 1 ? '' : 's'} in the trailing window where the applied platform fee doesn't match the expected ${PLATFORM_FEE_PERCENT}% rate`);

  return {
    findings,
    summary: parts.length ? `Found ${parts.join(', ')}.` : 'No reconciliation anomalies or platform-fee mismatches found in the trailing 7-day ledger window.',
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

/**
 * Maps a workflow finding onto the agent_actions row fields that encode
 * its approval lifecycle. The invariant this encodes: an approval-
 * requiring finding is recorded as 'proposed' with no executed_at and is
 * never auto-executed; an observation executes immediately. Kept as a
 * pure function so the invariant is unit-testable (agentWorkflows.test.ts)
 * instead of living only inside the run endpoint's insert call.
 */
export function actionRowForFinding(finding: AgentFinding, now: Date) {
  // Boolean(), not === true: a truthy-but-not-literal-true leak must
  // fail closed into 'proposed', never auto-execute.
  const proposed = Boolean(finding.requires_approval);
  return {
    action_type: finding.action_type,
    target_entity_type: finding.target_entity_type,
    target_entity_id: finding.target_entity_id,
    payload: finding.payload,
    requires_approval: proposed,
    status: proposed ? 'proposed' : 'executed',
    executed_at: proposed ? null : now.toISOString(),
  };
}

/**
 * Every runnable workflow key, for the registry↔workflow binding test —
 * the registry's `implemented` flags and this map must never drift
 * (a mismatch is a live "Run now" button that 501s, or a runnable agent
 * the UI presents as unbuilt).
 */
export function listWorkflowKeys(): string[] {
  return Object.keys(WORKFLOWS);
}
