/**
 * Ministry areas — the operational map of GRACE.
 *
 * This is the north star: an *area* is a job the church office actually
 * does in GRACE, not a room and not an agent. Everything else hangs off it:
 *
 *     area  →  accountable human   (users row, resolved per church)
 *           →  supporting agent    (key in api/_lib/agentRegistry.ts)
 *           →  campus location     (room id in campusMap.ts)
 *           →  GRACE surfaces      (routes that already exist)
 *           →  work               (work_orders.ministry, Decision Queue kinds)
 *
 * Both entry points read this one file, so the Campus and the WorkOS can
 * never disagree about who owns what. The campus is a *view* of this map,
 * not a parallel model of it.
 *
 * The three assignable links (human, agent, room) are defaults only —
 * a pastor overrides them per church in Settings → Ministry Areas, stored
 * in the `ministry_assignments` table. Nothing here is per-tenant.
 *
 * Deliberately flat: 14 areas, one accountable human each. This is not an
 * org chart and it is not an agent hierarchy.
 *
 * Zero imports on purpose — this module is loaded by both the Vercel API
 * handlers and the browser bundle. It lives under src/, not api/_lib/,
 * because `vercel dev` reserves the whole /api/ path for serverless
 * functions and cannot serve a plain source file from there to the browser
 * — api/_lib/ministryAreas.ts is a thin re-export shim for its api-side
 * consumers; this file is the one that actually changes.
 */

/** RBAC role (migration 032) that should hold an area, when unassigned. */
export type RoleKey =
  | 'system_administrator' | 'executive_leadership' | 'senior_pastor' | 'ministry_leader'
  | 'pastoral_care' | 'member_services' | 'communications' | 'volunteer_coordinator'
  | 'finance' | 'impact_card_operations' | 'analyst' | 'auditor';

export interface AreaSurface {
  label: string;
  /** The `View` the hash belongs to — drives setView() in the SPA. */
  view: string;
  /** Full hash, e.g. '#/pastoral-care?tab=requests'. */
  hash: string;
  /** Server-side permission key that gates this surface, if any. */
  permission?: string;
  /** The one surface that best represents this area (used for "Open" buttons). */
  primary?: boolean;
}

export interface MinistryArea {
  /** Stable slug. Persisted in ministry_assignments.area_key — never rename. */
  key: string;
  name: string;
  /** What this area is responsible for, in the church's own words. */
  purpose: string;
  /**
   * The exact string this area's Work Orders carry in `work_orders.ministry`.
   * This is the join key between the operational map and real work.
   */
  ministry: string;
  /** Role that should hold this area when no specific person is assigned. */
  defaultRoleKey: RoleKey;
  /** Default supporting agent — a key in AGENT_REGISTRY, or null if none fits. */
  defaultAgentKey: string | null;
  /** Default campus room id (campusMap.ts). */
  defaultRoom: string;
  surfaces: AreaSurface[];
  /** Decision Queue kinds that land on this area's desk. */
  queueKinds: string[];
  /** Confidential-tier: counts and presence only, never subject detail. */
  confidential?: boolean;
  /**
   * A distinguishing hex accent for this area — room-label underline and
   * panel borders, never a status pip. Status color is semantic (ran /
   * never run / failed) and must stay legible on its own; area color is a
   * second, independent channel so a room is recognizable before you read
   * its label, the way a physical office uses department signage color.
   */
  accentColor: string;
}

