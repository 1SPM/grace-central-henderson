/**
 * Platform event emission.
 *
 * Single writer for the `platform_events` table (migration 036). Routes
 * never insert into platform_events directly — they call emitPlatformEvent
 * so the event catalog stays typed and every event automatically carries a
 * correlation_id that can also be stamped onto the audit_logs row for the
 * same operation (pass the same correlationId to both).
 *
 * This is also the seam WorkOS agents read through: an agent subscribes to
 * (queries) platform_events for the church it's scoped to instead of
 * getting direct table access to people/care_requests/giving — see
 * SHARED_BACKEND.md "Data boundaries".
 *
 * Failure mode matches api/_middleware/audit.ts: fire-and-forget, logged
 * locally, never fails the originating request.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

/**
 * The event-type catalog named in the WorkOS spec, plus the platform's own
 * lifecycle events. Kept as a union (not a DB CHECK constraint — see
 * migration 036) so new event types can ship without a migration, while
 * still giving callers autocomplete/typo protection.
 */
export type PlatformEventType =
  | 'member.profile.updated'
  | 'member.preferences.changed'
  | 'care.request.submitted'
  | 'care.request.updated'
  | 'group.join.requested'
  | 'event.rsvp.created'
  | 'volunteer.interest.submitted'
  | 'gift.completed'
  | 'impact.routing.updated'
  | 'impact.support.requested'
  | 'journey.step.completed'
  | 'community.post.created'
  | 'community.post.reported'
  | 'work_order.created'
  | 'work_order.status_changed'
  | 'work_order.approval_requested'
  | 'work_order.completed'
  | 'approval.decided'
  | 'consent.changed'
  | 'agent.run.completed'
  | 'contact.request.submitted'
  | 'prayer.request.submitted'
  | 'community.post.moderated'
  | 'giving.recurring_gift.cancelled'
  | 'assistant.tool_invoked'
  | 'finance.gift_in_kind.recorded'
  | 'finance.expense.recorded'
  | 'approval.related_party_flagged'
  | 'approval.related_party_reviewed'
  | 'agent_finding.triaged'
  | 'agent_finding.dismissed'
  | 'agent_finding.resolved'
  | 'agent_finding.converted';

export type SourceApp = 'admin_dashboard' | 'member_portal' | 'workos' | 'system' | 'webhook';

export interface EmitPlatformEventInput {
  churchId: string;
  eventType: PlatformEventType;
  sourceApp: SourceApp;
  actorUserId?: string | null;
  actorPersonId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  payload?: Record<string, unknown>;
  correlationId?: string;
}

export interface EmitPlatformEventResult {
  id: string | null;
  correlationId: string;
}

export async function emitPlatformEvent(
  supabase: SupabaseClient,
  input: EmitPlatformEventInput,
): Promise<EmitPlatformEventResult> {
  const correlationId = input.correlationId ?? randomUUID();

  const { data, error } = await supabase
    .from('platform_events')
    .insert({
      church_id: input.churchId,
      event_type: input.eventType,
      source_app: input.sourceApp,
      actor_user_id: input.actorUserId ?? null,
      actor_person_id: input.actorPersonId ?? null,
      subject_type: input.subjectType ?? null,
      subject_id: input.subjectId ?? null,
      payload: input.payload ?? {},
      correlation_id: correlationId,
    })
    .select('id')
    .single();

  if (error) {
    console.error('[platformEvents] emit failed', {
      event_type: input.eventType,
      church_id: input.churchId,
      error: error.message,
    });
    return { id: null, correlationId };
  }

  return { id: data.id as string, correlationId };
}
