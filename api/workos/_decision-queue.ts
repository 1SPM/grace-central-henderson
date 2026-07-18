/**
 * GET /api/workos/decision-queue
 *
 * The unified Decision Queue — everything awaiting a human decision,
 * severity-ordered, across approvals, pastoral care, Impact Card
 * operations, stalled invitations, and agent-generated tasks.
 *
 * Auth: any active staff user (resolveStaffActor). Each category is
 * only fetched — and only appears in the response — if the caller
 * holds that category's gating permission. There is no blanket 403;
 * a caller with zero relevant permissions simply gets an empty queue.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveStaffActor } from '../_lib/authz.js';
import {
  computeDecisionQueue,
  type ApprovalRow,
  type CareRequestRow,
  type KycRow,
  type FailedTransferRow,
  type StalledInvitationRow,
  type AgentTaskRow,
} from '../_lib/decisionQueue.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;

  const churchId = actor.churchId;
  const has = (key: string) => actor.permissions.has(key);

  const [
    approvalsRes,
    careRequestsRes,
    kycRes,
    failedTransfersRes,
    stalledInvitationsRes,
    agentTasksRes,
  ] = await Promise.all([
    has('approvals.view')
      ? supabase
          .from('approvals')
          .select('id, status, risk_level, entity_type, entity_id, created_at, related_party_flagged, related_party_reviewed_at')
          .eq('church_id', churchId)
          .eq('status', 'pending')
          .limit(200)
      : Promise.resolve({ data: [] as ApprovalRow[] }),
    has('care.view')
      ? supabase
          .from('care_requests')
          .select('id, status, priority, crisis_flagged, created_at')
          .eq('church_id', churchId)
          .in('status', ['submitted', 'triaged', 'assigned', 'in_progress'])
          .limit(200)
      : Promise.resolve({ data: [] as CareRequestRow[] }),
    has('impact_card.operate')
      ? supabase
          .from('kyc_verifications')
          .select('id, status, submitted_at, person_id')
          .eq('church_id', churchId)
          .in('status', ['pending', 'in_review'])
          .limit(200)
      : Promise.resolve({ data: [] as KycRow[] }),
    has('impact_card.operate')
      ? supabase
          .from('card_transfers')
          .select('id, transfer_type, direction, initiated_at')
          .eq('church_id', churchId)
          .eq('status', 'failed')
          .limit(200)
      : Promise.resolve({ data: [] as FailedTransferRow[] }),
    // No granular permission key exists for invitations yet (see
    // api/_lib/decisionQueue.ts's 'staff' sentinel comment) — any
    // resolved staff actor sees this category.
    supabase
      .from('member_invitations')
      .select('id, person_id, sent_at, created_at')
      .eq('church_id', churchId)
      .eq('status', 'sent')
      .lt('sent_at', new Date(Date.now() - 7 * 86_400_000).toISOString())
      .limit(200),
    has('agents.view')
      ? supabase
          .from('tasks')
          .select('id, title, created_at')
          .eq('church_id', churchId)
          .eq('completed', false)
          .like('category', 'agent:%')
          .limit(200)
      : Promise.resolve({ data: [] as AgentTaskRow[] }),
  ]);

  const result = computeDecisionQueue(
    {
      approvals: (approvalsRes.data ?? []) as ApprovalRow[],
      careRequests: (careRequestsRes.data ?? []) as CareRequestRow[],
      kycVerifications: (kycRes.data ?? []) as KycRow[],
      failedTransfers: (failedTransfersRes.data ?? []) as FailedTransferRow[],
      stalledInvitations: (stalledInvitationsRes.data ?? []) as StalledInvitationRow[],
      agentTasks: (agentTasksRes.data ?? []) as AgentTaskRow[],
    },
    new Date(),
  );

  return res.status(200).json(result);
}
