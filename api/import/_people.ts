/**
 * POST /api/import/people
 *
 * Batched people insert for the CSV import wizard. Client parses +
 * validates rows in the browser, sends batches of clean JSON here.
 *
 * Request body:
 *   {
 *     batch: Array of validated row objects (max 200/batch),
 *     dedupe_by_email: boolean (default true) — when true, an existing
 *                      person with the same email is updated rather
 *                      than duplicated
 *   }
 *
 * Response:
 *   {
 *     inserted: count,
 *     updated: count,
 *     errors: Array<{ row_index, message }>,
 *     person_ids: Array of inserted person UUIDs (in row order, null on error)
 *   }
 *
 * Auth: Clerk JWT required. We resolve church_id from the user's
 * publicMetadata — there's no body church_id (it would be an IDOR
 * vector on a bulk endpoint).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { createClerkClient, verifyToken } from '@clerk/backend';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

const MAX_BATCH = 200;

interface IncomingRow {
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  birth_date: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  status: string | null;
  join_date: string | null;
  notes: string | null;
}

function isIncomingRow(v: unknown): v is IncomingRow {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return typeof r.first_name === 'string' && typeof r.last_name === 'string';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' });
  }
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !CLERK_SECRET_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }

  // Auth
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'auth_required' });

  let payload: { sub?: string };
  try {
    payload = await verifyToken(token, { secretKey: CLERK_SECRET_KEY });
  } catch {
    return res.status(401).json({ error: 'invalid_token' });
  }
  const clerkUserId = payload.sub;
  if (!clerkUserId) return res.status(401).json({ error: 'invalid_token' });

  const clerk = createClerkClient({ secretKey: CLERK_SECRET_KEY });
  const user = await clerk.users.getUser(clerkUserId);
  const churchId = (user.publicMetadata?.church_id as string | undefined)
                ?? (user.privateMetadata?.church_id as string | undefined);
  if (!churchId) {
    return res.status(403).json({ error: 'no_church', detail: 'User has no church_id in metadata' });
  }

  // Body parsing
  const body = (req.body ?? {}) as { batch?: unknown; dedupe_by_email?: unknown };
  if (!Array.isArray(body.batch)) {
    return res.status(400).json({ error: 'invalid_body', detail: 'batch must be an array' });
  }
  if (body.batch.length === 0) {
    return res.status(400).json({ error: 'empty_batch' });
  }
  if (body.batch.length > MAX_BATCH) {
    return res.status(413).json({ error: 'batch_too_large', detail: `max ${MAX_BATCH} rows per batch` });
  }
  const dedupeByEmail = body.dedupe_by_email !== false;

  const rows: IncomingRow[] = [];
  const inputErrors: Array<{ row_index: number; message: string }> = [];
  for (let i = 0; i < body.batch.length; i++) {
    const r = body.batch[i];
    if (!isIncomingRow(r)) {
      inputErrors.push({ row_index: i, message: 'malformed row — first_name and last_name required as strings' });
      continue;
    }
    rows.push(r);
  }
  if (rows.length === 0) {
    return res.status(400).json({ error: 'no_valid_rows', errors: inputErrors });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // If dedupe_by_email, query existing emails in one shot before insert
  const emailsToCheck = rows.map((r) => r.email).filter((e): e is string => !!e);
  const existingByEmail = new Map<string, string>();
  if (dedupeByEmail && emailsToCheck.length > 0) {
    const { data: existing } = await supabase
      .from('people')
      .select('id, email')
      .eq('church_id', churchId)
      .in('email', emailsToCheck);
    for (const p of (existing ?? []) as Array<{ id: string; email: string }>) {
      if (p.email) existingByEmail.set(p.email.toLowerCase(), p.id);
    }
  }

  // Split rows into INSERT and UPDATE buckets
  const toInsert: Array<IncomingRow & { church_id: string }> = [];
  const toUpdate: Array<{ id: string; row: IncomingRow }> = [];

  for (const row of rows) {
    const existingId = row.email ? existingByEmail.get(row.email) : undefined;
    if (existingId && dedupeByEmail) {
      toUpdate.push({ id: existingId, row });
    } else {
      toInsert.push({ ...row, church_id: churchId });
    }
  }

  const errors: Array<{ row_index: number; message: string }> = [...inputErrors];
  let insertedCount = 0;
  let updatedCount = 0;
  const personIds: (string | null)[] = new Array(rows.length).fill(null);

  // INSERT batch
  if (toInsert.length > 0) {
    const { data: inserted, error: insErr } = await supabase
      .from('people')
      .insert(toInsert)
      .select('id, email, first_name, last_name');
    if (insErr) {
      return res.status(500).json({ error: 'insert_failed', detail: insErr.message });
    }
    insertedCount = inserted?.length ?? 0;

    // Map ids back to original positions via email or name fallback
    const insertedMap = new Map<string, string>();
    for (const p of (inserted ?? []) as Array<{ id: string; email: string | null; first_name: string; last_name: string }>) {
      const key = p.email
        ? `email:${p.email.toLowerCase()}`
        : `name:${p.first_name}|${p.last_name}`;
      insertedMap.set(key, p.id);
    }
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const key = r.email ? `email:${r.email}` : `name:${r.first_name}|${r.last_name}`;
      personIds[i] = insertedMap.get(key) ?? null;
    }
  }

  // UPDATE batch — one query per person (Supabase doesn't support bulk update of different rows in one call)
  // For up to MAX_BATCH=200 this stays under a few seconds; if it gets slow we'll move to an RPC.
  for (const { id, row } of toUpdate) {
    const updatePayload: Partial<IncomingRow> = {};
    if (row.phone !== null) updatePayload.phone = row.phone;
    if (row.birth_date !== null) updatePayload.birth_date = row.birth_date;
    if (row.address !== null) updatePayload.address = row.address;
    if (row.city !== null) updatePayload.city = row.city;
    if (row.state !== null) updatePayload.state = row.state;
    if (row.zip !== null) updatePayload.zip = row.zip;
    if (row.notes !== null) updatePayload.notes = row.notes;
    if (row.status !== null) updatePayload.status = row.status;
    if (row.join_date !== null) updatePayload.join_date = row.join_date;
    // Do NOT update name fields on existing rows — operator may have edited them in-app.

    const { error: updErr } = await supabase
      .from('people')
      .update(updatePayload)
      .eq('id', id)
      .eq('church_id', churchId);
    if (updErr) {
      const idx = rows.findIndex((r) => r.email && r.email.toLowerCase() === existingByEmail.get(r.email.toLowerCase()) && rows.indexOf(r) >= 0);
      errors.push({ row_index: idx >= 0 ? idx : -1, message: `update failed: ${updErr.message}` });
    } else {
      updatedCount++;
      const idx = rows.findIndex((r) => r.email?.toLowerCase() === Array.from(existingByEmail.keys()).find((e) => existingByEmail.get(e) === id));
      if (idx >= 0) personIds[idx] = id;
    }
  }

  return res.status(200).json({
    inserted: insertedCount,
    updated: updatedCount,
    errors,
    person_ids: personIds,
  });
}
