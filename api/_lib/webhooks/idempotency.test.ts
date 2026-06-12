import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { claimEvent, markProcessed, markFailed, markSkipped } from './idempotency.js';

/**
 * Stateful mock: tracks rows + supports UNIQUE(source, source_event_id).
 */
function makeMockSupabase(seed: Array<{ id: string; source: string; source_event_id: string; status: string }> = []) {
  const rows: Array<{ id: string; source: string; source_event_id: string; status: string; updated?: Record<string, unknown> }> =
    seed.map((r) => ({ ...r }));
  let nextId = seed.length + 1;

  const client = {
    from() {
      return {
        // INSERT path
        insert(row: Record<string, unknown>) {
          const exists = rows.find(
            (r) => r.source === row.source && r.source_event_id === row.source_event_id,
          );
          return {
            select() {
              return {
                async single() {
                  if (exists) {
                    // Simulate unique-violation: no data, error
                    return { data: null, error: { code: '23505', message: 'duplicate key' } };
                  }
                  const created = {
                    id: `evt-row-${nextId++}`,
                    source: row.source as string,
                    source_event_id: row.source_event_id as string,
                    status: (row.status as string) ?? 'received',
                  };
                  rows.push(created);
                  return { data: created, error: null };
                },
              };
            },
          };
        },
        // SELECT path
        select() {
          let predSource: string | null = null;
          let predSourceEventId: string | null = null;
          const chain = {
            eq(col: string, val: string) {
              if (col === 'source') predSource = val;
              if (col === 'source_event_id') predSourceEventId = val;
              return chain;
            },
            async maybeSingle() {
              const found = rows.find(
                (r) => r.source === predSource && r.source_event_id === predSourceEventId,
              );
              return { data: found ?? null, error: null };
            },
          };
          return chain;
        },
        // UPDATE path
        update(patch: Record<string, unknown>) {
          return {
            async eq(_col: string, val: string) {
              const idx = rows.findIndex((r) => r.id === val);
              if (idx < 0) return { error: { message: 'row not found' } };
              rows[idx] = { ...rows[idx], ...patch, updated: patch };
              return { error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, rows };
}

describe('webhooks/idempotency — claimEvent', () => {
  it('inserts a new event with status=received on first claim', async () => {
    const { client, rows } = makeMockSupabase();
    const r = await claimEvent(client, {
      source: 'stripe',
      sourceEventId: 'evt_1',
      eventType: 'payment_intent.succeeded',
      payload: { foo: 'bar' },
      churchId: 'c-1',
    });
    expect(r.alreadyProcessed).toBe(false);
    expect(r.status).toBe('received');
    expect(r.eventRowId).toBeTruthy();
    expect(rows).toHaveLength(1);
  });

  it('returns alreadyProcessed=true when same event arrives again', async () => {
    const { client } = makeMockSupabase([
      { id: 'evt-row-99', source: 'stripe', source_event_id: 'evt_dup', status: 'processed' },
    ]);
    const r = await claimEvent(client, {
      source: 'stripe',
      sourceEventId: 'evt_dup',
      eventType: 'payment_intent.succeeded',
      payload: {},
    });
    expect(r.alreadyProcessed).toBe(true);
    expect(r.status).toBe('processed');
    expect(r.eventRowId).toBe('evt-row-99');
  });

  it('distinguishes events by source (same id, different source)', async () => {
    const { client } = makeMockSupabase();
    await claimEvent(client, {
      source: 'stripe', sourceEventId: 'evt_x', eventType: 't', payload: {},
    });
    const r = await claimEvent(client, {
      source: 'i2c', sourceEventId: 'evt_x', eventType: 't', payload: {},
    });
    expect(r.alreadyProcessed).toBe(false);
  });

  it('returns the prior status when re-claiming a failed event', async () => {
    const { client } = makeMockSupabase([
      { id: 'evt-row-77', source: 'stripe', source_event_id: 'evt_failed', status: 'failed' },
    ]);
    const r = await claimEvent(client, {
      source: 'stripe',
      sourceEventId: 'evt_failed',
      eventType: 't',
      payload: {},
    });
    expect(r.alreadyProcessed).toBe(true);
    expect(r.status).toBe('failed');
  });

  it('throws if neither insert nor lookup yields a row', async () => {
    const broken = {
      from: () => ({
        insert: () => ({
          select: () => ({
            single: async () => ({ data: null, error: { code: 'OTHER', message: 'pg down' } }),
          }),
        }),
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: { message: 'pg down' } }) }) }),
        }),
      }),
    } as unknown as SupabaseClient;
    await expect(claimEvent(broken, {
      source: 'stripe', sourceEventId: 'e', eventType: 't', payload: {},
    })).rejects.toThrow(/claimEvent failed/);
  });
});

describe('webhooks/idempotency — markProcessed / markFailed / markSkipped', () => {
  it('markProcessed updates status + processed_at, clears error', async () => {
    const { client, rows } = makeMockSupabase([
      { id: 'r-1', source: 'stripe', source_event_id: 'e', status: 'received' },
    ]);
    await markProcessed(client, 'r-1');
    expect(rows[0].status).toBe('processed');
    expect((rows[0] as { processed_at?: string }).processed_at).toBeTruthy();
    expect((rows[0] as { processing_error?: string | null }).processing_error).toBeNull();
  });

  it('markFailed stores error_message (truncated to 2000 chars)', async () => {
    const { client, rows } = makeMockSupabase([
      { id: 'r-1', source: 'stripe', source_event_id: 'e', status: 'received' },
    ]);
    const longErr = 'x'.repeat(5000);
    await markFailed(client, 'r-1', longErr);
    expect(rows[0].status).toBe('failed');
    expect((rows[0] as { processing_error?: string }).processing_error?.length).toBe(2000);
  });

  it('markSkipped records the reason', async () => {
    const { client, rows } = makeMockSupabase([
      { id: 'r-1', source: 'stripe', source_event_id: 'e', status: 'received' },
    ]);
    await markSkipped(client, 'r-1', 'unsupported event type');
    expect(rows[0].status).toBe('skipped');
    expect((rows[0] as { processing_error?: string }).processing_error).toBe('unsupported event type');
  });

  it('throws on DB error', async () => {
    const broken = {
      from: () => ({
        update: () => ({ eq: async () => ({ error: { message: 'denied' } }) }),
      }),
    } as unknown as SupabaseClient;
    await expect(markProcessed(broken, 'nope')).rejects.toThrow();
  });
});
