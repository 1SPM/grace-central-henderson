/**
 * Turns a Members Portal submission (group join request, volunteer
 * interest, contact-the-church message) into a real, staff-visible
 * Work Order task — the exact flow named in the WorkOS spec:
 *
 *   Volunteer interest submitted
 *   → platform event
 *   → staff task created
 *   → authorized coordinator receives assignment
 *   → member sees request status
 *
 * All portal-originated requests land as tasks inside one standing,
 * per-church "Member Portal Requests" Work Order (found-or-created on
 * first use) rather than a new Work Order per submission — keeps the
 * Work Order Centre from being flooded with one-task Work Orders for
 * routine member activity, while still giving staff a single real
 * queue and giving the member a real status to check.
 *
 * Member-facing status is a small, deliberately simplified label set —
 * never the internal work_order_tasks.status value verbatim, and never
 * anything that leaks staff notes, owner identity, or agent reasoning.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type PortalRequestType = 'group_join' | 'volunteer_interest' | 'contact_church';

export type MemberFacingStatus = 'Received' | 'Assigned' | 'In Progress' | 'Waiting for Information' | 'Completed';

export function toMemberFacingStatus(taskStatus: string, hasOwner: boolean): MemberFacingStatus {
  switch (taskStatus) {
    case 'pending':
      return hasOwner ? 'Assigned' : 'Received';
    case 'in_progress':
      return 'In Progress';
    case 'blocked':
      return 'Waiting for Information';
    case 'under_review':
      return 'In Progress';
    case 'completed':
    case 'cancelled':
      return 'Completed';
    default:
      return 'Received';
  }
}

const REQUEST_WORK_ORDER_TITLE = 'Member Portal Requests';

async function findOrCreatePortalWorkOrder(supabase: SupabaseClient, churchId: string): Promise<string | null> {
  const { data: existing } = await supabase
    .from('work_orders')
    .select('id')
    .eq('church_id', churchId)
    .eq('title', REQUEST_WORK_ORDER_TITLE)
    .not('status', 'in', '(completed,cancelled)')
    .maybeSingle();
  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from('work_orders')
    .insert({
      church_id: churchId,
      title: REQUEST_WORK_ORDER_TITLE,
      description: 'Standing Work Order collecting member-initiated requests from the Members Portal — group join requests, volunteer interest, and contact-the-church messages.',
      status: 'in_progress',
      priority: 'medium',
      ministry: 'Member Services',
      sensitivity: 'internal',
      requested_by_agent: 'member-portal',
    })
    .select('id')
    .single();
  if (error || !created) {
    console.error('[portalRequestTask] work order find-or-create failed', error);
    return null;
  }
  return created.id;
}

export interface CreatePortalRequestTaskInput {
  churchId: string;
  personId: string;
  requestType: PortalRequestType;
  title: string;
  description?: string;
}

export interface CreatePortalRequestTaskResult {
  taskId: string | null;
  workOrderId: string | null;
}

export async function createPortalRequestTask(
  supabase: SupabaseClient,
  input: CreatePortalRequestTaskInput,
): Promise<CreatePortalRequestTaskResult> {
  const workOrderId = await findOrCreatePortalWorkOrder(supabase, input.churchId);
  if (!workOrderId) return { taskId: null, workOrderId: null };

  const { data: task, error } = await supabase
    .from('work_order_tasks')
    .insert({
      work_order_id: workOrderId,
      church_id: input.churchId,
      title: input.title,
      description: input.description ?? null,
      status: 'pending',
      priority: 'medium',
      requested_by_person_id: input.personId,
      metadata: { request_type: input.requestType },
    })
    .select('id')
    .single();
  if (error || !task) {
    console.error('[portalRequestTask] task create failed', error);
    return { taskId: null, workOrderId };
  }
  return { taskId: task.id, workOrderId };
}