export const MINISTRY_AREAS: MinistryArea[] = [
  {
    key: 'oversight',
    accentColor: '#3B53BB',
    name: 'Church Oversight',
    purpose: 'The desk where decisions land: approvals awaiting a decision, related-party reviews, and the week ahead.',
    ministry: 'Oversight',
    defaultRoleKey: 'senior_pastor',
    defaultAgentKey: 'grace',
    defaultRoom: 'senior_pastor',
    surfaces: [
      { label: 'Decision Queue', view: 'workos', hash: '#/workos', primary: true },
      { label: 'Approvals', view: 'workos', hash: '#/workos?tab=approvals', permission: 'approvals.view' },
      { label: 'Church calendar', view: 'sunday-prep', hash: '#/sunday-prep?tab=calendar' },
    ],
    queueKinds: ['approval', 'related_party_review'],
  },
  {
    key: 'operations',
    accentColor: '#64748B',
    name: 'Operations & Work Orders',
    purpose: 'How work gets planned, assigned, and finished: Work Orders, the Task Board, and completion evidence.',
    ministry: 'Operations',
    defaultRoleKey: 'system_administrator',
    defaultAgentKey: 'compass',
    defaultRoom: 'conference',
    surfaces: [
      { label: 'Work Orders', view: 'workos', hash: '#/workos?tab=work-orders', permission: 'work_orders.view', primary: true },
      { label: 'Task Board', view: 'workos', hash: '#/workos?tab=tasks', permission: 'work_orders.view' },
      { label: 'Action Center', view: 'feed', hash: '#/actions' },
    ],
    queueKinds: [],
  },
  {
    key: 'member_care',
    accentColor: '#7C3AED',
    name: 'Pastoral Care',
    purpose: 'Care requests, crisis response, and prayer. Every crisis path ends with a person, never an agent.',
    ministry: 'Care & Counseling',
    defaultRoleKey: 'pastoral_care',
    defaultAgentKey: 'shepherd',
    defaultRoom: 'associate_pastor',
    surfaces: [
      { label: 'Care requests', view: 'pastoral-care', hash: '#/pastoral-care?tab=requests', permission: 'care.view', primary: true },
      { label: 'Crisis dispatch', view: 'pastoral-care', hash: '#/pastoral-care', permission: 'care.view' },
      { label: 'Life services', view: 'pastoral-care', hash: '#/pastoral-care?tab=life-services' },
      { label: 'Prayer', view: 'prayer', hash: '#/prayer' },
    ],
    queueKinds: ['crisis', 'care_triage'],
    confidential: true,
  },
  {
    key: 'membership',
    accentColor: '#2563EB',
    name: 'Membership & Records',
    purpose: 'The congregation record itself: people, households, tags, forms, and data quality.',
    ministry: 'Member Services',
    defaultRoleKey: 'member_services',
    defaultAgentKey: 'verity',
    defaultRoom: 'admin_front',
    surfaces: [
      { label: 'Congregation', view: 'people', hash: '#/people', permission: 'people.view', primary: true },
      { label: 'Families & households', view: 'people', hash: '#/people?tab=families', permission: 'households.view' },
      { label: 'Forms', view: 'settings', hash: '#/settings?tab=forms', permission: 'admin.manage_settings' },
      { label: 'Tags', view: 'settings', hash: '#/settings?tab=tags', permission: 'admin.manage_settings' },
    ],
    queueKinds: [],
  },
  {
    key: 'newcomers',
    accentColor: '#0EA5E9',
    name: 'Newcomers & Welcome',
    purpose: 'First visits through to membership: the connect card, check-in, follow-up, and stalled invitations.',
    ministry: 'Welcome',
    defaultRoleKey: 'member_services',
    defaultAgentKey: 'welcome',
    defaultRoom: 'lobby',
    surfaces: [
      { label: 'Follow-ups', view: 'feed', hash: '#/actions', primary: true },
      { label: 'Connect Card', view: 'connect-card', hash: '#/connect-card' },
      { label: 'QR check-in', view: 'qr-checkin', hash: '#/qr-checkin' },
      { label: 'Birthdays this week', view: 'feed', hash: '#/actions?tab=birthdays' },
    ],
    queueKinds: ['invitation_stalled'],
  },
  {
    key: 'communications',
    accentColor: '#0891B2',
    name: 'Communications',
    purpose: 'Everything the church sends: mail, announcements, and templates. Drafts stay drafts until a person sends them.',
    ministry: 'Communications',
    defaultRoleKey: 'communications',
    defaultAgentKey: 'herald',
    defaultRoom: 'mur1',
    surfaces: [
      { label: 'Mail', view: 'feed', hash: '#/actions?tab=mail', permission: 'communications.view', primary: true },
      { label: 'Announcements', view: 'sunday-prep', hash: '#/sunday-prep?tab=announcements' },
      { label: 'Email templates', view: 'settings', hash: '#/settings?tab=email-templates', permission: 'admin.manage_settings' },
    ],
    queueKinds: [],
  },
  {
    key: 'worship',
    accentColor: '#A16207',
    name: 'Sunday & Worship',
    purpose: 'The service itself: order of service, attendance, the live console, and the calendar.',
    ministry: 'Worship',
    defaultRoleKey: 'ministry_leader',
    defaultAgentKey: 'gather',
    defaultRoom: 'sanctuary',
    surfaces: [
      { label: 'Sunday Service Tools', view: 'sunday-prep', hash: '#/sunday-prep', primary: true },
      { label: 'Attendance', view: 'sunday-prep', hash: '#/sunday-prep?tab=attendance', permission: 'events.view' },
      { label: 'Live service', view: 'feed', hash: '#/actions?tab=live' },
      { label: 'Sermon archive', view: 'sunday-prep', hash: '#/sunday-prep?tab=archive' },
    ],
    queueKinds: [],
  },
  {
    key: 'music',
    accentColor: '#C2410C',
    name: 'Music & Arts',
    purpose: 'Worship teams and the skills register that says who can serve where.',
    ministry: 'Music & Arts',
    defaultRoleKey: 'ministry_leader',
    defaultAgentKey: null,
    defaultRoom: 'music',
    surfaces: [
      { label: 'Skills & talents', view: 'people', hash: '#/people?tab=skills', primary: true },
      { label: 'Service planning', view: 'sunday-prep', hash: '#/sunday-prep' },
    ],
    queueKinds: [],
  },
  {
    key: 'volunteers',
    accentColor: '#0D9488',
    name: 'Volunteers & Serving',
    purpose: 'Turning willingness into a placement: serving roles, interest submissions, and small groups.',
    ministry: 'Volunteers',
    defaultRoleKey: 'volunteer_coordinator',
    defaultAgentKey: 'serve',
    defaultRoom: 'mur_a',
    surfaces: [
      { label: 'Volunteers', view: 'feed', hash: '#/actions?tab=volunteers', permission: 'volunteer.view', primary: true },
      { label: 'Small groups', view: 'people', hash: '#/people?tab=groups', permission: 'groups.view' },
      { label: 'Skills & talents', view: 'people', hash: '#/people?tab=skills' },
    ],
    queueKinds: [],
  },
  {
    key: 'children',
    accentColor: '#DB2777',
    name: 'Children & Youth',
    purpose: 'Nursery and youth: check-in, and the family records behind it.',
    ministry: 'Children & Youth',
    defaultRoleKey: 'ministry_leader',
    defaultAgentKey: null,
    defaultRoom: 'nursery1',
    surfaces: [
      { label: 'Check-in', view: 'sunday-prep', hash: '#/sunday-prep?tab=attendance', permission: 'events.view', primary: true },
      { label: 'Families', view: 'people', hash: '#/people?tab=families', permission: 'households.view' },
    ],
    queueKinds: [],
  },
  {
    key: 'giving',
    accentColor: '#166534',
    name: 'Giving & Stewardship',
    purpose: 'Campaigns, the giving ledger, statements, and reconciliation.',
    ministry: 'Finance',
    defaultRoleKey: 'finance',
    defaultAgentKey: 'steward',
    defaultRoom: 'admin_work',
    surfaces: [
      { label: 'Impact Campaigns', view: 'giving', hash: '#/giving', permission: 'giving_financial.view', primary: true },
      { label: 'Giving statements', view: 'statements', hash: '#/statements', permission: 'giving_financial.view' },
      { label: 'Charity baskets', view: 'charity-baskets', hash: '#/charity-baskets' },
    ],
    queueKinds: [],
  },
  {
    key: 'impact_card',
    accentColor: '#059669',
    name: 'Impact Card Operations',
    purpose: 'Member card accounts: applications, KYC review, and transfers that need a human.',
    ministry: 'Impact Card Operations',
    defaultRoleKey: 'impact_card_operations',
    defaultAgentKey: 'impact',
    defaultRoom: 'admin_work',
    surfaces: [
      { label: 'Impact Card Accounts', view: 'wallets', hash: '#/wallets', permission: 'impact_card.view', primary: true },
    ],
    queueKinds: ['kyc_review', 'failed_transfer'],
  },
  {
    key: 'discipleship',
    accentColor: '#4F46E5',
    name: 'Growth & Engagement',
    purpose: 'Milestones, the discipleship pathway, and how members are actually engaging.',
    ministry: 'Discipleship',
    defaultRoleKey: 'ministry_leader',
    defaultAgentKey: 'marci',
    defaultRoom: 'mur_b',
    surfaces: [
      { label: 'Growth & Engagement', view: 'discipleship-engagement', hash: '#/discipleship-engagement', primary: true },
      { label: 'Analytics', view: 'analytics', hash: '#/settings?tab=analytics', permission: 'analytics.view' },
      { label: 'Reports', view: 'reports', hash: '#/settings?tab=reports' },
    ],
    queueKinds: [],
  },
  {
    key: 'privacy',
    accentColor: '#78716C',
    name: 'Privacy & Compliance',
    purpose: 'Consent records, data-subject requests, agent findings, and the audit trail.',
    ministry: 'Compliance',
    defaultRoleKey: 'auditor',
    defaultAgentKey: 'sentinel',
    defaultRoom: 'hallway',
    surfaces: [
      { label: 'Agent findings', view: 'workos', hash: '#/workos?tab=agents', permission: 'agents.view', primary: true },
      { label: 'Audit trail', view: 'workos', hash: '#/workos?tab=audit', permission: 'audit.view' },
      { label: 'Automation settings', view: 'settings', hash: '#/settings?tab=automation', permission: 'admin.manage_settings' },
    ],
    queueKinds: ['agent_finding'],
  },
];

