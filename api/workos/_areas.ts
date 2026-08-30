/**
 * GET  /api/workos/areas   — the church's operational map, resolved.
 * PUT  /api/workos/areas   — reassign one area's human / agent / room.
 *
 * The map itself (which areas exist, which GRACE surfaces belong to each)
 * is code — api/_lib/ministryAreas.ts. This route resolves it against the
 * caller's church: it layers the `ministry_assignments` overrides on top of
 * the coded defaults, joins the accountable human out of `users` +
 * `staff_profiles`, and counts the open Work Orders each area actually owns
 * (by matching `work_orders.ministry`).
 *
 * Honesty rules, same as the rest of the WorkOS:
 *   - an area with no owner returns `owner: null` and the role that *should*
 *     hold it. It is never backfilled with a plausible name.
 *   - `source` says whether each link is a coded default or a real decision
 *     someone made, so the UI can show the difference.
 *   - counts are live queries, never stored alongside the assignment.
 *
 * GET  auth: any active staff actor (the map is not sensitive; the surfaces
 *      it links to keep their own permission gates).
 * PUT  auth: requirePermission('admin.manage_settings') — reassigning who is
 *      accountable is a settings-grade decision. Every write is audited.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission, resolveStaffActor } from '../_lib/authz.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str } from '../_lib/validation.js';
import { AGENT_REGISTRY } from '../_lib/agentRegistry.js';
import {
  AREA_KEYS, getArea, resolveAreas, attachNextEvents, staffDisplayName,
  type AssignmentRow, type StaffRow, type WorkOrderRow, type CalendarEventRow,
} from '../_lib/ministryAreas.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Campus room ids an area may be placed in — kept in sync with campusMap.ts ROOMS. */
const CAMPUS_ROOMS = [
  'canopy', 'lobby', 'mur1', 'sanctuary', 'nursery1', 'music', 'platform_back',
  'storage', 'conference', 'hallway', 'nursery2', 'nursery3', 'mur_a', 'mur_b',
  'fellowship', 'admin_front', 'admin_work', 'senior_pastor', 'associate_pastor',
];

/**
 * staff_profiles.user_id is UNIQUE, so PostgREST returns the embed as a
 * to-one OBJECT — but typings and older rows can present an array. Handle
 * both: the array-only guard silently dropped every title in production.
 */
function profileTitle(sp: unknown): string | null {
  const p = Array.isArray(sp) ? sp[0] : sp;
  return (p as { title?: string | null } | null | undefined)?.title ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  if (req.method === 'GET') return getAreas(req, res, supabase);
  if (req.method === 'PUT') return putArea(req, res, supabase);
  return res.status(405).json({ error: 'method_not_allowed' });
}

async function getAreas(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>,
) {
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return; // 401/403 already sent

  const nowIso = new Date().toISOString();

  const [{ data: assignments }, { data: staff }, { data: workOrders }, { data: events }] = await Promise.all([
    supabase
      .from('ministry_assignments')
      .select('area_key, owner_user_id, agent_key, campus_room, display_name, updated_at')
      .eq('church_id', actor.churchId),
    supabase
      .from('users')
      .select('id, first_name, last_name, person_id, staff_profiles(title, ministry)')
      .eq('church_id', actor.churchId)
      .eq('account_status', 'active')
      .order('first_name'),
    supabase
      .from('work_orders')
      .select('ministry, owner_user_id, status')
      .eq('church_id', actor.churchId)
      .not('status', 'in', '(completed,cancelled)'),
    supabase
      .from('calendar_events')
      .select('title, start_date, category')
      .eq('church_id', actor.churchId)
      .gte('start_date', nowIso),
  ]);

  const staffRows: StaffRow[] = ((staff ?? []) as unknown as {
    id: string; first_name: string | null; last_name: string | null; person_id: string | null;
    staff_profiles?: { title: string | null }[] | null;
  }[]).map(u => ({
    id: u.id,
    first_name: u.first_name,
    last_name: u.last_name,
    title: profileTitle(u.staff_profiles),
    person_id: u.person_id,
  }));

  const areas = attachNextEvents(
    resolveAreas(
      (assignments ?? []) as unknown as AssignmentRow[],
      staffRows,
      (workOrders ?? []) as unknown as WorkOrderRow[],
    ),
    (events ?? []) as unknown as CalendarEventRow[],
    new Date(nowIso),
  );

  return res.status(200).json({
    areas,
    // The pickers need these; sending them here keeps Settings to one round trip.
    staff: staffRows.map(u => ({ user_id: u.id, name: staffDisplayName(u), title: u.title ?? null })),
    agents: AGENT_REGISTRY.map(a => ({ key: a.key, name: a.name, role: a.role, implemented: a.implemented })),
    rooms: CAMPUS_ROOMS,
    can_manage: actor.permissions.has('admin.manage_settings'),
  });
}

