/**
 * Append-only ledger writer.
 *
 * This is the ONLY way code anywhere in the app should write a row to
 * `ledger_entries`. The schema's append-only trigger blocks
 * UPDATE/DELETE structurally; this module enforces the input shape +
 * supplies sensible defaults.
 *
 * Money is integer micro-USD throughout. Convert at the boundary:
 *
 *   Stripe `amount` (cents)  → multiply by 10_000
 *   Stripe `amount` (dollars) → multiply by 1_000_000
 *
 * Corrections (mistakes are reversed by writing a new entry, not by
 * editing) MUST set kind='correction' and metadata.corrects_entry_id.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

export type LedgerSource = 'stripe' | 'i2c' | 'manual' | 'reconciliation';
export type LedgerKind =
  | 'donation'      // gift received
  | 'refund'        // gift returned
  | 'fee'           // processor fee (Stripe, i2c, etc)
  | 'payout'        // money out to church bank
  | 'transfer'      // movement between internal accounts
  | 'adjustment'    // operator-initiated, non-correcting
  | 'correction';   // reverses a prior entry (metadata.corrects_entry_id required)
export type LedgerDirection = 'credit' | 'debit';

export interface LedgerEntryInput {
  churchId: string;
  source: LedgerSource;
  sourceEventId: string;
  kind: LedgerKind;
  direction: LedgerDirection;
  amountMicroUsd: number;                 // MUST be > 0
  currency?: string;                      // default 'USD'
  description?: string;
  relatedGivingId?: string | null;
  relatedPersonId?: string | null;
  occurredAt: Date | string;
  metadata?: Record<string, unknown>;
}

interface LedgerEntryRow {
  church_id: string;
  source: LedgerSource;
  source_event_id: string;
  kind: LedgerKind;
  direction: LedgerDirection;
  amount_micro_usd: number;
  currency: string;
  description: string | null;
  related_giving_id: string | null;
  related_person_id: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
}

// ---- pure helpers ------------------------------------------------------

export function dollarsToMicroUsd(dollars: number): number {
  return Math.round(dollars * 1_000_000);
}

export function centsToMicroUsd(cents: number): number {
  return Math.round(cents * 10_000);
}

export function buildLedgerRow(input: LedgerEntryInput): LedgerEntryRow {
  if (!Number.isFinite(input.amountMicroUsd) || input.amountMicroUsd <= 0) {
    throw new Error(`ledger amount must be a positive integer micro-USD; got ${input.amountMicroUsd}`);
  }
  if (input.kind === 'correction' && !input.metadata?.corrects_entry_id) {
    throw new Error('ledger correction requires metadata.corrects_entry_id');
  }
  const occurredAt = input.occurredAt instanceof Date
    ? input.occurredAt.toISOString()
    : new Date(input.occurredAt).toISOString();

  return {
    church_id: input.churchId,
    source: input.source,
    source_event_id: input.sourceEventId,
    kind: input.kind,
    direction: input.direction,
    amount_micro_usd: Math.floor(input.amountMicroUsd),
    currency: input.currency ?? 'USD',
    description: input.description ?? null,
    related_giving_id: input.relatedGivingId ?? null,
    related_person_id: input.relatedPersonId ?? null,
    occurred_at: occurredAt,
    metadata: input.metadata ?? {},
  };
}

// ---- DB layer ----------------------------------------------------------

export interface AppendResult {
  inserted: boolean;
  /** True when (source, source_event_id) already existed — defense-in-depth dedup. */
  duplicate: boolean;
  rowId?: string;
}

export async function appendLedgerEntry(
  supabase: SupabaseClient,
  input: LedgerEntryInput,
): Promise<AppendResult> {
  const row = buildLedgerRow(input);

  const result = await supabase
    .from('ledger_entries')
    .insert(row)
    .select('id')
    .single();

  if (!result.error && result.data) {
    return { inserted: true, duplicate: false, rowId: (result.data as { id: string }).id };
  }

  // Unique constraint violation = idempotent re-write of the same event.
  // We treat this as success (the row exists; that's what the caller wanted).
  // Postgres error code 23505 = unique_violation.
  const isUniqueViolation =
    (result.error as { code?: string })?.code === '23505' ||
    /duplicate key value/i.test(result.error?.message ?? '');

  if (isUniqueViolation) {
    return { inserted: false, duplicate: true };
  }

  throw new Error(
    `ledger insert failed: ${result.error?.message ?? 'unknown'} (source=${input.source} id=${input.sourceEventId})`,
  );
}
