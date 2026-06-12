/**
 * Member activity logger — the tracking spine between the member portal
 * and the admin CRM. Every portal action calls logMemberActivity so staff
 * (and GRACE) can monitor engagement per member.
 *
 * Fire-and-forget: activity logging must never break a member-facing flow.
 * No-ops in demo mode (no Supabase).
 */

import { supabase } from '../supabase';
import { createLogger } from '../../utils/logger';
import type { MemberActivityEventType } from '../database.types';

const log = createLogger('member-activity');

export interface MemberActivityInput {
  churchId: string;
  personId?: string | null;
  eventType: MemberActivityEventType;
  entityType?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export function logMemberActivity(input: MemberActivityInput): void {
  if (!supabase) return;
  void supabase
    .from('member_activity_events')
    .insert({
      church_id: input.churchId,
      person_id: input.personId ?? null,
      event_type: input.eventType,
      entity_type: input.entityType ?? null,
      entity_id: input.entityId ?? null,
      metadata: input.metadata ?? {},
    })
    .then(({ error }) => {
      if (error) log.warn(`activity log failed (${input.eventType})`, error.message);
    });
}
