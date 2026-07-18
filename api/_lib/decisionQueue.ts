/**
 * Unified Decision Queue — aggregates everything awaiting a human
 * decision across the platform into one severity-ordered list.
 *
 * Pure function — no IO. The route (api/workos/_decision-queue.ts)
 * fetches each category's raw rows (only for categories the caller
 * holds the gating permission for) and passes them in here.
 *
 * Confidentiality: care/crisis titles never include the request summary
 * text — category + priority + age only, matching the convention
 * already established for agent findings (Shepherd) surfacing care
 * signals without exposing confidential content.
 */

export type DecisionQueueKind =
  | 'approval'
  | 'related_party_review'
  | 'crisis'
  | 'care_triage'
  | 'kyc_review'
  | 'failed_transfer'
  | 'invitation_stalled'
  | 'agent_task';

export interface DecisionQueueItem {
  id: string;
  kind: DecisionQueueKind;
  title: string;
  detail?: string;
  severity: 'critical' | 'high' | 'normal';
  created_at: string;
  age_hours: number;
  href: string;
  required_permission: string;
  subject_type: string;
  subject_id: string;
}

const SEVERITY_RANK: Record<DecisionQueueItem['severity'], number> = {
  critical: 0,
  high: 1,
  normal: 2,
};

const HIGHEST_RISK_LEVEL = 'critical';
const HIGHEST_CARE_PRIORITY = 'crisis';

function ageHours(createdAt: string, now: Date): number {
  const created = new Date(createdAt).getTime();
  if (Number.isNaN(created)) return 0;
  return Math.max(0, (now.getTime() - created) / (1000 * 60 * 60));
}

export interface ApprovalRow {
  id: string;
  status: string;
  risk_level: string;
  entity_type: string;
  entity_id: string;
  created_at: string;
  related_party_flagged: boolean;
  related_party_reviewed_at: string | null;
}

export interface CareRequestRow {
  id: string;
  status: string;
  priority: string;
  crisis_flagged: boolean;
  created_at: string;
}

export interface KycRow {
  id: string;
  status: string;
  submitted_at: string;
  person_id: string;
}

export interface FailedTransferRow {
  id: string;
  transfer_type: string;
  direction: string;
  initiated_at: string;
}

export interface StalledInvitationRow {
  id: string;
  person_id: string;
  sent_at: string | null;
  created_at: string;
}

export interface AgentTaskRow {
  id: string;
  title: string;
  created_at: string;
}

export interface DecisionQueueInputs {
  approvals?: ApprovalRow[];
  careRequests?: CareRequestRow[];
  kycVerifications?: KycRow[];
  failedTransfers?: FailedTransferRow[];
  stalledInvitations?: StalledInvitationRow[];
  agentTasks?: AgentTaskRow[];
}

export interface DecisionQueueResult {
  items: DecisionQueueItem[];
  counts: {
    total: number;
    critical: number;
    by_kind: Partial<Record<DecisionQueueKind, number>>;
  };
}

