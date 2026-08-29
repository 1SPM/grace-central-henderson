/**
 * Audit-row writer for the WorkOS shared-platform routes.
 *
 * api/_middleware/audit.ts's `audit()` helper is typed against Express's
 * AuthenticatedRequest (used by the legacy api/_server.ts routes). The
 * WorkOS routes run as standalone Vercel functions with actor identity
 * already resolved by api/_lib/authz.ts, so this is a small, accurately-
 * typed writer for that context rather than a shim over the Express type.
 *
 * On failure it does NOT throw — by the time audit runs the mutation has
 * usually already committed, so failing the request would turn a
 * missing-audit problem into a duplicate-mutation problem on retry. It
 * instead does two things the previous fire-and-forget version did not:
 *
 *   1. Returns the outcome, so a caller that cares can surface it. A
 *      caller that ignores the result is now making a visible choice
 *      rather than inheriting a silent one.
 *   2. Escalates to `security_events` — a DIFFERENT append-only table —
 *      so a failure specific to audit_logs (constraint, policy, shape) is
 *      still durably recorded somewhere. If the whole database is down,
 *      nothing helps; if only this write failed, the fact survives.
 *
 * What this is NOT: atomic. True transactional auditing would require the
 * mutation and its audit row to commit together, which PostgREST cannot
 * express from the client — every supabase-js call is its own
 * transaction. That needs the mutation moved into a Postgres function
 * (this codebase has no `.rpc()` usage today) or a trigger with actor
 * context threaded through session settings. Until then the guarantee is
 * "a missing audit row is loud and recorded", not "a mutation cannot
 * commit without one". Use recordAuditOrThrow where the weaker guarantee
 * is not good enough and the caller can still safely fail.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { SourceApp } from './platformEvents.js';
import { logSecurityEvent } from './securityLog.js';

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

export interface AuditResult {
  ok: boolean;
  /** Present only on failure. Not PII-safe — log it, never store it. */
  error?: string;
}

export async function recordAudit(supabase: SupabaseClient, input: RecordAuditInput): Promise<AuditResult> {
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
    // Deliberately NOT the raw Postgres message: it can quote offending
    // row values ("(email)=(...)"), and security_events.detail is
    // PII-free by contract. The full message goes to the log above.
    await logSecurityEvent(supabase, {
      eventType: 'audit.write_failed',
      severity: 'critical',
      churchId: input.churchId,
      actorClerkId: input.actorClerkId ?? null,
      route: input.route ?? null,
      detail: { entity_type: input.entityType, action: input.action, reason: 'audit_log_insert_failed' },
    });
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/**
 * recordAudit for callers that must not proceed unaudited.
 *
 * Only correct where the caller can still fail safely — i.e. the audited
 * change has NOT already committed, or is idempotent on retry. Throwing
 * after an committed non-idempotent mutation trades a missing audit row
 * for a duplicated side effect, which is worse.
 */
export async function recordAuditOrThrow(supabase: SupabaseClient, input: RecordAuditInput): Promise<void> {
  const result = await recordAudit(supabase, input);
  if (!result.ok) {
    throw new Error(`audit write failed for ${input.action} on ${input.entityType}: ${result.error}`);
  }
}
