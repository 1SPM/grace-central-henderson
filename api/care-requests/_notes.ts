/**
 * /api/care-requests/notes
 *
 *   GET  ?care_request_id= — internal notes for a care request. Also
 *        doubles as the follow-up record (each note is timestamped and
 *        attributed).
 *   POST — add an internal note.
 *
 * care.manage ONLY — stricter than the care.view read gate on the care
 * request itself. A read-only auditor-style care.view holder (if one is
 * ever granted) sees the request but never internal notes.
 *
 * Auth: Clerk Bearer (or demo bootstrap), care.manage.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requirePermission } from '../_lib/authz.js';
import { recordAudit } from '../_lib/workosAudit.js';
import { readBody, str, uuid_ } from '../_lib/validation.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const CREATE_SCHEMA = {
  care_request_id: uuid_({ required: true }),
  note: str({ required: true, min: 1, max: 4000 }),
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const actor = await requirePermission(req, res, supabase, 'care.manage');
  if (!actor) return;

  if (req.method === 'GET') {
    const careRequestId = typeof req.query.care_request_id === 'string' ? req.query.care_request_id : undefined;
    if (!careRequestId) return res.status(400).json({ error: 'missing_care_request_id' });

    const { data, error } = await supabase
      .from('care_request_notes')
      .select('id, note, author_user_id, created_at')
      .eq('care_request_id', careRequestId)
      .eq('church_id', actor.churchId)
      .order('created_at', { ascending: true });
    if (error) return res.status(500).json({ error: 'read_failed' });
    return res.status(200).json({ notes: data ?? [] });
  }

  if (req.method === 'POST') {
    const body = readBody(req, res, CREATE_SCHEMA);
    if (!body) return;

    const { data: careRequest } = await supabase
      .from('care_requests')
      .select('id')
      .eq('id', body.care_request_id)
      .eq('church_id', actor.churchId)
      .maybeSingle();
    if (!careRequest) return res.status(404).json({ error: 'care_request_not_found' });

    const { data: note, error } = await supabase
      .from('care_request_notes')
      .insert({
        care_request_id: body.care_request_id,
        church_id: actor.churchId,
        author_user_id: actor.userId,
        note: body.note,
      })
      .select()
      .single();
    if (error || !note) return res.status(500).json({ error: 'create_failed' });

    await recordAudit(supabase, {
      churchId: actor.churchId,
      actorUserId: actor.userId,
      actorClerkId: actor.clerkUserId,
      action: 'create',
      entityType: 'care_request_note',
      entityId: note.id,
      after: { care_request_id: body.care_request_id },
      route: '/api/care-requests/notes',
      method: 'POST',
    });

    return res.status(201).json({ note });
  }

  return res.status(405).json({ error: 'method_not_allowed' });
}
