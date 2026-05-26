/**
 * Audit middleware — append-only "who did what, when" log.
 *
 * Two modes:
 *
 * 1) Global middleware: every successful non-GET / non-HEAD / non-OPTIONS
 *    response writes a basic audit row inferring entity from the URL.
 *    Wire once in api/_server.ts after the body parsers and before routes.
 *
 * 2) Explicit helper: routes that want a precise (entity_type, entity_id,
 *    before, after) tuple call `audit(req, supabase, { ... })` themselves.
 *    Use this in any handler where the URL is ambiguous (e.g. /api/auth/users/:id)
 *    or where the diff matters (Stripe webhooks writing to the ledger).
 *
 * Writes go to the `audit_logs` table (migration 010). The table is
 * append-only by trigger; the service role bypasses RLS for SELECTs as well
 * so admin tooling can read across churches.
 *
 * Failure mode: writes are fire-and-forget. An audit failure is logged
 * locally + reported to Sentry but NEVER fails the originating request.
 * This is deliberate — the alternative (user-visible 500s when audit is
 * down) is worse than a gap in the audit trail that Sentry will surface.
 */

import type { Response, NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from './auth';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface AuditDetails {
  action: string;                                       // 'create' | 'update' | 'delete' | custom
  entity_type: string;                                  // 'person' | 'task' | 'stripe_webhook' | ...
  entity_id?: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  church_id?: string;
}

interface AuditRow {
  church_id: string | null;
  actor_user_id: string | null;
  actor_clerk_id: string | null;
  actor_role: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  route: string | null;
  method: string | null;
  ip_address: string | null;
  user_agent: string | null;
  request_id: string | null;
}

// ---------- helpers (pure; testable) ------------------------------------

const ENTITY_FROM_PATH = /^\/api\/([a-z][a-z0-9_-]*)/i;

export function inferEntityType(path: string): string {
  const m = ENTITY_FROM_PATH.exec(path);
  return m ? m[1].toLowerCase() : 'unknown';
}

export function actionFromMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'POST':
      return 'create';
    case 'PUT':
    case 'PATCH':
      return 'update';
    case 'DELETE':
      return 'delete';
    default:
      return method.toLowerCase();
  }
}

export function clientIp(req: AuthenticatedRequest): string | null {
  // We trust process.env.TRUST_PROXY to be set when running behind a proxy.
  // Without it, never trust X-Forwarded-For — could be spoofed.
  if (process.env.TRUST_PROXY === 'true') {
    const fwd = req.headers['x-forwarded-for'];
    if (typeof fwd === 'string' && fwd.length > 0) {
      return fwd.split(',')[0].trim();
    }
  }
  return req.socket?.remoteAddress ?? null;
}

export function requestId(req: AuthenticatedRequest): string | null {
  const h = req.headers['x-request-id'];
  return typeof h === 'string' && h.length > 0 ? h.slice(0, 128) : null;
}

export function userAgent(req: AuthenticatedRequest): string | null {
  const ua = req.headers['user-agent'];
  return typeof ua === 'string' && ua.length > 0 ? ua.slice(0, 512) : null;
}

export function churchIdFromAuth(req: AuthenticatedRequest): string | null {
  // The current auth middleware (api/_middleware/auth.ts) stores only
  // userId / sessionId / role on req.auth. Until the Clerk JWT template
  // includes church_id (Sprint 1 — Clerk→Supabase integration), this is
  // null at audit time. Explicit audit() calls can pass church_id directly.
  const auth = req.auth as (AuthenticatedRequest['auth'] & { churchId?: string }) | undefined;
  return auth?.churchId ?? null;
}

export function buildAuditRow(
  req: AuthenticatedRequest,
  res: Response,
  details: AuditDetails,
): AuditRow {
  return {
    church_id: details.church_id ?? churchIdFromAuth(req),
    actor_user_id: null,
    actor_clerk_id: req.auth?.userId ?? null,
    actor_role: req.auth?.role ?? null,
    action: details.action,
    entity_type: details.entity_type,
    entity_id: details.entity_id ?? null,
    before: details.before ?? null,
    after: details.after ?? null,
    route: req.originalUrl ?? req.url ?? null,
    method: req.method ?? null,
    ip_address: clientIp(req),
    user_agent: userAgent(req),
    request_id: requestId(req),
  };
}

// ---------- runtime -----------------------------------------------------

async function writeAuditRow(
  supabase: SupabaseClient,
  row: AuditRow,
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert(row);
  if (error) {
    // Bubble up so the caller can log + (optionally) capture to Sentry.
    throw new Error(`audit_logs insert failed: ${error.message}`);
  }
}

function reportAuditFailure(err: unknown, row: AuditRow): void {
  console.error('[audit] write failed', {
    action: row.action,
    entity_type: row.entity_type,
    route: row.route,
    error: err instanceof Error ? err.message : String(err),
  });
  // Best-effort Sentry report. Server-side Sentry module is imported via
  // api/instrument.ts; we keep this dependency dynamic so audit.ts has
  // no synchronous coupling to it.
  void import('../instrument').then(({ Sentry, sentryEnabled }) => {
    if (sentryEnabled) {
      Sentry.withScope((scope) => {
        scope.setContext('audit_row', { ...row, before: undefined, after: undefined });
        Sentry.captureException(err);
      });
    }
  }).catch(() => { /* Sentry off; already logged locally */ });
}

/**
 * Global audit middleware. Wire once in api/_server.ts:
 *
 *   app.use(auditMutations(supabase));
 *
 * Logs every 2xx response to a non-safe method. Skips GET/HEAD/OPTIONS and
 * skips non-success statuses.
 */
export function auditMutations(supabase: SupabaseClient) {
  return function audit(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      return next();
    }

    res.on('finish', () => {
      if (res.statusCode < 200 || res.statusCode >= 300) return;
      const row = buildAuditRow(req, res, {
        action: actionFromMethod(req.method),
        entity_type: inferEntityType(req.originalUrl ?? req.url ?? ''),
      });
      writeAuditRow(supabase, row).catch((err) => reportAuditFailure(err, row));
    });

    next();
  };
}

/**
 * Explicit audit helper. Use inside a route handler when you have
 * better information than the URL alone (entity_id, before/after diffs,
 * webhook events).
 */
export async function audit(
  req: AuthenticatedRequest,
  res: Response,
  supabase: SupabaseClient,
  details: AuditDetails,
): Promise<void> {
  const row = buildAuditRow(req, res, details);
  try {
    await writeAuditRow(supabase, row);
  } catch (err) {
    reportAuditFailure(err, row);
  }
}
