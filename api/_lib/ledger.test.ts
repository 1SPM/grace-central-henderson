import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildLedgerRow,
  appendLedgerEntry,
  dollarsToMicroUsd,
  centsToMicroUsd,
} from './ledger.js';

describe('ledger — pure helpers', () => {
  it('dollarsToMicroUsd', () => {
    expect(dollarsToMicroUsd(50)).toBe(50_000_000);
    expect(dollarsToMicroUsd(0.01)).toBe(10_000);
    expect(dollarsToMicroUsd(123.45)).toBe(123_450_000);
  });

  it('centsToMicroUsd', () => {
    expect(centsToMicroUsd(5000)).toBe(50_000_000);
    expect(centsToMicroUsd(1)).toBe(10_000);
  });

  it('buildLedgerRow normalizes Date → ISO string', () => {
    const r = buildLedgerRow({
      churchId: 'c1', source: 'stripe', sourceEventId: 'evt_1',
      kind: 'donation', direction: 'credit',
      amountMicroUsd: 50_000_000,
      occurredAt: new Date('2026-05-25T18:00:00Z'),
    });
    expect(r.occurred_at).toBe('2026-05-25T18:00:00.000Z');
    expect(r.currency).toBe('USD');
    expect(r.metadata).toEqual({});
  });

  it('buildLedgerRow accepts ISO string for occurredAt', () => {
    const r = buildLedgerRow({
      churchId: 'c1', source: 'stripe', sourceEventId: 'evt_2',
      kind: 'donation', direction: 'credit',
      amountMicroUsd: 100,
      occurredAt: '2026-01-01T00:00:00Z',
    });
    expect(r.occurred_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects zero or negative amounts', () => {
    expect(() => buildLedgerRow({
      churchId: 'c1', source: 'stripe', sourceEventId: 'e',
      kind: 'donation', direction: 'credit',
      amountMicroUsd: 0,
      occurredAt: new Date(),
    })).toThrow(/positive integer micro-USD/);

    expect(() => buildLedgerRow({
      churchId: 'c1', source: 'stripe', sourceEventId: 'e',
      kind: 'donation', direction: 'credit',
      amountMicroUsd: -100,
      occurredAt: new Date(),
    })).toThrow();
  });

  it('rejects NaN / Infinity amounts', () => {
    expect(() => buildLedgerRow({
      churchId: 'c1', source: 'stripe', sourceEventId: 'e',
      kind: 'donation', direction: 'credit',
      amountMicroUsd: NaN,
      occurredAt: new Date(),
    })).toThrow();

    expect(() => buildLedgerRow({
      churchId: 'c1', source: 'stripe', sourceEventId: 'e',
      kind: 'donation', direction: 'credit',
      amountMicroUsd: Infinity,
      occurredAt: new Date(),
    })).toThrow();
  });

  it('correction without corrects_entry_id is rejected', () => {
    expect(() => buildLedgerRow({
      churchId: 'c1', source: 'manual', sourceEventId: 'fix-1',
      kind: 'correction', direction: 'debit',
      amountMicroUsd: 1000,
      occurredAt: new Date(),
    })).toThrow(/corrects_entry_id/);
  });

  it('correction WITH corrects_entry_id is accepted', () => {
    const r = buildLedgerRow({
      churchId: 'c1', source: 'manual', sourceEventId: 'fix-1',
      kind: 'correction', direction: 'debit',
      amountMicroUsd: 1000,
      occurredAt: new Date(),
      metadata: { corrects_entry_id: 'uuid-of-original' },
    });
    expect(r.kind).toBe('correction');
    expect(r.metadata.corrects_entry_id).toBe('uuid-of-original');
  });

  it('floors fractional micro-USD amounts (defensive)', () => {
    const r = buildLedgerRow({
      churchId: 'c1', source: 'stripe', sourceEventId: 'e',
      kind: 'fee', direction: 'debit',
      amountMicroUsd: 100.7,
      occurredAt: new Date(),
    });
    expect(r.amount_micro_usd).toBe(100);
  });
});

// ---- DB layer ---------------------------------------------------------

function mockSupabase(opts: {
  insertError?: { code?: string; message?: string } | null;
  insertResultId?: string;
}): SupabaseClient {
  return {
    from: () => ({
      insert: () => ({
        select: () => ({
          single: async () => ({
            data: opts.insertError ? null : { id: opts.insertResultId ?? 'row-1' },
            error: opts.insertError ?? null,
          }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe('ledger — appendLedgerEntry', () => {
  const baseInput = {
    churchId: 'c1', source: 'stripe' as const, sourceEventId: 'evt_x',
    kind: 'donation' as const, direction: 'credit' as const,
    amountMicroUsd: 50_000_000,
    occurredAt: new Date('2026-05-25T00:00:00Z'),
  };

  it('returns { inserted: true } on success', async () => {
    const sb = mockSupabase({ insertResultId: 'row-abc' });
    const r = await appendLedgerEntry(sb, baseInput);
    expect(r).toEqual({ inserted: true, duplicate: false, rowId: 'row-abc' });
  });

  it('returns { duplicate: true } on UNIQUE violation (idempotent re-write)', async () => {
    const sb = mockSupabase({ insertError: { code: '23505', message: 'duplicate key value violates unique constraint' } });
    const r = await appendLedgerEntry(sb, baseInput);
    expect(r).toEqual({ inserted: false, duplicate: true });
  });

  it('detects unique violation by message when code is missing', async () => {
    const sb = mockSupabase({ insertError: { message: 'duplicate key value violates unique constraint "ledger_entries_source_id_key"' } });
    const r = await appendLedgerEntry(sb, baseInput);
    expect(r.duplicate).toBe(true);
  });

  it('throws on any other DB error', async () => {
    const sb = mockSupabase({ insertError: { code: '42P01', message: 'relation does not exist' } });
    await expect(appendLedgerEntry(sb, baseInput)).rejects.toThrow(/ledger insert failed/);
  });

  it('does not call insert at all if buildLedgerRow throws', async () => {
    const insertSpy = vi.fn();
    const sb = { from: () => ({ insert: insertSpy }) } as unknown as SupabaseClient;
    await expect(appendLedgerEntry(sb, { ...baseInput, amountMicroUsd: 0 })).rejects.toThrow();
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
