/**
 * POST /api/consents/erase — fulfil a right-to-be-forgotten request.
 *
 * The keystone of the deletion pipeline (deletion/retention audit change #1).
 * Staff-initiated, permission-gated, church-scoped, explicitly confirmed.
 *
 * What it does, in order:
 *   1. Load the target person (capturing their Clerk id) within the caller's church.
 *   2. Hard-delete the `people` row. The database FK rules then fire automatically
 *      (verified live):
 *        CASCADE  → prayer_requests, care_requests, interactions, member_journey_items,
 *                   consents, data_subject_requests (erased)
 *        SET NULL → giving, giving_statements, pastoral_sessions (retained but
 *                   de-identified — financial/ministry records kept per law)
 *   3. Best-effort delete the linked Clerk auth account (so the login can't persist).
 *   4. Record a PII-FREE audit entry (append-only, survives the cascade) — this is
 *      the durable proof the erasure happened, since the DSR row itself cascades away.
 *
 * Third-party processors: Clerk is automated here. PostHog / D-ID deletion and the
 * (retained) Stripe records are reported in `processors` for follow-up — see the
 * deletion/retention audit for the responsibilities matrix.
 *
 * NEVER logs the person's name/email — that would re-introduce PII into the
 * append-only audit trail, defeating the erasure.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';
import { requirePermission } from '../_lib/authz.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, uuid_, bool_ } from '../_lib/validation.js';
import { erasePostHogPerson } from '../_lib/privacy/thirdPartyErase.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

const SCHEMA = {
  person_id: uuid_({ required: true }),
  confirm: bool_({ required: true }),
  request_id: uuid_(),
};

type ProcessorOutcome = 'deleted' | 'not_linked' | 'not_configured' | 'retained_by_law' | 'manual_follow_up' | string;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

  // Erasure is a privacy-admin action — gate on the settings-management permission.
  const actor = await requirePermission(req, res, supabase, 'admin.manage_settings');
  if (!actor) return;

  const body = readBody(req, res, SCHEMA);
  if (!body) return;
  const { person_id, confirm, request_id } = body;

  // Guard against accidental calls: erasure is irreversible.
  if (confirm !== true) {
    return res.status(400).json({ error: 'confirmation_required', detail: 'Set confirm=true to erase — this cannot be undone.' });
  }

  // Object + tenant scope: the person must belong to the caller's church.
  const { data: person, error: lookupErr } = await supabase
    .from('people')
    .select('id, clerk_user_id')
    .eq('id', person_id!)
    .eq('church_id', actor.churchId)
    .maybeSingle();
  if (lookupErr) return res.status(500).json({ error: 'lookup_failed' });
  if (!person) return res.status(404).json({ error: 'person_not_found' });

  const clerkUserId = (person as { clerk_user_id: string | null }).clerk_user_id;

  // 1. Authoritative erasure: delete the people row. FK cascade/anonymize fires.
  const { error: delErr } = await supabase
    .from('people')
    .delete()
    .eq('id', person_id!)
    .eq('church_id', actor.churchId);
  if (delErr) return res.status(500).json({ error: 'erase_failed', detail: delErr.message });

  // 2. Best-effort third-party fan-out. Failures are recorded, not fatal — the
  //    authoritative erasure above already succeeded.
  const processors: Record<string, ProcessorOutcome> = {
    clerk: 'not_linked',
    posthog: 'not_linked',
    // D-ID streaming avatar sessions are ephemeral; we store no per-person
    // handle, so there is nothing to delete via API.
    d_id: 'no_stored_identifier',
    // Legally retained by the provider — no deletion:
    stripe: 'retained_by_law',
  };

  if (clerkUserId) {
    // Clerk auth account.
    if (CLERK_SECRET_KEY) {
      try {
        const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
        await clerk.users.deleteUser(clerkUserId);
        processors.clerk = 'deleted';
      } catch (err) {
        processors.clerk = `error: ${(err instanceof Error ? err.message : String(err)).slice(0, 120)}`;
      }
    } else {
      processors.clerk = 'not_configured';
    }
    // PostHog analytics (distinct id = the Clerk user id). Best-effort;
    // 'not_configured' until POSTHOG_PROJECT_ID / _PERSONAL_API_KEY are set.
    processors.posthog = await erasePostHogPerson([clerkUserId]);
  }

  // 3. Durable, PII-FREE proof of erasure (append-only; survives the cascade that
  //    removed the data_subject_requests row). No name/email is ever recorded.
  await recordAudit(supabase, {
    churchId: actor.churchId,
    actorUserId: actor.userId,
    actorClerkId: actor.clerkUserId,
    action: 'person.erased',
    entityType: 'person',
    entityId: person_id!,
    after: { processors, request_id: request_id ?? null },
    reason: 'right_to_be_forgotten',
    route: '/api/consents/erase',
    method: 'POST',
  });

  return res.status(200).json({
    erased: true,
    person_id,
    deleted: ['profile', 'prayer_requests', 'care_conversations', 'journey_notes', 'interactions', 'consents', 'community_posts'],
    anonymized: ['giving', 'giving_statements', 'pastoral_sessions'],
    retained_by_law: ['financial_ledger', 'audit_logs'],
    processors,
  });
}