const PUT_SCHEMA = {
  area_key: str({ required: true, max: 40, pattern: /^[a-z_]+$/ }),
};

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * Read one nullable link off the raw body.
 *
 * `null` and `undefined` are NOT the same here and must not be collapsed:
 * an explicit `null` clears the override (that is how a pastor un-assigns
 * someone), while an absent key leaves the current value alone. The shared
 * `uuid_()`/`str()` validators map both to `undefined`, which is exactly the
 * bug recorded as TD-045 — so these three fields are validated by hand.
 *
 * Returns: { present: false } | { present: true, value: string | null }
 */
function readLink(
  body: Record<string, unknown>,
  field: string,
  pattern: RegExp,
): { present: false } | { present: true; value: string | null } | { present: true; invalid: true } {
  if (!Object.prototype.hasOwnProperty.call(body, field)) return { present: false };
  const raw = body[field];
  if (raw === null) return { present: true, value: null };
  if (typeof raw !== 'string' || !pattern.test(raw)) return { present: true, invalid: true };
  return { present: true, value: raw };
}

async function putArea(
  req: VercelRequest,
  res: VercelResponse,
  supabase: ReturnType<typeof createClient>,
) {
  const actor = await requirePermission(req, res, supabase, 'admin.manage_settings');
  if (!actor) return; // 401/403 already sent

  const body = readBody(req, res, PUT_SCHEMA);
  if (!body) return;
  const raw = (req.body ?? {}) as Record<string, unknown>;

  const area = getArea(body.area_key);
  if (!area) {
    return res.status(400).json({ error: 'unknown_area', area_key: body.area_key, known: AREA_KEYS });
  }

  // `null` is meaningful for all three fields and distinct from "not sent":
  // null clears the override (agent/room fall back to the coded default;
  // owner becomes an explicit "nobody assigned yet").
  const patch: Record<string, unknown> = {
    church_id: actor.churchId,
    area_key: area.key,
    updated_by_user_id: actor.userId,
    updated_at: new Date().toISOString(),
  };

  const ownerLink = readLink(raw, 'owner_user_id', UUID_RE);
  if ('invalid' in ownerLink) return res.status(400).json({ error: 'invalid_request', detail: 'owner_user_id must be a UUID or null' });
  if (ownerLink.present) {
    const ownerId = ownerLink.value;
    if (ownerId) {
      const { data: target } = await supabase
        .from('users')
        .select('id')
        .eq('id', ownerId)
        .eq('church_id', actor.churchId)
        .eq('account_status', 'active')
        .maybeSingle();
      if (!target) return res.status(400).json({ error: 'owner_not_in_church' });
    }
    patch.owner_user_id = ownerId;
  }

  const agentLink = readLink(raw, 'agent_key', /^[a-z-]{1,40}$/);
  if ('invalid' in agentLink) return res.status(400).json({ error: 'invalid_request', detail: 'agent_key must be an agent key or null' });
  if (agentLink.present) {
    const agentKey = agentLink.value;
    if (agentKey && !AGENT_REGISTRY.some(a => a.key === agentKey)) {
      return res.status(400).json({ error: 'unknown_agent', agent_key: agentKey });
    }
    patch.agent_key = agentKey;
  }

  const roomLink = readLink(raw, 'campus_room', /^[a-z_0-9]{1,40}$/);
  if ('invalid' in roomLink) return res.status(400).json({ error: 'invalid_request', detail: 'campus_room must be a room id or null' });
  if (roomLink.present) {
    const room = roomLink.value;
    if (room && !CAMPUS_ROOMS.includes(room)) {
      return res.status(400).json({ error: 'unknown_room', campus_room: room });
    }
    patch.campus_room = room;
  }

  // Cosmetic only — no FK, no permission implications, just what this
  // church calls the area. Same null-clears-override / absent-leaves-alone
  // semantics as the other three links.
  const nameLink = readLink(raw, 'display_name', /^.{1,60}$/);
  if ('invalid' in nameLink) return res.status(400).json({ error: 'invalid_request', detail: 'display_name must be 1-60 characters or null' });
  if (nameLink.present) {
    patch.display_name = nameLink.value;
  }

  const { data: before } = await supabase
    .from('ministry_assignments')
    .select('area_key, owner_user_id, agent_key, campus_room, display_name')
    .eq('church_id', actor.churchId)
    .eq('area_key', area.key)
    .maybeSingle();

  const { data: saved, error } = await supabase
    .from('ministry_assignments')
    .upsert(patch, { onConflict: 'church_id,area_key' })
    .select('area_key, owner_user_id, agent_key, campus_room, display_name, updated_at')
    .single();

  if (error) {
    console.error('[workos/areas] upsert failed', error);
    return res.status(500).json({ error: 'save_failed' });
  }

  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    action: 'ministry_area_reassigned',
    entityType: 'ministry_assignment',
    entityId: area.key,
    before: before ?? null,
    after: saved,
    route: '/api/workos/areas',
    method: 'PUT',
    req,
  });

  return res.status(200).json({ assignment: saved });
}
