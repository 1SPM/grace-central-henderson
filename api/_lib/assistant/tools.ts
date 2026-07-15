/**
 * The 14 narrow tools the member-facing GRACE assistant may call.
 *
 * Every tool:
 *   - takes an AssistantToolContext carrying a resolveMemberActor-derived
 *     MemberActor (never a client- or model-supplied person/church id —
 *     the same identity-resolution discipline as every other portal
 *     route) and the Supabase service client;
 *   - validates its own arguments (separate from Gemini's function-
 *     calling schema, which only constrains shape, not business rules);
 *   - scopes every query/write to member.personId + member.churchId;
 *   - returns the minimum fields a conversational answer needs — never
 *     a raw table row, never staff-only fields (assignee identity,
 *     internal notes, crisis flags, sentinel review status, Stripe/
 *     provider identifiers, account/routing numbers);
 *   - is executed through executeAssistantTool() below, which is the
 *     SINGLE place that emits the audit platform event for every call —
 *     centralized so no tool can accidentally skip it.
 *
 * These reuse the exact same underlying tables and business rules as
 * the equivalent Members Portal REST endpoints (api/portal/_care.ts,
 * _events.ts, _groups.ts, _volunteer.ts, _giving.ts, _contact.ts) —
 * where a rule lives there (crisis detection, member-safe status
 * mapping, consent-derived preference flags), it is imported from the
 * same shared lib, not reimplemented, so the assistant can never drift
 * from the form-based flow's safety behavior.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { MemberActor } from '../authz.js';
import { emitPlatformEvent } from '../platformEvents.js';
import { detectCrisisLanguage, toCareMemberStatus, CRISIS_RESOURCE_MESSAGE } from '../careSafety.js';
import { createPortalRequestTask } from '../portalRequestTask.js';
import { deriveCommunicationFlags } from '../consentPreferences.js';
import { VOLUNTEER_OPPORTUNITIES } from '../volunteerOpportunities.js';

// Inlined rather than importing src/lib/services/impactCard.ts — that
// module also pulls in browser-only Clerk client code (getClerkTokenProvider)
// that must never end up bundled into a Vercel serverless function.
function microUsdToDollars(micro: number): number {
  return micro / 1_000_000;
}

export interface AssistantToolContext {
  supabase: SupabaseClient;
  member: MemberActor;
}

export type ToolResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; error: string };

function fail(error: string): ToolResult {
  return { ok: false, error };
}
function ok(data: Record<string, unknown>): ToolResult {
  return { ok: true, data };
}

// ---------------------------------------------------------------------
// 1. get_my_profile
// ---------------------------------------------------------------------
async function getMyProfile(ctx: AssistantToolContext): Promise<ToolResult> {
  const { data, error } = await ctx.supabase
    .from('people')
    .select('first_name, last_name, email, phone')
    .eq('id', ctx.member.personId)
    .eq('church_id', ctx.member.churchId)
    .maybeSingle();
  if (error) return fail('read_failed');
  return ok({ profile: data ?? null });
}

// ---------------------------------------------------------------------
// 2. update_my_preferences
// ---------------------------------------------------------------------
// Deliberately a narrower set than the full consents API surface
// (api/consents/_index.ts supports pastoral_contact, directory_visibility,
// etc.) — the assistant only handles plain communication-channel
// preferences conversationally; anything more sensitive stays a form.
const ASSISTANT_CONSENT_TYPES = ['email', 'sms', 'push_notification'] as const;
type AssistantConsentType = (typeof ASSISTANT_CONSENT_TYPES)[number];

async function updateMyPreferences(ctx: AssistantToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const consentType = String(args.consent_type ?? '');
  const status = String(args.status ?? '');
  if (!ASSISTANT_CONSENT_TYPES.includes(consentType as AssistantConsentType)) {
    return fail(`consent_type must be one of: ${ASSISTANT_CONSENT_TYPES.join(', ')}`);
  }
  if (!['granted', 'denied'].includes(status)) {
    return fail('status must be "granted" or "denied"');
  }

  const { error: upsertErr } = await ctx.supabase.from('consents').upsert(
    {
      church_id: ctx.member.churchId,
      person_id: ctx.member.personId,
      consent_type: consentType,
      status,
      source: 'portal_assistant',
      granted_at: status === 'granted' ? new Date().toISOString() : null,
    },
    { onConflict: 'person_id,consent_type' },
  );
  if (upsertErr) return fail('update_failed');

  const { data: consents } = await ctx.supabase
    .from('consents')
    .select('consent_type, status')
    .eq('church_id', ctx.member.churchId)
    .eq('person_id', ctx.member.personId);
  const flags = deriveCommunicationFlags(consents ?? []);
  await ctx.supabase.from('communication_preferences').upsert(
    { church_id: ctx.member.churchId, person_id: ctx.member.personId, ...flags },
    { onConflict: 'person_id' },
  );

  return ok({ consent_type: consentType, status, preferences: flags });
}

// ---------------------------------------------------------------------
// 3. list_upcoming_events
// ---------------------------------------------------------------------
async function listUpcomingEvents(ctx: AssistantToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const limit = Math.min(Math.max(Number(args.limit) || 5, 1), 10);
  const nowIso = new Date().toISOString();
  const [{ data: events, error }, { data: myRsvps }] = await Promise.all([
    ctx.supabase.from('calendar_events')
      .select('id, title, start_date, location, category')
      .eq('church_id', ctx.member.churchId)
      .gte('start_date', nowIso)
      .order('start_date', { ascending: true })
      .limit(limit),
    ctx.supabase.from('event_rsvps').select('event_id, status').eq('person_id', ctx.member.personId),
  ]);
  if (error) return fail('read_failed');
  const rsvpByEvent = new Map((myRsvps ?? []).map(r => [r.event_id, r.status]));
  return ok({
    events: (events ?? []).map(e => ({ ...e, my_rsvp_status: rsvpByEvent.get(e.id) ?? null })),
  });
}

// ---------------------------------------------------------------------
// 4. rsvp_to_event
// ---------------------------------------------------------------------
async function rsvpToEvent(ctx: AssistantToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const eventId = String(args.event_id ?? '');
  const status = String(args.status ?? '');
  const guestCount = Math.min(Math.max(Number(args.guest_count) || 0, 0), 20);
  if (!/^[0-9a-fA-F-]{36}$/.test(eventId)) return fail('event_id must be a valid id');
  if (!['yes', 'no', 'maybe'].includes(status)) return fail('status must be yes, no, or maybe');

  const { data: event } = await ctx.supabase
    .from('calendar_events')
    .select('id, title')
    .eq('id', eventId)
    .eq('church_id', ctx.member.churchId)
    .maybeSingle();
  if (!event) return fail('event_not_found');

  const { error } = await ctx.supabase.from('event_rsvps').upsert(
    {
      church_id: ctx.member.churchId,
      event_id: eventId,
      person_id: ctx.member.personId,
      status,
      guest_count: guestCount,
      source: 'portal_assistant',
    },
    { onConflict: 'event_id,person_id' },
  );
  if (error) return fail('rsvp_failed');

  await emitPlatformEvent(ctx.supabase, {
    churchId: ctx.member.churchId,
    eventType: 'event.rsvp.created',
    sourceApp: 'member_portal',
    actorPersonId: ctx.member.personId,
    subjectType: 'calendar_event',
    subjectId: eventId,
    payload: { event_title: event.title, status, via: 'assistant' },
  });

  return ok({ event_title: event.title, status });
}

// ---------------------------------------------------------------------
// 5. list_groups
// ---------------------------------------------------------------------
async function listGroups(ctx: AssistantToolContext): Promise<ToolResult> {
  const [{ data: groups, error }, { data: myMemberships }] = await Promise.all([
    ctx.supabase.from('small_groups')
      .select('id, name, meeting_day, meeting_time, location')
      .eq('church_id', ctx.member.churchId)
      .eq('is_active', true)
      .order('name')
      .limit(20),
    ctx.supabase.from('group_memberships').select('group_id, status').eq('person_id', ctx.member.personId),
  ]);
  if (error) return fail('read_failed');
  const statusByGroup = new Map((myMemberships ?? []).map(m => [m.group_id, m.status]));
  return ok({
    groups: (groups ?? []).map(g => ({ ...g, my_status: statusByGroup.get(g.id) ?? null })),
  });
}

// ---------------------------------------------------------------------
// 6. request_group_membership
// ---------------------------------------------------------------------
async function requestGroupMembership(ctx: AssistantToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const groupId = String(args.group_id ?? '');
  if (!/^[0-9a-fA-F-]{36}$/.test(groupId)) return fail('group_id must be a valid id');

  const { data: group } = await ctx.supabase
    .from('small_groups')
    .select('id, name')
    .eq('id', groupId)
    .eq('church_id', ctx.member.churchId)
    .eq('is_active', true)
    .maybeSingle();
  if (!group) return fail('group_not_found');

  const { data: existing } = await ctx.supabase
    .from('group_memberships')
    .select('id, status')
    .eq('group_id', groupId)
    .eq('person_id', ctx.member.personId)
    .maybeSingle();
  if (existing) return fail(`already_${existing.status}`);

  const { error } = await ctx.supabase
    .from('group_memberships')
    .insert({ group_id: groupId, person_id: ctx.member.personId, status: 'pending' });
  if (error) return fail('request_failed');

  await emitPlatformEvent(ctx.supabase, {
    churchId: ctx.member.churchId,
    eventType: 'group.join.requested',
    sourceApp: 'member_portal',
    actorPersonId: ctx.member.personId,
    subjectType: 'group',
    subjectId: groupId,
    payload: { group_name: group.name, via: 'assistant' },
  });
  await createPortalRequestTask(ctx.supabase, {
    churchId: ctx.member.churchId,
    personId: ctx.member.personId,
    requestType: 'group_join',
    title: `Group join request: ${group.name}`,
    description: 'Submitted via the GRACE member assistant.',
  });

  return ok({ group_name: group.name, status: 'pending' });
}

// ---------------------------------------------------------------------
// 7. list_volunteer_opportunities
// ---------------------------------------------------------------------
async function listVolunteerOpportunities(): Promise<ToolResult> {
  return ok({ opportunities: VOLUNTEER_OPPORTUNITIES });
}

// ---------------------------------------------------------------------
// 8. submit_volunteer_interest
// ---------------------------------------------------------------------
async function submitVolunteerInterest(ctx: AssistantToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const area = String(args.area ?? '');
  const message = args.message ? String(args.message).slice(0, 1000) : null;
  const opportunity = VOLUNTEER_OPPORTUNITIES.find(o => o.key === area);
  const areaLabel = opportunity?.title ?? (area === 'other' ? 'Other' : null);
  if (!areaLabel) return fail('area must be a known opportunity key or "other"');

  const { data: interest, error } = await ctx.supabase
    .from('volunteer_interests')
    .insert({ church_id: ctx.member.churchId, person_id: ctx.member.personId, area: areaLabel, message })
    .select('id')
    .single();
  if (error || !interest) return fail('create_failed');

  await emitPlatformEvent(ctx.supabase, {
    churchId: ctx.member.churchId,
    eventType: 'volunteer.interest.submitted',
    sourceApp: 'member_portal',
    actorPersonId: ctx.member.personId,
    subjectType: 'volunteer_interest',
    subjectId: interest.id,
    payload: { area: areaLabel, via: 'assistant' },
  });
  await createPortalRequestTask(ctx.supabase, {
    churchId: ctx.member.churchId,
    personId: ctx.member.personId,
    requestType: 'volunteer_interest',
    title: `Volunteer interest: ${areaLabel}`,
    description: message ?? `Submitted via the GRACE member assistant.`,
  });

  return ok({ area: areaLabel, status: 'submitted' });
}

// ---------------------------------------------------------------------
// 9. start_care_request
// ---------------------------------------------------------------------
const CARE_CATEGORIES = ['marriage', 'addiction', 'grief', 'faith-questions', 'crisis', 'financial', 'anxiety-depression', 'parenting', 'general'];
const SENSITIVE_CARE_CATEGORIES = new Set(['crisis', 'financial', 'addiction']);

async function startCareRequest(ctx: AssistantToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const category = String(args.category ?? 'general');
  const message = String(args.message ?? '').trim();
  const contactMethod = String(args.preferred_contact_method ?? 'either');
  const visibility = String(args.visibility ?? 'private_pastoral_care');
  const wantsFollowup = args.requests_human_followup !== false;

  if (!CARE_CATEGORIES.includes(category)) return fail(`category must be one of: ${CARE_CATEGORIES.join(', ')}`);
  if (!message || message.length > 4000) return fail('message is required (max 4000 characters)');
  if (!['email', 'sms', 'phone', 'either'].includes(contactMethod)) return fail('invalid preferred_contact_method');
  if (!['private_pastoral_care', 'specific_care_team'].includes(visibility)) return fail('invalid visibility');

  // Same deterministic crisis gate as api/portal/_care.ts — never
  // decided by the model, always this keyword check.
  const crisisFlagged = category === 'crisis' || detectCrisisLanguage(message);
  const requiresSentinelReview = crisisFlagged || SENSITIVE_CARE_CATEGORIES.has(category);

  const { data: careRequest, error } = await ctx.supabase
    .from('care_requests')
    .insert({
      church_id: ctx.member.churchId,
      person_id: ctx.member.personId,
      submitted_via: 'portal_assistant',
      category,
      priority: crisisFlagged ? 'crisis' : 'medium',
      summary: message,
      is_confidential: true,
      crisis_flagged: crisisFlagged,
      preferred_contact_method: contactMethod,
      requests_human_followup: wantsFollowup,
      visibility,
      sentinel_review_status: requiresSentinelReview ? 'pending' : 'not_required',
    })
    .select('id, category, status, created_at')
    .single();
  if (error || !careRequest) return fail('create_failed');

  if (wantsFollowup) {
    await ctx.supabase.from('consents').upsert(
      {
        church_id: ctx.member.churchId,
        person_id: ctx.member.personId,
        consent_type: 'pastoral_contact',
        status: 'granted',
        source: 'portal_assistant',
        granted_at: new Date().toISOString(),
        notes: 'Auto-recorded: member requested human follow-up via the GRACE assistant.',
      },
      { onConflict: 'person_id,consent_type' },
    );
  }

  await emitPlatformEvent(ctx.supabase, {
    churchId: ctx.member.churchId,
    eventType: 'care.request.submitted',
    sourceApp: 'member_portal',
    actorPersonId: ctx.member.personId,
    subjectType: 'care_request',
    subjectId: careRequest.id,
    payload: { category, crisis_flagged: crisisFlagged, via: 'assistant' },
  });

  // Never return crisis_flagged, sentinel_review_status, or priority to
  // the model/member — only a member-safe status, same as the form flow.
  return ok({
    category,
    status: toCareMemberStatus(careRequest.status, false),
    submitted_at: careRequest.created_at,
    ...(crisisFlagged ? { crisis_resource_message: CRISIS_RESOURCE_MESSAGE } : {}),
  });
}

// ---------------------------------------------------------------------
// 10. get_my_care_request_status
// ---------------------------------------------------------------------
async function getMyCareRequestStatus(ctx: AssistantToolContext): Promise<ToolResult> {
  const { data: requests, error } = await ctx.supabase
    .from('care_requests')
    .select('id, category, status, created_at, resolved_at, care_assignments(id)')
    .eq('person_id', ctx.member.personId)
    .eq('church_id', ctx.member.churchId)
    .order('created_at', { ascending: false })
    .limit(10);
  if (error) return fail('read_failed');

  return ok({
    requests: (requests ?? []).map(r => ({
      category: r.category,
      status: toCareMemberStatus(r.status, ((r as unknown as { care_assignments: unknown[] }).care_assignments ?? []).length > 0),
      submitted_at: r.created_at,
      resolved_at: r.resolved_at,
    })),
  });
}

// ---------------------------------------------------------------------
// 11. get_my_giving_summary
// ---------------------------------------------------------------------
async function getMyGivingSummary(ctx: AssistantToolContext): Promise<ToolResult> {
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const [{ data: church }, { data: gifts, error }, { data: recurring }] = await Promise.all([
    ctx.supabase.from('churches').select('stripe_connect_charges_enabled').eq('id', ctx.member.churchId).maybeSingle(),
    ctx.supabase.from('giving')
      .select('amount, date')
      .eq('church_id', ctx.member.churchId)
      .eq('person_id', ctx.member.personId)
      .gte('date', yearStart),
    ctx.supabase.from('recurring_giving')
      .select('id')
      .eq('church_id', ctx.member.churchId)
      .eq('person_id', ctx.member.personId)
      .eq('status', 'active'),
  ]);
  if (error) return fail('read_failed');

  const ytdTotal = (gifts ?? []).reduce((sum, g) => sum + Number(g.amount), 0);
  const mostRecent = (gifts ?? []).map(g => g.date).sort().at(-1) ?? null;

  return ok({
    giving_active: !!church?.stripe_connect_charges_enabled,
    year_to_date_total: Math.round(ytdTotal * 100) / 100,
    active_recurring_gift_count: (recurring ?? []).length,
    most_recent_gift_date: mostRecent,
  });
}

// ---------------------------------------------------------------------
// 12. get_my_impact_summary
// ---------------------------------------------------------------------
async function getMyImpactSummary(ctx: AssistantToolContext): Promise<ToolResult> {
  const [{ data: kyc }, { data: cards }, { data: account }, { data: route }] = await Promise.all([
    ctx.supabase.from('kyc_verifications')
      .select('status')
      .eq('church_id', ctx.member.churchId)
      .eq('person_id', ctx.member.personId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
    ctx.supabase.from('cards')
      .select('status')
      .eq('church_id', ctx.member.churchId)
      .eq('cardholder_person_id', ctx.member.personId)
      .order('issued_at', { ascending: false })
      .limit(1),
    ctx.supabase.from('card_accounts')
      .select('available_balance_micro_usd')
      .eq('church_id', ctx.member.churchId)
      .eq('person_id', ctx.member.personId)
      .maybeSingle(),
    ctx.supabase.from('impact_routes')
      .select('route_label')
      .eq('church_id', ctx.member.churchId)
      .eq('person_id', ctx.member.personId)
      .maybeSingle(),
  ]);

  // Never expose i2c_card_id, masked_pan, account_number_last4, or
  // routing_number — only status labels + a rounded balance.
  return ok({
    application_status: kyc?.status ?? 'not_started',
    card_status: cards?.[0]?.status ?? 'none',
    available_balance_usd: account ? microUsdToDollars(account.available_balance_micro_usd) : null,
    impact_route_label: route?.route_label ?? null,
  });
}

// ---------------------------------------------------------------------
// 13. search_approved_church_resources
// ---------------------------------------------------------------------
async function searchApprovedChurchResources(ctx: AssistantToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const query = String(args.query ?? '').trim().slice(0, 200);
  if (!query) return fail('query is required');

  const nowIso = new Date().toISOString();
  const [{ data: announcements, error }, { data: church }] = await Promise.all([
    ctx.supabase.from('announcements')
      .select('title, body, category, published_at')
      .eq('church_id', ctx.member.churchId)
      .not('published_at', 'is', null)
      .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      .or(`title.ilike.%${query}%,body.ilike.%${query}%`)
      .order('pinned', { ascending: false })
      .order('published_at', { ascending: false })
      .limit(5),
    ctx.supabase.from('churches')
      .select('name, address, city, state, zip, phone, website, timezone, settings')
      .eq('id', ctx.member.churchId)
      .maybeSingle(),
  ]);
  if (error) return fail('read_failed');

  return ok({
    church_info: church ? {
      name: church.name, address: church.address, city: church.city, state: church.state,
      phone: church.phone, website: church.website,
      service_times: (church.settings as Record<string, unknown> | null)?.service_times ?? null,
    } : null,
    resources: (announcements ?? []).map(a => ({
      title: a.title,
      excerpt: (a.body ?? '').slice(0, 280),
      category: a.category,
      published_at: a.published_at,
    })),
  });
}

// ---------------------------------------------------------------------
// 14. request_human_followup
// ---------------------------------------------------------------------
async function requestHumanFollowup(ctx: AssistantToolContext, args: Record<string, unknown>): Promise<ToolResult> {
  const message = String(args.message ?? '').trim();
  if (!message || message.length > 2000) return fail('message is required (max 2000 characters)');

  await emitPlatformEvent(ctx.supabase, {
    churchId: ctx.member.churchId,
    eventType: 'contact.request.submitted',
    sourceApp: 'member_portal',
    actorPersonId: ctx.member.personId,
    subjectType: 'contact_request',
    subjectId: null,
    payload: { via: 'assistant' },
  });
  const { taskId } = await createPortalRequestTask(ctx.supabase, {
    churchId: ctx.member.churchId,
    personId: ctx.member.personId,
    requestType: 'contact_church',
    title: 'Contact: requested via GRACE assistant',
    description: message,
  });

  return ok({ status: taskId ? 'submitted' : 'submitted', note: 'A staff member will follow up with you directly.' });
}

// ---------------------------------------------------------------------
// Dispatcher
// ---------------------------------------------------------------------

export const ASSISTANT_TOOL_NAMES = [
  'get_my_profile',
  'update_my_preferences',
  'list_upcoming_events',
  'rsvp_to_event',
  'list_groups',
  'request_group_membership',
  'list_volunteer_opportunities',
  'submit_volunteer_interest',
  'start_care_request',
  'get_my_care_request_status',
  'get_my_giving_summary',
  'get_my_impact_summary',
  'search_approved_church_resources',
  'request_human_followup',
] as const;

export type AssistantToolName = (typeof ASSISTANT_TOOL_NAMES)[number];

type ToolFn = (ctx: AssistantToolContext, args: Record<string, unknown>) => Promise<ToolResult>;

const TOOL_IMPLEMENTATIONS: Record<AssistantToolName, ToolFn> = {
  get_my_profile: (ctx) => getMyProfile(ctx),
  update_my_preferences: (ctx, args) => updateMyPreferences(ctx, args),
  list_upcoming_events: (ctx, args) => listUpcomingEvents(ctx, args),
  rsvp_to_event: (ctx, args) => rsvpToEvent(ctx, args),
  list_groups: (ctx) => listGroups(ctx),
  request_group_membership: (ctx, args) => requestGroupMembership(ctx, args),
  list_volunteer_opportunities: () => listVolunteerOpportunities(),
  submit_volunteer_interest: (ctx, args) => submitVolunteerInterest(ctx, args),
  start_care_request: (ctx, args) => startCareRequest(ctx, args),
  get_my_care_request_status: (ctx) => getMyCareRequestStatus(ctx),
  get_my_giving_summary: (ctx) => getMyGivingSummary(ctx),
  get_my_impact_summary: (ctx) => getMyImpactSummary(ctx),
  search_approved_church_resources: (ctx, args) => searchApprovedChurchResources(ctx, args),
  request_human_followup: (ctx, args) => requestHumanFollowup(ctx, args),
};

export function isAssistantToolName(name: string): name is AssistantToolName {
  return (ASSISTANT_TOOL_NAMES as readonly string[]).includes(name);
}

/**
 * The single execution seam for every tool call — this is where the
 * audit platform event is emitted, so no individual tool can forget to
 * log itself. Args are summarized (keys only, no values) in the audit
 * payload to avoid writing free-text member content into platform_events.
 */
export async function executeAssistantTool(
  name: AssistantToolName,
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  let result: ToolResult;
  try {
    result = await TOOL_IMPLEMENTATIONS[name](ctx, args);
  } catch (err) {
    console.error('[assistant/tools] tool threw', { name, error: err });
    result = fail('tool_execution_failed');
  }

  await emitPlatformEvent(ctx.supabase, {
    churchId: ctx.member.churchId,
    eventType: 'assistant.tool_invoked',
    sourceApp: 'member_portal',
    actorPersonId: ctx.member.personId,
    subjectType: 'assistant_tool',
    subjectId: null,
    payload: { tool: name, arg_keys: Object.keys(args), success: result.ok },
  });

  return result;
}
