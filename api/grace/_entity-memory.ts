/**
 * Read-only, server-authorized person memory for Ask GRACE.
 *
 * This deliberately returns a deterministic summary instead of injecting a
 * profile into a model prompt. The server resolves both tenant and RBAC, and
 * sensitive care/financial fields never enter this response.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveStaffActor } from '../_lib/authz.js';
import { readBody, str } from '../_lib/validation.js';
import { getOrCreateConversation, persistTurn } from '../_lib/grace-conversation.js';
import { enforceRateLimit } from '../_lib/rateLimit/limiter.js';
import { logSecurityEvent, securityContext } from '../_lib/securityLog.js';
// E-3: reuse the SAME matcher the action path uses, so "ambiguous" means one
// thing in this product. A second implementation here diverged immediately:
// exact-full-name-only made `matches.length > 1` reachable only for identical
// full names, so a bare first name returned "not found" — and Central
// Henderson has two Sarahs. countPersonMatches tiers exact-full-name →
// exact-first-name → substring, returning EVERY match at whichever tier hit.
// personMatching.ts is a dependency-free leaf on purpose: this route runs
// under Node ESM, where the client module's extensionless imports do not
// resolve (ERR_MODULE_NOT_FOUND on actionCatalog took the route down in
// production on 2026-09-04).
import { countPersonMatches } from '../../src/lib/personMatching.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SCHEMA = {
  name: str({ required: true, min: 1, max: 120 }),
  // E-5: the client's current thread, so a deterministic answer still lands in
  // history. Optional — an absent id starts a conversation rather than failing.
  conversationId: str({ required: false }),
  /** The user's actual wording, so history reads as the turn they took. */
  question: str({ required: false, max: 4000 }),
};

type PersonRow = { id: string; first_name: string; last_name: string; status: string; first_visit: string | null; join_date: string | null };
type InteractionRow = { type: string; created_at: string };
type TaskRow = { title: string; due_date: string; priority: string };
type GroupRow = { name: string; is_active: boolean };

