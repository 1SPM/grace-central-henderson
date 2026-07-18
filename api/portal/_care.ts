/**
 * /api/portal/care
 *
 *   POST — submit a care request: category, message, preferred contact
 *          method, whether human follow-up is requested, and visibility
 *          (private_pastoral_care | specific_care_team).
 *   GET  — the member's own care requests with a member-safe status
 *          only (never the internal status, crisis flag, assignment, or
 *          any internal note).
 *
 * Administrative workflow triggered by a successful POST:
 *   1. Consent is validated/recorded (see below).
 *   2. A real care_requests row is created (is_confidential=true always).
 *   3. care.request.submitted is emitted (platform_events).
 *   4. The care_requests row itself IS the staff task — any care.view
 *      holder sees it immediately in the Pastoral Care queue
 *      (api/care-requests). No separate Work Order is created, by
 *      design: Work Orders are visible to any work_orders.view holder
 *      (which includes non-care staff, e.g. Ministry Leader), and care
 *      content must never reach general ministry staff. See
 *      SHARED_BACKEND.md / this phase's completion notes.
 *   5. Crisis language or a sensitive category marks
 *      sentinel_review_status='pending' — a REQUIRED HUMAN REVIEW flag,
 *      never an automated clearance. The system does not manage the
 *      crisis itself; see docs/AI_BOUNDARIES.md.
 *   6-10. Assignment, internal notes, status updates, follow-up, and
 *      closure all happen via api/care-requests/* (staff-only).
 *
 * Auth: Clerk Bearer (or demo bootstrap) via resolveMemberActor.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveMemberActor } from '../_lib/authz.js';
import { emitPlatformEvent } from '../_lib/platformEvents.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { detectCrisisLanguage, toCareMemberStatus } from '../_lib/careSafety.js';
import { readBody, str, bool_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CATEGORIES = ['marriage', 'addiction', 'grief', 'faith-questions', 'crisis', 'financial', 'anxiety-depression', 'parenting', 'general'];

const SUBMIT_SCHEMA = {
  category: str({ required: true, pattern: new RegExp(`^(${CATEGORIES.join('|')})$`) }),
  message: str({ required: true, min: 1, max: 4000 }),
  preferred_contact_method: str({ pattern: /^(email|sms|phone|either)$/ }),
  requests_human_followup: bool_(),
  visibility: str({ pattern: /^(private_pastoral_care|specific_care_team)$/ }),
};

const SENTIVE_CATEGORIES = new Set(['crisis', 'financial', 'addiction']);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const member = await resolveMemberActor(req, res, supabase);
  if (!member) return;

  if (req.method === 'GET') {
    const { data: requests, error } = await supabase
      .from('care_requests')
      .select('id, category, status, crisis_flagged, created_at, resolved_at, care_assignments(id)')
      .eq('person_id', member.personId)
      .eq('church_id', member.churchId)
      .order('created_at', { ascending: false });
    if (error) return res.status(500).json({ error: 'read_failed' });

    const memberSafe = (requests ?? []).map(r => ({
      id: r.id,
      category: r.category,
      status: toCareMemberStatus(r.status, ((r as unknown as { care_assignments: unknown[] }).care_assignments ?? []).length > 0),
      submitted_at: r.created_at,
      resolved_at: r.resolved_at,
    }));
    return res.status(200).json({ requests: memberSafe });
  }

  if (req.method === 'POST') {
    const body = readBody(req, res, SUBMIT_SCHEMA);
    if (!body) return;

    const crisisFlagged = body.category === 'crisis' || detectCrisisLanguage(body.message);
    const requiresSentinelReview = crisisFlagged || SENTIVE_CATEGORIES.has(body.category!);

    const { data: careRequest, error } = await supabase
      .from('care_requests')
      .insert({
        church_id: member.churchId,
        person_id: member.personId,
        submitted_via: 'portal',
        category: body.category,
        priority: crisisFlagged ? 'crisis' : 'medium',
        summary: body.message,
        is_confidential: true,
        crisis_flagged: crisisFlagged,
        preferred_contact_method: body.preferred_contact_method ?? 'either',
        requests_human_followup: body.requests_human_followup ?? true,
        visibility: body.visibility ?? 'private_pastoral_care',
        sentinel_review_status: requiresSentinelReview ? 'pending' : 'not_required',
      })
      .select()
      .single();
    if (error || !careRequest) {
      console.error('[portal/care] create failed', error);
      return res.status(500).json({ error: 'create_failed' });
    }

    // Event-triggered finding: a crisis needs to reach the Decision
    // Queue in seconds, not at the next cron/workflow pass. Never lets a
    // finding-write failure fail the member's care submission — same
    // resilience posture as the consent/audit writes below. No
    // confidential summary text in title/detail (care_requests is
    // confidential-tier — matches the crisis item convention in
    // api/_lib/decisionQueue.ts).
    if (crisisFlagged) {
      try {
        const { error: findingError } = await supabase.from('agent_findings').insert({
          church_id: member.churchId,
          agent_id: 'crisis-escalation',
          source: 'event',
          dedup_key: `crisis-escalation:event:${careRequest.id}`,
          title: 'Crisis-flagged care request',
          detail: `Priority: ${careRequest.priority}`,
          severity: 'critical',
          status: 'open',
          subject_type: 'care_request',
          subject_id: careRequest.id,
          payload: { category: careRequest.category },
        });
        if (findingError) console.error('[portal/care] crisis finding insert failed', findingError);
      } catch (findingErr) {
        console.error('[portal/care] crisis finding insert failed', findingErr);
      }
    }

    // 1. Consent: a member actively submitting a care request that asks
    // for human follow-up is explicit, in-the-moment consent for that
    // specific pastoral contact — record it as such rather than blocking
    // a member in need on a stale/absent consent row.
    if (body.requests_human_followup ?? true) {
      await supabase.from('consents').upsert(
        {
          church_id: member.churchId,
          person_id: member.personId,
          consent_type: 'pastoral_contact',
          status: 'granted',
          source: 'portal',
          granted_at: new Date().toISOString(),
          notes: 'Auto-recorded: member requested human follow-up on a care request.',
        },
        { onConflict: 'person_id,consent_type' },
      );
    }

    const { correlationId } = await emitPlatformEvent(supabase, {
      churchId: member.churchId,
      eventType: 'care.request.submitted',
      sourceApp: 'member_portal',
      actorPersonId: member.personId,
      subjectType: 'care_request',
      subjectId: careRequest.id,
      payload: { category: body.category, crisis_flagged: crisisFlagged },
    });
    await recordAudit(supabase, {
      churchId: member.churchId,
      actorUserId: null,
      actorClerkId: member.clerkUserId,
      action: 'create',
      entityType: 'care_request',
      entityId: careRequest.id,
      after: { category: careRequest.category, visibility: careRequest.visibility, crisis_flagged: crisisFlagged },
      sourceApp: 'member_portal',
      reason: 'member self-service care request',
      correlationId,
      route: '/api/portal/care',
      method: 'POST',
    });

    return res.status(201).json({
      request: {
        id: careRequest.id,
        category: careRequest.category,
        status: toCareMemberStatus(careRequest.status, false),
        submitted_at: careRequest.created_at,
      },
      // Never returned: crisis_flagged, sentinel_review_status, priority, is_confidential internals.
    });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
