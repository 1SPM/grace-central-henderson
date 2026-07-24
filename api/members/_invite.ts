/**
 * POST /api/members/invite
 *
 * Bulk portal invitations — the operator's pre-qualification flow.
 * Staff select people in the CRM; for each person with an email we:
 *   1. mark the person portal_enabled
 *   2. mint a member_invitations row with a single-use token
 *   3. create a Clerk invitation whose redirect lands on
 *      /portal?invite=<token> so acceptance binds clerk_user_id
 *
 * Auth: Clerk Bearer, staff roles only. Church scope from the JWT —
 * person IDs outside the caller's church are rejected per-row.
 *
 * Body: { person_ids: string[] }   (max 200 per call)
 * Response: { results: [{ person_id, status, error? }] }
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient } from '@clerk/backend';
import { requireClerkAuth } from '../_lib/auth-helper.js';
import { inviteSinglePerson } from '../_lib/memberInvite.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
const APP_URL = process.env.FRONTEND_URL || process.env.VERCEL_URL
  ? (process.env.FRONTEND_URL || `https://${process.env.VERCEL_URL}`)
  : 'http://localhost:3000';

const MAX_BATCH = 200;
const STAFF_ROLES = ['admin', 'pastor', 'staff'];

interface InviteResult {
  person_id: string;
  status: 'invited' | 'skipped' | 'error';
  error?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  const auth = await requireClerkAuth(req, { allowedRoles: STAFF_ROLES });
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const personIds = Array.isArray(req.body?.person_ids)
    ? (req.body.person_ids as unknown[]).filter((id): id is string => typeof id === 'string')
    : [];
  if (personIds.length === 0) return res.status(400).json({ error: 'person_ids required' });
  if (personIds.length > MAX_BATCH) {
    return res.status(400).json({ error: `max ${MAX_BATCH} invitations per call` });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const clerk = CLERK_SECRET_KEY ? createClerkClient({ secretKey: CLERK_SECRET_KEY }) : null;

  // Resolve inviting user row (for attribution; best-effort).
  const { data: inviter } = await supabase
    .from('users')
    .select('id')
    .eq('clerk_id', auth.clerkUserId)
    .maybeSingle();

  // Fetch the people, church-scoped.
  const { data: people, error: peopleErr } = await supabase
    .from('people')
    .select('id, church_id, first_name, last_name, email, clerk_user_id')
    .eq('church_id', auth.churchId)
    .in('id', personIds);
  if (peopleErr) return res.status(500).json({ error: 'people_read_failed' });

  const peopleById = new Map((people ?? []).map(p => [p.id as string, p]));
  const results: InviteResult[] = [];

  for (const personId of personIds) {
    const person = peopleById.get(personId);
    if (!person) {
      results.push({ person_id: personId, status: 'error', error: 'not_found_in_church' });
      continue;
    }

    const result = await inviteSinglePerson({
      supabase,
      clerk,
      churchId: auth.churchId,
      person,
      inviterUserId: inviter?.id ?? null,
      appUrl: APP_URL,
    });

    if (result.status === 'error') {
      console.error('[members/invite] failed for', personId, result.error);
      results.push({ person_id: personId, status: 'error', error: result.error });
    } else if (result.status === 'skipped') {
      results.push({ person_id: personId, status: 'skipped', error: result.reason });
    } else {
      results.push({ person_id: personId, status: 'invited' });
    }
  }

  const invited = results.filter(r => r.status === 'invited').length;
  return res.status(200).json({ invited, total: personIds.length, results });
}
