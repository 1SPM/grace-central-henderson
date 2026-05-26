/**
 * Stripe webhook orchestrator.
 *
 * Pipeline for every incoming verified-signature event:
 *
 *   1. claimEvent — atomic insert into webhook_events. Duplicates
 *      exit here with { status: 'duplicate' }.
 *   2. Look up the handler. If none → markSkipped + return.
 *   3. Run the handler inside try/catch.
 *   4. On success → markProcessed.
 *   5. On throw → markFailed + recordFailure (DLQ).
 *
 * The route layer (api/webhooks/stripe.ts and the express equivalent)
 * is responsible for signature verification + body parsing. Everything
 * AFTER signature-verified-event lives here.
 *
 * Always returns a result rather than throwing — the route always
 * returns 200 to Stripe and we own retry via DLQ replay.
 */

import type Stripe from 'stripe';
import type { SupabaseClient } from '@supabase/supabase-js';
import { claimEvent, markProcessed, markFailed, markSkipped } from './idempotency';
import { recordFailure, markResolved } from './dlq';
import { getStripeHandler, extractChurchIdFromEvent } from './stripe-handlers';

export type DispatchOutcome =
  | { status: 'duplicate'; eventRowId: string }
  | { status: 'skipped'; eventRowId: string; reason: string }
  | { status: 'processed'; eventRowId: string; ledgerWritten?: boolean; ledgerDuplicate?: boolean }
  | { status: 'failed'; eventRowId: string; error: string; dlqRowId: string };

export async function dispatchStripeEvent(
  event: Stripe.Event,
  ctx: { supabase: SupabaseClient; stripe: Stripe },
): Promise<DispatchOutcome> {
  const churchId = extractChurchIdFromEvent(event);

  const claim = await claimEvent(ctx.supabase, {
    source: 'stripe',
    sourceEventId: event.id,
    eventType: event.type,
    payload: event,
    churchId,
  });

  if (claim.alreadyProcessed) {
    return { status: 'duplicate', eventRowId: claim.eventRowId };
  }

  const handler = getStripeHandler(event.type);
  if (!handler) {
    const reason = `unhandled event type: ${event.type}`;
    await markSkipped(ctx.supabase, claim.eventRowId, reason);
    return { status: 'skipped', eventRowId: claim.eventRowId, reason };
  }

  try {
    const result = await handler(event, ctx);
    if (result.status === 'skipped') {
      await markSkipped(ctx.supabase, claim.eventRowId, result.reason ?? 'handler skipped');
      return { status: 'skipped', eventRowId: claim.eventRowId, reason: result.reason ?? 'handler skipped' };
    }
    await markProcessed(ctx.supabase, claim.eventRowId);
    return {
      status: 'processed',
      eventRowId: claim.eventRowId,
      ledgerWritten: result.ledgerWritten,
      ledgerDuplicate: result.ledgerDuplicate,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Order matters: write DLQ first (the durable record), THEN flip status
    // on webhook_events. If markFailed throws we still have the DLQ entry.
    let dlqRowId = '';
    try {
      const dlq = await recordFailure(ctx.supabase, {
        webhookEventId: claim.eventRowId,
        source: 'stripe',
        eventType: event.type,
        churchId,
        error: err,
      });
      dlqRowId = dlq.dlqRowId;
    } catch (dlqErr) {
      console.error('[stripe-dispatch] DLQ write failed', dlqErr);
    }
    try {
      await markFailed(ctx.supabase, claim.eventRowId, message);
    } catch (markErr) {
      console.error('[stripe-dispatch] markFailed write failed', markErr);
    }
    return { status: 'failed', eventRowId: claim.eventRowId, error: message, dlqRowId };
  }
}

/**
 * Operator-triggered DLQ replay. Skips the idempotency claim (the
 * webhook_events row already exists from the original delivery) and
 * re-runs the handler. On success, the existing DLQ row is marked
 * resolved.
 *
 * Safety: handlers are designed to be idempotent at the operational
 * level (giving.upsert by stripe_payment_id) AND at the ledger level
 * (UNIQUE(source, source_event_id) → appendLedgerEntry returns
 * { duplicate: true }). A replay that "succeeds" against a previously
 * partial success will not double-write.
 */
export async function replayStripeEvent(
  webhookEventRowId: string,
  ctx: { supabase: SupabaseClient; stripe: Stripe; resolvedByClerkId?: string | null },
): Promise<DispatchOutcome> {
  // Read the original event payload + DLQ link.
  const { data: row, error: readErr } = await ctx.supabase
    .from('webhook_events')
    .select('id, source, event_type, payload, church_id')
    .eq('id', webhookEventRowId)
    .maybeSingle();
  if (readErr || !row) {
    throw new Error(`replay: webhook_events row ${webhookEventRowId} not found`);
  }

  const eventRow = row as { id: string; source: string; event_type: string; payload: Stripe.Event; church_id: string | null };
  if (eventRow.source !== 'stripe') {
    throw new Error(`replay: row ${webhookEventRowId} is from source=${eventRow.source}, expected stripe`);
  }

  const handler = getStripeHandler(eventRow.event_type);
  if (!handler) {
    // Unsupported event types stay skipped — no replay path.
    return { status: 'skipped', eventRowId: eventRow.id, reason: `unhandled event type: ${eventRow.event_type}` };
  }

  try {
    const result = await handler(eventRow.payload, ctx);
    if (result.status === 'skipped') {
      await markSkipped(ctx.supabase, eventRow.id, result.reason ?? 'handler skipped on replay');
      return { status: 'skipped', eventRowId: eventRow.id, reason: result.reason ?? 'handler skipped on replay' };
    }
    await markProcessed(ctx.supabase, eventRow.id);

    // Resolve any unresolved DLQ entries for this event.
    const { data: dlqRows } = await ctx.supabase
      .from('webhook_dlq')
      .select('id')
      .eq('webhook_event_id', eventRow.id)
      .eq('resolved', false);
    for (const dlq of (dlqRows as Array<{ id: string }> | null) ?? []) {
      await markResolved(ctx.supabase, dlq.id, ctx.resolvedByClerkId ?? null, 'replay succeeded');
    }

    return {
      status: 'processed',
      eventRowId: eventRow.id,
      ledgerWritten: result.ledgerWritten,
      ledgerDuplicate: result.ledgerDuplicate,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    let dlqRowId = '';
    try {
      const dlq = await recordFailure(ctx.supabase, {
        webhookEventId: eventRow.id,
        source: 'stripe',
        eventType: eventRow.event_type,
        churchId: eventRow.church_id,
        error: err,
      });
      dlqRowId = dlq.dlqRowId;
    } catch (dlqErr) {
      console.error('[stripe-dispatch.replay] DLQ write failed', dlqErr);
    }
    try {
      await markFailed(ctx.supabase, eventRow.id, message);
    } catch { /* logged */ }
    return { status: 'failed', eventRowId: eventRow.id, error: message, dlqRowId };
  }
}
