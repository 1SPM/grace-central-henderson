/**
 * Maps Command Centre workflow findings (api/_lib/agentWorkflows.ts'
 * AgentFinding — action_type/target_entity/payload) onto agent_findings
 * rows, and persists them with the same lifecycle-aware dedup rule the
 * cron runner uses (api/_lib/agentFindingsDedup.ts), source='workflow'.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AgentFinding } from './agentWorkflows.js';
import { shouldSkipFinding, type ExistingFindingForDedup } from './agentFindingsDedup.js';

const ACTION_TYPE_TITLES: Record<string, string> = {
  flag_overdue_task: 'Overdue task',
  flag_blocked_work_order: 'Blocked Work Order',
  flag_stale_approval: 'Approval pending over 48 hours',
  flag_missing_contact_info: 'Member with no email or phone on file',
  flag_unowned_work_order: 'Work Order with no owner assigned',
  flag_stale_data_subject_request: 'Data-subject request pending over 7 days',
  flag_unassigned_care_request: 'Care request awaiting assignment or response',
  flag_reconciliation_anomaly: 'Giving ledger reconciliation anomaly',
};

export function dedupKeyForWorkflowFinding(agentKey: string, finding: AgentFinding): string {
  return `${agentKey}:${finding.action_type}:${finding.target_entity_id ?? 'none'}`;
}

export function titleForWorkflowFinding(finding: AgentFinding): string {
  return ACTION_TYPE_TITLES[finding.action_type]
    ?? finding.action_type.replace(/^flag_/, '').replace(/_/g, ' ');
}

/**
 * care_requests is a confidential-tier table — deliberately never surface
 * any of its payload as finding detail (same convention as
 * runShepherdMemberCare's own comment). Every other entity type may show
 * a short non-sensitive detail line pulled from its payload.
 */
export function detailForWorkflowFinding(finding: AgentFinding): string | null {
  if (finding.target_entity_type === 'care_request') return null;
  const payload = finding.payload;
  if (typeof payload.title === 'string') return payload.title;
  if (typeof payload.name === 'string') return payload.name;
  if (typeof payload.request_type === 'string') return `${payload.request_type} request`;
  if (typeof payload.source === 'string' && typeof payload.kind === 'string') {
    return `${payload.source} · ${payload.kind}`;
  }
  return null;
}

/**
 * Workflow findings carry no severity field of their own. A crisis-
 * flagged unassigned care request is the one case that should outrank
 * every other routine workflow flag; everything else is 'normal'.
 */
export function severityForWorkflowFinding(finding: AgentFinding): 'critical' | 'high' | 'normal' | 'info' {
  if (finding.target_entity_type === 'care_request' && finding.payload.crisis_flagged === true) {
    return 'critical';
  }
  return 'normal';
}

export async function persistWorkflowFindings(
  supabase: SupabaseClient,
  churchId: string,
  agentKey: string,
  findings: AgentFinding[],
  now: Date = new Date(),
): Promise<void> {
  if (findings.length === 0) return;

  const withKeys = findings.map(f => ({ finding: f, dedupKey: dedupKeyForWorkflowFinding(agentKey, f) }));
  const dedupKeys = withKeys.map(w => w.dedupKey);

  const { data } = await supabase
    .from('agent_findings')
    .select('dedup_key, status, suppress_until, created_at')
    .eq('church_id', churchId)
    .in('dedup_key', dedupKeys);

  const existingByKey = new Map<string, ExistingFindingForDedup[]>();
  for (const row of (data as Array<ExistingFindingForDedup & { dedup_key: string }> | null) ?? []) {
    const arr = existingByKey.get(row.dedup_key) ?? [];
    arr.push(row);
    existingByKey.set(row.dedup_key, arr);
  }

  const rowsToInsert = withKeys
    .filter(({ dedupKey }) => !shouldSkipFinding(existingByKey.get(dedupKey) ?? [], now))
    .map(({ finding, dedupKey }) => ({
      church_id: churchId,
      agent_id: agentKey,
      source: 'workflow' as const,
      dedup_key: dedupKey,
      title: titleForWorkflowFinding(finding),
      detail: detailForWorkflowFinding(finding),
      severity: severityForWorkflowFinding(finding),
      status: 'open' as const,
      subject_type: finding.target_entity_type,
      subject_id: finding.target_entity_id,
      payload: finding.payload,
    }));

  if (rowsToInsert.length === 0) return;

  const { error } = await supabase.from('agent_findings').insert(rowsToInsert);
  if (error) {
    console.error('[agents] workflow agent_findings insert failed', { agentKey, err: error.message });
  }
}
