/**
 * Email outbox helpers. Queue an email + drain the outbox.
 *
 * Idempotency: callers supply a stable key (e.g. "welcome:<church_id>"
 * or "donation_receipt:<payment_intent_id>"). UNIQUE constraint on
 * email_outbox.idempotency_key gives us "queue exactly once" semantics
 * even if the trigger fires multiple times (Stripe webhook retry,
 * double-submit, etc).
 *
 * Send-pattern: queueEmail() inserts the row in 'queued' state. The
 * caller can then optionally try sending inline (sendNow flag). For
 * latency-sensitive paths we just queue + let the drain cron run.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendViaResend, htmlToText } from './resend';

export interface QueueEmailInput {
  supabase: SupabaseClient;
  churchId: string | null;
  toAddr: string;
  fromAddr?: string;
  subject: string;
  templateId: string;
  html: string;
  text?: string;
  idempotencyKey: string;
  metadata?: Record<string, unknown>;
  /** When true, attempt synchronous send right after queueing. Default false. */
  sendNow?: boolean;
}

export interface QueueEmailResult {
  queued: boolean;
  duplicate: boolean;
  sent: boolean;
  outbox_id?: string;
  error?: string;
}

const DEFAULT_FROM = process.env.EMAIL_FROM ?? 'GRACE <noreply@grace-crm.app>';

export async function queueEmail(input: QueueEmailInput): Promise<QueueEmailResult> {
  const { supabase, churchId, toAddr, subject, templateId, html, idempotencyKey } = input;

  // Insert with onConflict='idempotency_key' to surface duplicates.
  const { data: inserted, error: insertErr } = await supabase
    .from('email_outbox')
    .insert({
      church_id: churchId,
      idempotency_key: idempotencyKey,
      to_addr: toAddr,
      from_addr: input.fromAddr ?? DEFAULT_FROM,
      subject,
      template_id: templateId,
      html_body: html,
      text_body: input.text ?? htmlToText(html),
      status: 'queued',
      metadata: input.metadata ?? {},
    })
    .select('id')
    .single();

  if (insertErr) {
    // Postgres unique-violation = 23505. Treat as duplicate, not an error.
    if (insertErr.code === '23505') {
      return { queued: false, duplicate: true, sent: false };
    }
    return { queued: false, duplicate: false, sent: false, error: insertErr.message };
  }
  if (!inserted) {
    return { queued: false, duplicate: false, sent: false, error: 'no row returned from insert' };
  }

  if (!input.sendNow) {
    return { queued: true, duplicate: false, sent: false, outbox_id: inserted.id };
  }

  // Try to send synchronously
  const sendResult = await sendViaResend({
    to: toAddr,
    from: input.fromAddr,
    subject,
    html,
    text: input.text,
  });
  await updateAfterSend(supabase, inserted.id, sendResult);

  return {
    queued: true,
    duplicate: false,
    sent: sendResult.ok,
    outbox_id: inserted.id,
    error: !sendResult.ok && !sendResult.skipped ? sendResult.error : undefined,
  };
}

export async function updateAfterSend(
  supabase: SupabaseClient,
  outboxId: string,
  result: Awaited<ReturnType<typeof sendViaResend>>,
): Promise<void> {
  const now = new Date().toISOString();
  if (result.ok) {
    await supabase
      .from('email_outbox')
      .update({
        status: 'sent',
        sent_at: now,
        provider: result.provider,
        provider_message_id: result.message_id,
      })
      .eq('id', outboxId);
    return;
  }
  if (result.skipped) {
    await supabase
      .from('email_outbox')
      .update({
        status: 'skipped',
        last_error: result.reason,
        attempts: 1,
      })
      .eq('id', outboxId);
    return;
  }
  // Real failure — bump attempts, record error, leave 'queued' so retry can pick it up.
  // After 5 attempts we flip to 'failed' permanently.
  const { data: current } = await supabase
    .from('email_outbox')
    .select('attempts')
    .eq('id', outboxId)
    .single();
  const attempts = (current?.attempts ?? 0) + 1;
  await supabase
    .from('email_outbox')
    .update({
      status: attempts >= 5 ? 'failed' : 'queued',
      last_error: result.error,
      attempts,
      failed_at: attempts >= 5 ? now : null,
    })
    .eq('id', outboxId);
}

/**
 * Drain up to `limit` queued emails. Used by the cron endpoint.
 * Returns { processed, sent, failed, skipped } counts.
 */
export async function drainOutbox(supabase: SupabaseClient, limit = 50): Promise<{
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}> {
  const { data: rows } = await supabase
    .from('email_outbox')
    .select('id, to_addr, from_addr, subject, html_body, text_body')
    .eq('status', 'queued')
    .order('queued_at', { ascending: true })
    .limit(limit);

  let sent = 0, failed = 0, skipped = 0;
  for (const row of (rows ?? []) as Array<{ id: string; to_addr: string; from_addr: string; subject: string; html_body: string; text_body: string | null }>) {
    const result = await sendViaResend({
      to: row.to_addr,
      from: row.from_addr,
      subject: row.subject,
      html: row.html_body,
      text: row.text_body ?? undefined,
    });
    await updateAfterSend(supabase, row.id, result);
    if (result.ok) sent++;
    else if (result.skipped) skipped++;
    else failed++;
  }

  return { processed: rows?.length ?? 0, sent, failed, skipped };
}
