/**
 * Webhook dead-letter queue.
 *
 * When a handler throws, we record the failure here linked to the
 * webhook_events row, then return 200 to the upstream. We DO NOT
 * rely on Stripe (or any provider) to retry — financial failures
 * need a human in the loop, and provider retry windows are
 * unpredictable.
 *
 * Recovery: an operator UI at /admin/webhooks lists unresolved
 * entries and triggers replay via api/admin/webhooks/replay.
 *
 * Each new failure for the same event_id INCREMENTS attempt_count
 * on the existing row rather than creating duplicates.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export interface RecordFailureInput {
  webhookEventId: string;                   // FK into webhook_events
  source: string;
  eventType: string;
  churchId?: string | null;
  error: unknown;
}

interface DlqRow {
  id: string;
  attempt_count: number;
}

/**
 * Append a failure to the DLQ.
 *
 * - First failure for this event_id  → INSERT new row, attempt_count=1
 * - Subsequent failures (replay loop) → UPDATE existing row, attempt_count+=1
 */
export async function recordFailure(
  supabase: SupabaseClient,
  input: RecordFailureInput,
): Promise<{ dlqRowId: string; attemptCount: number }> {
  const { errorMessage, errorClass, errorStack } = unpackError(input.error);

  // Check for an existing unresolved row for this event.
  const existing = await supabase
    .from('webhook_dlq')
    .select('id, attempt_count')
    .eq('webhook_event_id', input.webhookEventId)
    .eq('resolved', false)
    .maybeSingle();

  if (existing.data) {
    const row = existing.data as DlqRow;
    const nextAttempt = row.attempt_count + 1;
    const { error } = await supabase
      .from('webhook_dlq')
      .update({
        attempt_count: nextAttempt,
        last_attempt_at: new Date().toISOString(),
        error_message: errorMessage,
        error_class: errorClass,
        error_stack: errorStack,
      })
      .eq('id', row.id);
    if (error) throw new Error(`DLQ update failed: ${error.message}`);
    return { dlqRowId: row.id, attemptCount: nextAttempt };
  }

  const insert = await supabase
    .from('webhook_dlq')
    .insert({
      webhook_event_id: input.webhookEventId,
      source: input.source,
      event_type: input.eventType,
      church_id: input.churchId ?? null,
      error_message: errorMessage,
      error_class: errorClass,
      error_stack: errorStack,
      attempt_count: 1,
    })
    .select('id')
    .single();

  if (insert.error || !insert.data) {
    throw new Error(`DLQ insert failed: ${insert.error?.message ?? 'no row returned'}`);
  }

  return { dlqRowId: (insert.data as { id: string }).id, attemptCount: 1 };
}

export async function markResolved(
  supabase: SupabaseClient,
  dlqRowId: string,
  resolvedByClerkId: string | null,
  note?: string,
): Promise<void> {
  const { error } = await supabase
    .from('webhook_dlq')
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by_clerk_id: resolvedByClerkId,
      resolution_note: note ?? null,
    })
    .eq('id', dlqRowId);
  if (error) throw new Error(`DLQ resolve failed: ${error.message}`);
}

// ---- pure helpers (testable) ------------------------------------------

export function unpackError(err: unknown): {
  errorMessage: string;
  errorClass: string | null;
  errorStack: string | null;
} {
  if (err instanceof Error) {
    return {
      errorMessage: (err.message || 'unknown error').slice(0, 2000),
      errorClass: err.constructor?.name ?? 'Error',
      errorStack: err.stack ? err.stack.slice(0, 4000) : null,
    };
  }
  if (typeof err === 'string') {
    return { errorMessage: err.slice(0, 2000), errorClass: null, errorStack: null };
  }
  try {
    return { errorMessage: JSON.stringify(err).slice(0, 2000), errorClass: typeof err, errorStack: null };
  } catch {
    return { errorMessage: 'unserializable error', errorClass: typeof err, errorStack: null };
  }
}
