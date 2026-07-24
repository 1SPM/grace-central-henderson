/**
 * Security-event logger — writes to the append-only `security_events` table
 * (migration 062). Captures the highest-value monitoring signals from the
 * logging/monitoring audit: auth failures, permission denials, suspended-
 * account activity, and no-church-record (token-manipulation / cross-tenant).
 *
 * Two rules:
 *   1. Best-effort — logging must NEVER throw or block the request it observes.
 *   2. PII-free `detail` — never put a name, email, token, or content here.
 *      (An actor's Clerk id is a pseudonymous identifier and IS recorded, in a
 *      dedicated column, because forensics needs to know *who*.)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { clientIp } from './rateLimit/limiter.js';

export type SecuritySeverity = 'info' | 'elevated' | 'critical';

export interface SecurityEventInput {
  eventType: string;                     // e.g. 'auth.failed', 'authz.denied'
  severity: SecuritySeverity;
  churchId?: string | null;
  actorClerkId?: string | null;
  ip?: string | null;
  route?: string | null;
  detail?: Record<string, unknown>;      // MUST be PII-free
}

export async function logSecurityEvent(supabase: SupabaseClient, input: SecurityEventInput): Promise<void> {
  try {
    const { error } = await supabase.from('security_events').insert({
      church_id: input.churchId ?? null,
      actor_clerk_id: input.actorClerkId ?? null,
      event_type: input.eventType,
      severity: input.severity,
      ip: input.ip ?? null,
      route: input.route ?? null,
      detail: input.detail ?? {},
    });
    if (error) console.warn('[securityLog] insert failed:', error.message);
  } catch (err) {
    // Never let security logging break the request it is observing.
    console.warn('[securityLog] threw:', err instanceof Error ? err.message : String(err));
  }
}

/** PII-free request context (client IP + path) for a security event. */
export function securityContext(req: VercelRequest): { ip: string; route: string | null } {
  return {
    ip: clientIp(req),
    route: typeof req.url === 'string' ? req.url.split('?')[0] : null,
  };
}