export function computeDecisionQueue(inputs: DecisionQueueInputs, now: Date): DecisionQueueResult {
  const items: DecisionQueueItem[] = [];

  for (const a of inputs.approvals ?? []) {
    if (a.status !== 'pending') continue;
    // A related-party-flagged, not-yet-reviewed approval gets its own
    // higher-priority item in addition to the base approval item — the
    // decision maker needs to see the flag before deciding.
    if (a.related_party_flagged && !a.related_party_reviewed_at) {
      items.push({
        id: `${a.id}-related-party`,
        kind: 'related_party_review',
        title: 'Related-party approval needs review',
        detail: `${a.entity_type} approval`,
        severity: 'high',
        created_at: a.created_at,
        age_hours: ageHours(a.created_at, now),
        href: `#/workos?tab=approvals&id=${a.id}`,
        required_permission: 'approvals.view',
        subject_type: 'approval',
        subject_id: a.id,
      });
    }
    items.push({
      id: a.id,
      kind: 'approval',
      title: `Approval awaiting decision — ${a.entity_type}`,
      detail: `Risk: ${a.risk_level}`,
      severity: a.risk_level === HIGHEST_RISK_LEVEL ? 'critical' : 'high',
      created_at: a.created_at,
      age_hours: ageHours(a.created_at, now),
      href: `#/workos?tab=approvals&id=${a.id}`,
      required_permission: 'approvals.view',
      subject_type: 'approval',
      subject_id: a.id,
    });
  }

  const OPEN_CARE_STATUSES = new Set(['submitted', 'triaged', 'assigned', 'in_progress']);
  for (const c of inputs.careRequests ?? []) {
    if (!OPEN_CARE_STATUSES.has(c.status)) continue;
    if (c.crisis_flagged) {
      items.push({
        id: c.id,
        kind: 'crisis',
        title: 'Crisis-flagged care request',
        detail: `Priority: ${c.priority}`,
        severity: 'critical',
        created_at: c.created_at,
        age_hours: ageHours(c.created_at, now),
        href: '#/pastoral-care',
        required_permission: 'care.view',
        subject_type: 'care_request',
        subject_id: c.id,
      });
      continue;
    }
    if (c.status !== 'submitted') continue;
    items.push({
      id: c.id,
      kind: 'care_triage',
      title: 'Care request awaiting triage',
      detail: `Priority: ${c.priority}`,
      severity: c.priority === HIGHEST_CARE_PRIORITY ? 'high' : 'normal',
      created_at: c.created_at,
      age_hours: ageHours(c.created_at, now),
      href: '#/pastoral-care?tab=requests',
      required_permission: 'care.view',
      subject_type: 'care_request',
      subject_id: c.id,
    });
  }

  const OPEN_KYC_STATUSES = new Set(['pending', 'in_review']);
  for (const k of inputs.kycVerifications ?? []) {
    if (!OPEN_KYC_STATUSES.has(k.status)) continue;
    items.push({
      id: k.id,
      kind: 'kyc_review',
      title: 'Impact Card KYC review pending',
      detail: `Status: ${k.status.replace('_', ' ')}`,
      severity: 'normal',
      created_at: k.submitted_at,
      age_hours: ageHours(k.submitted_at, now),
      href: '#/wallets',
      required_permission: 'impact_card.operate',
      subject_type: 'kyc_verification',
      subject_id: k.id,
    });
  }

  for (const t of inputs.failedTransfers ?? []) {
    items.push({
      id: t.id,
      kind: 'failed_transfer',
      title: 'Failed Impact Card transfer',
      detail: `${t.transfer_type} · ${t.direction}`,
      severity: 'high',
      created_at: t.initiated_at,
      age_hours: ageHours(t.initiated_at, now),
      href: '#/wallets',
      required_permission: 'impact_card.operate',
      subject_type: 'card_transfer',
      subject_id: t.id,
    });
  }

  for (const inv of inputs.stalledInvitations ?? []) {
    const createdAt = inv.sent_at ?? inv.created_at;
    items.push({
      id: inv.id,
      kind: 'invitation_stalled',
      title: 'Member invitation stalled',
      detail: 'Sent 7+ days ago, not yet accepted',
      severity: 'normal',
      created_at: createdAt,
      age_hours: ageHours(createdAt, now),
      // No dedicated invitations screen exists yet — Congregation is the
      // closest actionable place to find the person and re-invite them.
      href: '#/people',
      // No granular permission key exists for member_invitations yet
      // (api/members/_invite.ts is coarse-gated on STAFF_ROLES) — 'staff'
      // is a sentinel meaning "any resolved staff actor", not a real
      // permissions-table key. TODO: mint member_invitations.view once
      // that route migrates to the granular RBAC model.
      required_permission: 'staff',
      subject_type: 'member_invitation',
      subject_id: inv.id,
    });
  }

  for (const task of inputs.agentTasks ?? []) {
    items.push({
      id: task.id,
      kind: 'agent_task',
      title: task.title,
      severity: 'normal',
      created_at: task.created_at,
      age_hours: ageHours(task.created_at, now),
      href: '#/workos?tab=agents',
      required_permission: 'agents.view',
      subject_type: 'task',
      subject_id: task.id,
    });
  }

  items.sort((a, b) => {
    const rankDiff = SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity];
    if (rankDiff !== 0) return rankDiff;
    return b.age_hours - a.age_hours;
  });

  const by_kind: Partial<Record<DecisionQueueKind, number>> = {};
  let critical = 0;
  for (const item of items) {
    by_kind[item.kind] = (by_kind[item.kind] ?? 0) + 1;
    if (item.severity === 'critical') critical++;
  }

  return {
    items,
    counts: { total: items.length, critical, by_kind },
  };
}
