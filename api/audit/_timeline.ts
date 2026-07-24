/**
 * GET /api/audit/timeline
 *
 * Authorized searchable view over both audit_logs (security/compliance
 * trail) and platform_events (domain events) for the caller's church,
 * merged into one chronological feed. Supports:
 *   ?entity_type=work_order|approval|task|person|...
 *   ?action=create|update|decide|agent_run|...   (audit_logs only)
 *   ?event_type=work_order.created|...           (platform_events only)
 *   ?q=<text>                                     (matches entity_type/action/event_type)
 *   ?limit=<n>                                    (default 100, max 500)
 *
 * Auth: Clerk Bearer (or demo bootstrap), audit.view. Role-based
 * visibility is the same permission gate as everywhere else in this
 * module — a caller without audit.view gets 403, not a filtered/empty
 * 200 (fail loud, not fail silent, for an audit surface).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

interface TimelineEntry {
  id: string;
  kind: 'audit' | 'event';
  timestamp: string;
  actor_user_id: string | null;
  actor_person_id: string | null;
  label: string;
  entity_type: string | null;
  entity_id: string | null;
  source_app: string | null;
  correlation_id: string | null;
  detail: Record<string, unknown>;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'audit.view');
  if (!actor) return;

  const rawLimit = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : 100;
  const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 500) : 100;
  const entityType = typeof req.query.entity_type === 'string' ? req.query.entity_type : undefined;
  const action = typeof req.query.action === 'string' ? req.query.action : undefined;
  const eventType = typeof req.query.event_type === 'string' ? req.query.event_type : undefined;
  const q = typeof req.query.q === 'string' ? req.query.q.toLowerCase() : undefined;

  let auditQuery = supabase
    .from('audit_logs')
    .select('id, actor_user_id, actor_clerk_id, action, entity_type, entity_id, source_app, correlation_id, created_at, before, after')
    .eq('church_id', actor.churchId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (entityType) auditQuery = auditQuery.eq('entity_type', entityType);
  if (action) auditQuery = auditQuery.eq('action', action);

  let eventQuery = supabase
    .from('platform_events')
    .select('id, actor_user_id, actor_person_id, event_type, subject_type, subject_id, source_app, correlation_id, created_at, payload')
    .eq('church_id', actor.churchId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (entityType) eventQuery = eventQuery.eq('subject_type', entityType);
  if (eventType) eventQuery = eventQuery.eq('event_type', eventType);

  const [{ data: auditRows, error: auditErr }, { data: eventRows, error: eventErr }] = await Promise.all([auditQuery, eventQuery]);
  if (auditErr || eventErr) return res.status(500).json({ error: 'read_failed' });

  let entries: TimelineEntry[] = [
    ...(auditRows ?? []).map((r): TimelineEntry => ({
      id: r.id,
      kind: 'audit',
      timestamp: r.created_at,
      actor_user_id: r.actor_user_id,
      actor_person_id: null,
      label: `${r.action} ${r.entity_type}`,
      entity_type: r.entity_type,
      entity_id: r.entity_id,
      source_app: r.source_app,
      correlation_id: r.correlation_id,
      detail: { before: r.before, after: r.after },
    })),
    ...(eventRows ?? []).map((r): TimelineEntry => ({
      id: r.id,
      kind: 'event',
      timestamp: r.created_at,
      actor_user_id: r.actor_user_id,
      actor_person_id: r.actor_person_id,
      label: r.event_type,
      entity_type: r.subject_type,
      entity_id: r.subject_id,
      source_app: r.source_app,
      correlation_id: r.correlation_id,
      detail: { payload: r.payload },
    })),
  ];

  if (q) {
    entries = entries.filter(e =>
      e.label.toLowerCase().includes(q) ||
      (e.entity_type ?? '').toLowerCase().includes(q) ||
      (e.entity_id ?? '').toLowerCase().includes(q),
    );
  }

  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  entries = entries.slice(0, limit);

  return res.status(200).json({ entries });
}