function date(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'service_not_configured' });
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;
  if (!actor.permissions.has('people.view')) return res.status(403).json({ error: 'permission_required' });
  // E-6: this route reads person records and was the only Ask GRACE surface
  // with no limit at all. Same shape as api/grace/_chat.ts's own guard.
  if (await enforceRateLimit(res, `grace:entity-memory:${actor.userId}`, 20, 60,
    'You\u2019re looking up records quickly — please wait a moment.')) return;
  const body = readBody(req, res, SCHEMA);
  if (!body) return;

  // E-5: this route answers a staff question without calling the model, but a
  // deterministic answer is still a turn. Persist both sides so it appears in
  // history and so the NEXT turn can resolve "what about her?" — otherwise the
  // conversation silently loses the exchange (ADR-014's continuity promise).
  // Nothing is metered: there is no model call, so a usage row would be noise.
  // Persistence never blocks the answer; the reply is returned either way.
  const asked = body.question?.trim() || `What do you remember about ${body.name}?`;
  async function respond(status: string, reply: string) {
    // E-7: a miss is not an answer. The client broadened its intent matcher on
    // the promise that not_found falls through to the model, so persisting it
    // here would write a dead end into history AND double-write the turn once
    // the model answers. Only a real result becomes part of the conversation.
    if (status === 'not_found') return res.status(200).json({ status, reply });

    const conversation = await getOrCreateConversation(supabase, actor!.churchId, actor!.userId, body!.conversationId, asked);
    if (conversation) {
      const ok = await persistTurn(supabase, {
        churchId: actor!.churchId, userId: actor!.userId,
        conversationId: conversation.id, question: asked, reply,
      });
      if (!ok) console.error('[grace/entity-memory] turn persist failed', { conversation_id: conversation.id });
      res.setHeader('X-Conversation-Id', conversation.id);
    }
    return res.status(200).json({ status, reply });
  }

  // E-6: a candidate query, not the whole roster. countPersonMatches still
  // decides the outcome — this only narrows what it is handed, and is a strict
  // SUPERSET of all three of its tiers: any name it would match must contain
  // either the whole query or one of its tokens inside first_name or
  // last_name, including the cross-field case ("rah Mit" -> Sarah Mitchell),
  // which is why every token is ORed on BOTH columns.
  const needle = body.name!.trim();
  const tokens = [needle, ...needle.split(/\s+/)].filter(t => t.length > 0);
  const escaped = [...new Set(tokens)].map(t => t.replace(/[,.()*]/g, ' ').trim()).filter(Boolean);
  const filter = escaped.flatMap(t => [`first_name.ilike.*${t}*`, `last_name.ilike.*${t}*`]).join(',');
  const { data: roster } = await supabase
    .from('people').select('id, first_name, last_name, status, first_visit, join_date')
    .eq('church_id', actor.churchId)
    .or(filter || 'first_name.ilike.*');
  const rows = (roster ?? []) as PersonRow[];
  const byId = new Map(rows.map(r => [r.id, r]));
  const candidates = countPersonMatches(
    body.name!,
    rows.map(r => ({ id: r.id, firstName: r.first_name ?? '', lastName: r.last_name ?? '' })),
  );
  if (candidates.length === 0) return respond('not_found', `I couldn't find a current record for ${body.name}.`);
  if (candidates.length > 1) {
    // Name the candidates, same as the action path's blockOnAmbiguity. Full
    // names only — never a disambiguating detail the caller may not be
    // authorized to see.
    const names = candidates.map(c => `${c.firstName} ${c.lastName}`.trim()).join(', ');
    return respond('ambiguous', `More than one person matches "${body.name}". I found: ${names}. Which one do you mean?`);
  }

  const person = byId.get(candidates[0].id)!;
  const [interactionsRes, tasksRes, membershipsRes] = await Promise.all([
    supabase.from('interactions').select('type, created_at').eq('church_id', actor.churchId).eq('person_id', person.id).order('created_at', { ascending: false }).limit(5),
    // E-2: tasks.view (9 roles), NOT work_orders.view (2 roles) — the latter
    // silently returned no tasks for seven roles that are authorized to see
    // them, while the reply still claimed to be the complete record.
    actor.permissions.has('tasks.view')
      ? supabase.from('tasks').select('title, due_date, priority').eq('church_id', actor.churchId).eq('person_id', person.id).eq('completed', false).order('due_date', { ascending: true }).limit(10)
      : Promise.resolve({ data: [] }),
    actor.permissions.has('groups.view')
      ? supabase.from('group_memberships').select('small_groups(name, is_active)').eq('person_id', person.id)
      : Promise.resolve({ data: [] }),
  ]);

  const lines = [`Here is the current, authorized record for ${person.first_name} ${person.last_name}:`, `- Status: ${person.status}.`];
  if (person.first_visit) lines.push(`- First visit: ${date(person.first_visit)}.`);
  if (person.join_date) lines.push(`- Joined: ${date(person.join_date)}.`);
  // E-1: tags are deliberately NOT surfaced. They are a free-form array with no
  // sensitivity classification, and this tenant's live values include
  // `major-donor` (financial — gated elsewhere by giving_financial.view),
  // `homebound`, and `single-parent`. Emitting them under people.view (11
  // roles) disclosed donor status to, among others, Volunteer Coordinators —
  // in a response whose closing line promises it excludes financial details.
  // Re-adding them needs an allowlist or a real sensitivity model, not a slice().
  const interactions = (interactionsRes.data ?? []) as InteractionRow[];
  if (interactions.length) lines.push(`- Recent interactions: ${interactions.map(i => `${i.type} (${date(i.created_at)})`).join(', ')}.`);
  const tasks = (tasksRes.data ?? []) as TaskRow[];
  if (tasks.length) lines.push(`- Open tasks: ${tasks.map(t => `${t.title} (${t.priority}, due ${date(t.due_date)})`).join('; ')}.`);
  const memberships = (membershipsRes.data ?? []) as Array<{ small_groups: GroupRow | GroupRow[] | null }>;
  const groups = memberships.flatMap(m => Array.isArray(m.small_groups) ? m.small_groups : m.small_groups ? [m.small_groups] : []).filter(g => g.is_active);
  if (groups.length) lines.push(`- Active groups: ${groups.map(g => g.name).join(', ')}.`);

  // E-4: households are deliberately NOT returned yet.
  //
  // capability-manifest.ts declares `cap-household` unavailable — "I can see
  // individual people, but I don't currently have household/family groupings
  // available" — and that block is injected into EVERY Ask GRACE prompt.
  // Returning household members here would let GRACE deny the capability in one
  // turn and exercise it in the next.
  //
  // The fix is not to quietly promote the manifest entry. ADR-017 is explicit
  // that adding one "is EXACTLY as consequential as a Capability Baseline
  // change — do it only alongside real qualification evidence, never
  // speculatively", and this tenant currently has ZERO household rows, so the
  // capability cannot be qualified against real data at all. A mock-only
  // fixture would reproduce the `proofBoundary: 'mock'` weakness the
  // architecture checkpoint criticised.
  //
  // Costs nothing today (0 households live). RE-ENTRY: when household data is
  // imported, add a fixture proving authorized retrieval + `households.view`
  // denial + cross-tenant denial, promote `cap-household` in BOTH manifests
  // with that evidence, then restore this block — the `households.view` gate
  // and the never-query-without-permission shape below are worth keeping.
  //
  //   if (person.household_id && actor.permissions.has('households.view')) {
  //     … select('relationship, people(first_name, last_name)')
  //        .eq('household_id', person.household_id) …
  //   }
  lines.push('This summary excludes private pastoral, health, financial, and prayer details.');

  // E-6: "who looked up whom" is a question a church will eventually ask about
  // its pastoral records, and nothing recorded it. security_events, not
  // audit_logs: this is an ACCESS event, matching the authz.view_as precedent
  // — audit_logs is the mutation trail, and filing reads there would dilute
  // the "who changed what" query it exists to answer. The person's id is
  // recorded, never the summary that was returned.
  await logSecurityEvent(supabase, {
    eventType: 'grace.person_record_viewed',
    severity: 'info',
    churchId: actor.churchId,
    actorClerkId: actor.clerkUserId,
    ...securityContext(req),
    detail: { person_id: person.id, via: 'ask_grace_entity_memory' },
  });

  return respond('found', lines.join('\n'));
}
