/**
 * Audit-row writer for the WorkOS shared-platform routes.
 *
 * api/_middleware/audit.ts's `audit()` helper is typed against Express's
 * AuthenticatedRequest (used by the legacy api/_server.ts routes). The
 * WorkOS routes run as standalone Vercel functions with actor identity
 * already resolved by api/_lib/authz.ts, so this is a small, accurately-
 * typed writer for that context rather than a shim over the Express type.
 *
 * Same posture as api/_middleware/audit.ts: fire-and-forget, logged
 * locally on failure, never throws into the caller.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SourceApp } from './platformEvents.js';

export interface RecordAuditInput {
  churchId: string;
  /** Null for member-self-service actions — there is no `users` row for a portal member. */
  actorUserId: string | null;
  actorClerkId?: string | null;
  action: string; // 'create' | 'update' | 'delete' | 'decide' | ...
  entityType: string;
  entityId?: string | null;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  reason?: string | null;
  sourceApp?: SourceApp;
  correlationId?: string;
  route?: string;
  method?: string;
}

export async function recordAudit(supabase: SupabaseClient, input: RecordAuditInput): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    church_id: input.churchId,
    actor_user_id: input.actorUserId,
    actor_clerk_id: input.actorClerkId ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    reason: input.reason ?? null,
    source_app: input.sourceApp ?? 'admin_dashboard',
    correlation_id: input.correlationId ?? null,
    route: input.route ?? null,
    method: input.method ?? null,
  });

  if (error) {
    console.error('[workosAudit] write failed', {
      entity_type: input.entityType,
      action: input.action,
      error: error.message,
    });
  }
}