export const AREA_KEYS: string[] = MINISTRY_AREAS.map(a => a.key);

export function getArea(key: string): MinistryArea | undefined {
  return MINISTRY_AREAS.find(a => a.key === key);
}

/** The area whose Work Orders carry this `work_orders.ministry` value. */
export function areaForMinistry(ministry: string | null | undefined): MinistryArea | undefined {
  if (!ministry) return undefined;
  const needle = ministry.trim().toLowerCase();
  return MINISTRY_AREAS.find(a => a.ministry.toLowerCase() === needle);
}

/** The area a Decision Queue item belongs to, by kind. */
export function areaForQueueKind(kind: string): MinistryArea | undefined {
  return MINISTRY_AREAS.find(a => a.queueKinds.includes(kind));
}

/**
 * The areas seated in a campus room by default.
 *
 * A room may host more than one area — a small church office really does
 * run Giving and Impact Card operations from the same work room — so the
 * campus renders every area in the room rather than silently showing the
 * first. Each area still names exactly one room, which is what makes
 * "where does this function belong?" answerable.
 */
export function areasForRoom(roomId: string): MinistryArea[] {
  return MINISTRY_AREAS.filter(a => a.defaultRoom === roomId);
}

/** First area seated in a room, for callers that only need one. */
export function areaForRoom(roomId: string): MinistryArea | undefined {
  return areasForRoom(roomId)[0];
}

