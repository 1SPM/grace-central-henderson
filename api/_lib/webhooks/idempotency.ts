/**
 * Webhook idempotency tracker.
 *
 * Every inbound webhook call goes through `claimEvent` before its
 * handler runs. The first claim for a (source, source_event_id) pair
 * inserts a webhook_events row with status='received'; subsequent
 * claims hit the UNIQUE constraint and return `alreadyProcessed:
 * true` so the caller can return 200 without doing any work.
 *
 * After the handler completes, `markProcessed` or `markFailed` sets
 * the terminal status + processed_at + processing_error (if failed).
 *
 * The whole flow is structured so a webhook re-delivery from Stripe
 * (which happens — Stripe retries on any non-2xx, and on its own
 * judgement) is a no-op past the dedup check. No accidental double
 * ledger entries.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type WebhookStatus = 'received' | 'processed' | 'failed' | 'skipped';

export interface ClaimEventInput {
  source: string;                           // 'stripe' | 'i2c' | ...
  sourceEventId: string;                    // 'evt_...' from Stripe
  eventType: string;                        // 'payment_intent.succeeded'
  payload: unknown;                         // full event body
  churchId?: string | null;                 // pulled from event metadata if present
}

export interface ClaimEventResult {
  /** True when this event was already processed before; caller should return 200 immediately. */
  alreadyProcessed: boolean;
  /** Status of the existing row when alreadyProcessed=true; otherwise 'received'. */
  status: WebhookStatus;
  /** webhook_events.id — needed for markProcessed/markFailed + DLQ linkage. */
  eventRowId: string;
}

interface WebhookEventRow {
  id: string;
  status: WebhookStatus;
}

/**
 * Atomically attempt to claim ownership of this webhook event.
 *
 * Implementation: INSERT ... ON CONFLICT DO NOTHING + a follow-up
 * SELECT. We can't use RETURNING here because Postgres + PostgREST
 * surface the conflict as "no rows returned" rather than a clean
 * error, and we need the row id either way.
 */
export async function claimEvent(
  supabase: SupabaseClient,
  input: ClaimEventInput,
): Promise<ClaimEventResult> {
  // First try the insert. If a row exists for this (source, source_event_id),
  // the UNIQUE constraint kicks in and `error` will be set.
  const insertResult = await supabase
    .from('webhook_events')
    .insert({
      source: input.source,
      source_event_id: input.sourceEventId,
      event_type: input.eventType,
      payload: input.payload,
      church_id: input.churchId ?? null,
      status: 'received' as WebhookStatus,
    })
    .select('id, status')
    .single();

  if (!insertResult.error && insertResult.data) {
    const row = insertResult.data as WebhookEventRow;
    return { alreadyProcessed: false, status: row.status, eventRowId: row.id };
  }

  // Either a real error or the unique-violation. Look up the existing row.
  const lookup = await supabase
    .from('webhook_events')
    .select('id, status')
    .eq('source', input.source)
    .eq('source_event_id', input.sourceEventId)
    .maybeSingle();

  if (lookup.error || !lookup.data) {
    // Something else broke. Re-raise so the caller returns 500 and Stripe retries.
    throw new Error(
      `claimEvent failed: insert error=${insertResult.error?.message ?? 'unknown'}; lookup error=${lookup.error?.message ?? 'no row'}`,
    );
  }

  const row = lookup.data as WebhookEventRow;
  return {
    alreadyProcessed: true,
    status: row.status,
    eventRowId: row.id,
  };
}

export async function markProcessed(
  supabase: SupabaseClient,
  eventRowId: string,
): Promise<void> {
  const { error } = await supabase
    .from('webhook_events')
    .update({
      status: 'processed' as WebhookStatus,
      processed_at: new Date().toISOString(),
      processing_error: null,
    })
    .eq('id', eventRowId);
  if (error) {
    throw new Error(`markProcessed failed: ${error.message}`);
  }
}

export async function markFailed(
  supabase: SupabaseClient,
  eventRowId: string,
  errorMessage: string,
): Promise<void> {
  const { error } = await supabase
    .from('webhook_events')
    .update({
      status: 'failed' as WebhookStatus,
      processed_at: new Date().toISOString(),
      processing_error: errorMessage.slice(0, 2000),
    })
    .eq('id', eventRowId);
  if (error) {
    throw new Error(`markFailed failed: ${error.message}`);
  }
}

export async function markSkipped(
  supabase: SupabaseClient,
  eventRowId: string,
  reason: string,
): Promise<void> {
  const { error } = await supabase
    .from('webhook_events')
    .update({
      status: 'skipped' as WebhookStatus,
      processed_at: new Date().toISOString(),
      processing_error: reason.slice(0, 2000),
    })
    .eq('id', eventRowId);
  if (error) {
    throw new Error(`markSkipped failed: ${error.message}`);
  }
}
