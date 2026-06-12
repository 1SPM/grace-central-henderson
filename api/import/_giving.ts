/**
 * POST /api/import/giving
 *
 * Batched giving insert. Client parses + validates the CSV; sends
 * clean JSON batches here. Each row carries the donor_email so we
 * can match to people.id server-side.
 *
 * Matching logic:
 *   1. If donor_email is set AND matches an existing people row in
 *      this church → person_id = that row's id.
 *   2. If donor_email is set but no match → person_id = NULL, the
 *      gift imports as "unmatched". We track these in the response so
 *      the operator can create the people rows and re-link later.
 *   3. If donor_email is null (anonymous) → person_id = NULL.
 *
 * Body:
 *   {
 *     batch: ValidatedGivingRow[] (max 200),
 *   }
 *
 * Response:
 *   {
 *     inserted: count,
 *     matched: count,
 *     unmatched: count,            // imported but no person_id
 *     errors: Array<{row_index, message}>,
 *     unmatched_emails: string[],  // distinct emails not found
 *   }
 *
 * Auth: Clerk JWT. church_id from publicMetadata.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { requireClerkAuth } from '../_lib/auth-helper.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const MAX_BATCH = 200;

interface IncomingRow {
  donor_email: string | null;
  donor_name: string | null;
  amount_cents: number;
  date: string;
  fund: string | null;
  method: string | null;
  note: string | null;
  check_number: string | null;
}

function isIncomingRow(v: unknown): v is IncomingRow {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    (r.donor_email === null || typeof r.donor_email === 'string')
    && typeof r.amount_cents === 'number'
    && Number.isFinite(r.amount_cents)
    && typeof r.date === 'string'
    && /^\d{4}-\d{2}-\d{2}$/.test(r.date)
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'service_not_configured' });

  const auth = await requireClerkAuth(req);
  if (!auth.ok) return res.status(auth.status).json({ error: auth.error });

  const body = (req.body ?? {}) as { batch?: unknown };
  if (!Array.isArray(body.batch)) {
    return res.status(400).json({ error: 'invalid_body', detail: 'batch must be an array' });
  }
  if (body.batch.length === 0) return res.status(400).json({ error: 'empty_batch' });
  if (body.batch.length > MAX_BATCH) {
    return res.status(413).json({ error: 'batch_too_large', detail: `max ${MAX_BATCH} rows per batch` });
  }

  const rows: IncomingRow[] = [];
  const inputErrors: Array<{ row_index: number; message: string }> = [];
  for (let i = 0; i < body.batch.length; i++) {
    if (!isIncomingRow(body.batch[i])) {
      inputErrors.push({ row_index: i, message: 'malformed row — required fields missing or wrong type' });
      continue;
    }
    rows.push(body.batch[i] as IncomingRow);
  }
  if (rows.length === 0) {
    return res.status(400).json({ error: 'no_valid_rows', errors: inputErrors });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Pre-fetch all matching people by email in ONE query — much faster
  // than per-row lookups (1 round-trip vs N).
  const emailsToMatch = Array.from(new Set(rows.map((r) => r.donor_email).filter((e): e is string => !!e)));
  const personByEmail = new Map<string, string>();
  if (emailsToMatch.length > 0) {
    const { data: people } = await supabase
      .from('people')
      .select('id, email')
      .eq('church_id', auth.churchId)
      .in('email', emailsToMatch);
    for (const p of (people ?? []) as Array<{ id: string; email: string | null }>) {
      if (p.email) personByEmail.set(p.email.toLowerCase(), p.id);
    }
  }

  // Build insert payload
  let matched = 0;
  let unmatched = 0;
  const unmatchedEmails = new Set<string>();
  const inserts = rows.map((r) => {
    const personId = r.donor_email ? personByEmail.get(r.donor_email.toLowerCase()) : undefined;
    if (r.donor_email && !personId) {
      unmatched++;
      unmatchedEmails.add(r.donor_email);
    } else if (personId) {
      matched++;
    }
    // The giving table stores amount as numeric dollars (per existing
    // schema) — convert from cents.
    const noteParts: string[] = [];
    if (r.note) noteParts.push(r.note);
    if (r.donor_name && !personId) noteParts.push(`Donor (unmatched): ${r.donor_name}`);
    if (r.check_number) noteParts.push(`Check #${r.check_number}`);

    return {
      church_id: auth.churchId,
      person_id: personId ?? null,
      amount: r.amount_cents / 100,
      fund: r.fund ?? 'general',
      date: r.date,
      method: r.method ?? 'cash',
      is_recurring: false,
      note: noteParts.length > 0 ? noteParts.join(' · ') : null,
    };
  });

  const { data: inserted, error: insErr } = await supabase
    .from('giving')
    .insert(inserts)
    .select('id');

  if (insErr) {
    return res.status(500).json({ error: 'insert_failed', detail: insErr.message });
  }

  return res.status(200).json({
    inserted: inserted?.length ?? 0,
    matched,
    unmatched,
    unmatched_emails: Array.from(unmatchedEmails),
    errors: inputErrors,
  });
}