export function primarySurface(area: { surfaces: AreaSurface[] }): AreaSurface {
  return area.surfaces.find(s => s.primary) ?? area.surfaces[0];
}

/**
 * One area's live pairing for a church: the three links a pastor can
 * reassign, plus where they came from. `source: 'default'` means nobody has
 * overridden it yet — shown as such, never dressed up as a decision.
 */
export interface ResolvedArea {
  key: string;
  name: string;
  purpose: string;
  ministry: string;
  confidential: boolean;
  surfaces: AreaSurface[];
  queueKinds: string[];
  /** Accountable human. null = nobody assigned yet (an honest gap). */
  owner: { user_id: string; name: string; title: string | null; person_id: string | null } | null;
  /** Role that should hold it when `owner` is null. */
  default_role_key: RoleKey;
  agent_key: string | null;
  room_id: string;
  /** Room-label underline / panel-border color. Never applied to a status pip. */
  accent_color: string;
  source: { owner: 'default' | 'assigned'; agent: 'default' | 'assigned'; room: 'default' | 'assigned'; name: 'default' | 'assigned' };
  updated_at: string | null;
}

// ---------------------------------------------------------------------------
// Resolver
// ---------------------------------------------------------------------------

export interface AssignmentRow {
  area_key: string;
  owner_user_id: string | null;
  agent_key: string | null;
  campus_room: string | null;
  display_name?: string | null;
  updated_at?: string | null;
}

export interface StaffRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  title?: string | null;
  /** The people row carrying this staff member's public identity, when
   * they have one — see migration 067. Lets the Campus draw a leader's
   * own portrait instead of a generic owner initial. */
  person_id?: string | null;
}

export interface WorkOrderRow {
  ministry: string | null;
  owner_user_id: string | null;
}

export interface NextEventInfo {
  title: string;
  start_date: string;
  category: string;
}

export interface ResolvedAreaWithCounts extends ResolvedArea {
  open_work_orders: number;
  unowned_work_orders: number;
  /**
   * The soonest calendar_events row whose category maps to this area, within
   * the lookahead window. Always present (never an absent key) — null means
   * genuinely nothing upcoming, set by resolveAreas() and left as-is unless
   * attachNextEvents() finds a real match.
   */
  next_event: NextEventInfo | null;
}

export function staffDisplayName(u: StaffRow): string {
  const name = [u.first_name, u.last_name].filter(Boolean).join(' ').trim();
  return name || 'Unnamed staff member';
}

/**
 * Layer a church's overrides onto the coded map.
 *
 * Pure — no IO, no clock, no randomness — so the shape the Campus and the
 * WorkOS both render is unit-testable. Same posture as decisionQueue.ts.
 *
 * Rules that matter:
 *   - an override pointing at a person who is no longer active staff resolves
 *     to `owner: null`, not a dangling id, so the UI shows the honest gap.
 *   - `source` distinguishes a coded default from a decision someone made.
 *   - counts come from the passed-in Work Orders, matched on the ministry
 *     string, and are never persisted next to the assignment.
 */
