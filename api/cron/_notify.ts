/**
 * Digest fan-out cron.
 *
 * Scheduled every 15 minutes in vercel.json. Reads platform_events since
 * notification_cursors['notify'], groups them per-user by category via
 * api/_lib/notificationDigest.ts (email channel only — crisis alerts are
 * synchronous, see api/portal/_care.ts, and never appear here since
 * groupEventsForDigest always excludes the 'crisis' category), sends one
 * summarized email per user, and advances the cursor only if every send
 * in this batch succeeded. A partial failure leaves the cursor where it
 * was — the next run re-processes the same window, so an already-sent
 * user may get a duplicate digest, which is far preferable to silently
 * dropping a real event.
 *
 * Auth: x-vercel-cron header OR Bearer CRON_SECRET, same pattern as
 * api/cron/_agents.ts.
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { groupEventsForDigest, type DigestEvent, type NotificationPref } from '../_lib/notificationDigest.js';
import { sendViaResend } from '../_lib/email/resend.js';
import { recordCronRun } from '../_lib/cron-runs.js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const CURSOR_JOB = 'notify';
const MAX_EVENTS_PER_RUN = 2000;

function isAuthorized(req: VercelRequest): boolean {
  if (req.headers['x-vercel-cron']) return true;
  const auth = req.headers.authorization;
  if (CRON_SECRET && auth === `Bearer ${CRON_SECRET}`) return true;
  return false;
}

function buildDigestEmail(events: DigestEvent[]): { subject: string; html: string } {
  const byCategory = new Map<string, number>();
  for (const e of events) {
    const key = e.event_type.split('.')[0];
    byCategory.set(key, (byCategory.get(key) ?? 0) + 1);
  }
  const lines = Array.from(byCategory.entries())
    .map(([kind, count]) => `<li>${count} ${kind} update${count === 1 ? '' : 's'}</li>`)
    .join('');
  return {
    subject: `GRACE: ${events.length} update${events.length === 1 ? '' : 's'} awaiting your review`,
    html: `<p>Here's what's happened since your last digest:</p><ul>${lines}</ul><p>Open GRACE WorkOS to review.</p>`,
  };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'unauthorized' });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return res.status(503).json({ error: 'supabase not configured' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });
  const startedAt = new Date();

  const { data: cursorRow } = await supabase
    .from('notification_cursors')
    .select('last_event_created_at')
    .eq('job', CURSOR_JOB)
    .maybeSingle();
  const since = (cursorRow as { last_event_created_at?: string } | null)?.last_event_created_at
    ?? new Date(startedAt.getTime() - 15 * 60_000).toISOString();

  const { data: eventRows, error: eventsError } = await supabase
    .from('platform_events')
    .select('id, church_id, event_type, created_at')
    .gt('created_at', since)
    .order('created_at', { ascending: true })
    .limit(MAX_EVENTS_PER_RUN);
  if (eventsError) {
    await recordCronRun(supabase, 'notify', { ok: false, durationMs: Date.now() - startedAt.getTime(), summary: { error: 'events_read_failed' } });
    return res.status(500).json({ error: 'events_read_failed' });
  }
  const events = (eventRows ?? []) as DigestEvent[];

  if (events.length === 0) {
    await recordCronRun(supabase, 'notify', { ok: true, durationMs: Date.now() - startedAt.getTime(), summary: { events_processed: 0, recipients: 0 } });
    return res.status(200).json({ ok: true, events_processed: 0, recipients: 0 });
  }

  const { data: prefRows, error: prefsError } = await supabase
    .from('staff_notification_prefs')
    .select('user_id, church_id, category, channel, enabled, users(email)')
    .eq('channel', 'email')
    .eq('enabled', true);
  if (prefsError) {
    await recordCronRun(supabase, 'notify', { ok: false, durationMs: Date.now() - startedAt.getTime(), summary: { error: 'prefs_read_failed' } });
    return res.status(500).json({ error: 'prefs_read_failed' });
  }
  const prefs = (prefRows ?? []) as unknown as Array<NotificationPref & { users: { email: string } | null }>;
  const emailByUser = new Map(prefs.map(p => [p.user_id, p.users?.email]));

  const recipients = groupEventsForDigest(events, prefs);

  let sent = 0;
  let failed = 0;
  for (const recipient of recipients) {
    const email = emailByUser.get(recipient.user_id);
    if (!email) { failed += 1; continue; }
    const { subject, html } = buildDigestEmail(recipient.events);
    const result = await sendViaResend({ to: email, subject, html });
    if (result.ok) sent += 1;
    else failed += 1;
  }

  const maxEventCreatedAt = events[events.length - 1].created_at;
  if (failed === 0) {
    await supabase.from('notification_cursors').upsert({ job: CURSOR_JOB, last_event_created_at: maxEventCreatedAt }, { onConflict: 'job' });
  }

  await recordCronRun(supabase, 'notify', {
    ok: failed === 0,
    durationMs: Date.now() - startedAt.getTime(),
    summary: { events_processed: events.length, recipients: recipients.length, sent, failed, cursor_advanced: failed === 0 },
  });

  return res.status(200).json({ ok: failed === 0, events_processed: events.length, recipients: recipients.length, sent, failed });
}
