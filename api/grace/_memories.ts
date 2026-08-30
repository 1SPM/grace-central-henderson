/**
 * GET/POST /api/grace/memories — ADR-014 (Memory V1).
 *
 * GET lists the caller's active memories (for a future "what does Grace
 * remember about me" UI — not built in V1, but the read path is cheap to
 * expose now). POST is the one-time localStorage → server import: the
 * client's existing `grace:brain:v1` "remember that…" entries get carried
 * forward as user_stated memories instead of being abandoned, but only
 * when the user has no server memories yet (prevents replay/duplication
 * on every page load).
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { resolveStaffActor } from '../_lib/authz.js';
import { saveMemory } from '../_lib/grace-memory.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const IMPORT_CAP = 50;

interface ImportEntry {
  text: string;
}

function parseImportEntries(raw: unknown): ImportEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e): e is { text: string } => !!e && typeof e === 'object' && typeof (e as { text?: unknown }).text === 'string')
    .slice(0, IMPORT_CAP)
    .map(e => ({ text: e.text.slice(0, 2000) }));
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;

  const { data } = await supabase
    .from('grace_memories')
    .select('id, content, source, created_at')
    .eq('church_id', actor.churchId)
    .eq('user_id', actor.userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(200);

  return res.status(200).json({ memories: data ?? [] });
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_KEY!, { auth: { persistSession: false } });
  const actor = await resolveStaffActor(req, res, supabase);
  if (!actor) return;

  const entries = parseImportEntries((req.body as Record<string, unknown> | undefined)?.entries);
  if (entries.length === 0) {
    return res.status(400).json({ error: 'no_entries' });
  }

  const { count } = await supabase
    .from('grace_memories')
    .select('id', { count: 'exact', head: true })
    .eq('church_id', actor.churchId)
    .eq('user_id', actor.userId);

  if ((count ?? 0) > 0) {
    return res.status(200).json({ imported: 0, skipped: 'already_has_memories' });
  }

  let imported = 0;
  for (const entry of entries) {
    const row = await saveMemory(supabase, {
      churchId: actor.churchId,
      userId: actor.userId,
      content: entry.text,
      source: 'user_stated',
    });
    if (row) imported++;
  }

  return res.status(200).json({ imported });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(503).json({ error: 'service_not_configured' });
  }
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ error: 'method_not_allowed' });
}