export function resolveAreas(
  assignments: AssignmentRow[],
  staff: StaffRow[],
  openWorkOrders: WorkOrderRow[],
): ResolvedAreaWithCounts[] {
  const byKey = new Map(assignments.map(a => [a.area_key, a]));
  const staffById = new Map(staff.map(u => [u.id, u]));

  const counts = new Map<string, { open: number; unowned: number }>();
  for (const w of openWorkOrders) {
    const key = (w.ministry ?? '').trim().toLowerCase();
    if (!key) continue;
    const bucket = counts.get(key) ?? { open: 0, unowned: 0 };
    bucket.open += 1;
    if (!w.owner_user_id) bucket.unowned += 1;
    counts.set(key, bucket);
  }

  return MINISTRY_AREAS.map(area => {
    const row = byKey.get(area.key);
    const ownerRow = row?.owner_user_id ? staffById.get(row.owner_user_id) : undefined;
    const bucket = counts.get(area.ministry.toLowerCase()) ?? { open: 0, unowned: 0 };

    return {
      key: area.key,
      name: row?.display_name ?? area.name,
      purpose: area.purpose,
      ministry: area.ministry,
      confidential: area.confidential === true,
      surfaces: area.surfaces,
      queueKinds: area.queueKinds,
      owner: ownerRow
        ? {
            user_id: ownerRow.id,
            name: staffDisplayName(ownerRow),
            title: ownerRow.title ?? null,
            person_id: ownerRow.person_id ?? null,
          }
        : null,
      default_role_key: area.defaultRoleKey,
      agent_key: row && row.agent_key !== null ? row.agent_key : area.defaultAgentKey,
      room_id: row?.campus_room ?? area.defaultRoom,
      accent_color: area.accentColor,
      source: {
        // "assigned" means a person made this choice AND it still resolves.
        owner: ownerRow ? 'assigned' : 'default',
        agent: row?.agent_key != null ? 'assigned' : 'default',
        room: row?.campus_room != null ? 'assigned' : 'default',
        name: row?.display_name != null ? 'assigned' : 'default',
      },
      updated_at: row?.updated_at ?? null,
      open_work_orders: bucket.open,
      unowned_work_orders: bucket.unowned,
      next_event: null,
    };
  });
}

// ---------------------------------------------------------------------------
// Calendar — "what's coming up here"
// ---------------------------------------------------------------------------

/**
 * calendar_events.category -> ministry area, for the campus's "what's coming
 * up here" badge. Deliberately partial: 'holiday', 'event', and 'other' are
 * not placed on any specific ministry's desk, so an event in one of those
 * categories shows nowhere rather than being guessed onto the wrong room.
 */
export const EVENT_CATEGORY_AREA: Record<string, string> = {
  service: 'worship',
  baptism: 'worship',
  meeting: 'operations',
  wedding: 'member_care',
  funeral: 'member_care',
  dedication: 'member_care',
  counseling: 'member_care',
  rehearsal: 'music',
  outreach: 'volunteers',
  'small-group': 'discipleship',
  class: 'discipleship',
};

const NEXT_EVENT_LOOKAHEAD_DAYS = 14;

export interface CalendarEventRow {
  title: string;
  start_date: string;
  category: string;
}

/**
 * Layer the soonest matching upcoming event onto each area.
 *
 * Pure — `now` is an explicit argument rather than read off the clock, same
 * reason the rest of this module avoids IO: it keeps this unit-testable
 * without faking the system clock. Filters defensively on `now`/the
 * lookahead window itself, so the caller only needs to scope events to the
 * right church, not pre-sort or pre-filter them.
 */
export function attachNextEvents<T extends ResolvedAreaWithCounts>(
  areas: T[],
  events: CalendarEventRow[],
  now: Date,
): T[] {
  const nowMs = now.getTime();
  const cutoffMs = nowMs + NEXT_EVENT_LOOKAHEAD_DAYS * 24 * 60 * 60 * 1000;
  const byArea = new Map<string, CalendarEventRow>();

  for (const ev of events) {
    const areaKey = EVENT_CATEGORY_AREA[ev.category];
    if (!areaKey) continue;
    const t = new Date(ev.start_date).getTime();
    if (Number.isNaN(t) || t < nowMs || t > cutoffMs) continue;
    const existing = byArea.get(areaKey);
    if (!existing || t < new Date(existing.start_date).getTime()) byArea.set(areaKey, ev);
  }

  return areas.map(a => {
    const ev = byArea.get(a.key);
    return ev ? { ...a, next_event: { title: ev.title, start_date: ev.start_date, category: ev.category } } : a;
  });
}
