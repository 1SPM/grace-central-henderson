import { describe, it, expect } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { unpackError, recordFailure, markResolved } from './dlq';

describe('webhooks/dlq — unpackError', () => {
  it('handles Error instance with message + stack + class', () => {
    const err = new TypeError('boom');
    const r = unpackError(err);
    expect(r.errorMessage).toBe('boom');
    expect(r.errorClass).toBe('TypeError');
    expect(r.errorStack).toBeTruthy();
  });

  it('truncates message to 2000 chars', () => {
    const r = unpackError(new Error('x'.repeat(5000)));
    expect(r.errorMessage.length).toBe(2000);
  });

  it('truncates stack to 4000 chars', () => {
    const err = new Error('short');
    err.stack = 'y'.repeat(10_000);
    const r = unpackError(err);
    expect(r.errorStack?.length).toBe(4000);
  });

  it('handles string errors', () => {
    const r = unpackError('something broke');
    expect(r.errorMessage).toBe('something broke');
    expect(r.errorClass).toBeNull();
    expect(r.errorStack).toBeNull();
  });

  it('handles objects via JSON.stringify', () => {
    const r = unpackError({ code: 500, detail: 'nope' });
    expect(r.errorMessage).toContain('"code":500');
    expect(r.errorClass).toBe('object');
  });

  it('gracefully degrades on circular objects', () => {
    const obj: { self?: unknown } = {};
    obj.self = obj;
    const r = unpackError(obj);
    expect(r.errorMessage).toBe('unserializable error');
  });
});

// ---- DB layer ---------------------------------------------------------

function makeMockSupabase(seed: Array<{ id: string; webhook_event_id: string; attempt_count: number; resolved: boolean }> = []) {
  const rows: Array<Record<string, unknown>> = seed.map((r) => ({ ...r }));
  let nextId = seed.length + 1;
  const log: Array<{ op: string; args: unknown }> = [];

  const client = {
    from() {
      return {
        // SELECT path
        select() {
          let predEventId: string | null = null;
          let predResolved: boolean | null = null;
          const chain = {
            eq(col: string, val: unknown) {
              if (col === 'webhook_event_id') predEventId = val as string;
              if (col === 'resolved') predResolved = val as boolean;
              return chain;
            },
            async maybeSingle() {
              const found = rows.find(
                (r) => r.webhook_event_id === predEventId && r.resolved === predResolved,
              );
              return { data: found ?? null, error: null };
            },
          };
          return chain;
        },
        insert(row: Record<string, unknown>) {
          return {
            select() {
              return {
                async single() {
                  const created = { id: `dlq-${nextId++}`, ...row };
                  rows.push(created);
                  log.push({ op: 'insert', args: created });
                  return { data: created, error: null };
                },
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            async eq(_col: string, val: string) {
              const idx = rows.findIndex((r) => r.id === val);
              if (idx < 0) return { error: { message: 'not found' } };
              rows[idx] = { ...rows[idx], ...patch };
              log.push({ op: 'update', args: patch });
              return { error: null };
            },
          };
        },
      };
    },
  } as unknown as SupabaseClient;

  return { client, rows, log };
}

describe('webhooks/dlq — recordFailure', () => {
  it('inserts a new row on first failure', async () => {
    const { client, rows } = makeMockSupabase();
    const r = await recordFailure(client, {
      webhookEventId: 'evt-row-1',
      source: 'stripe',
      eventType: 'payment_intent.succeeded',
      churchId: 'c-1',
      error: new Error('downstream 500'),
    });
    expect(r.attemptCount).toBe(1);
    expect(rows).toHaveLength(1);
    expect(rows[0].attempt_count).toBe(1);
    expect(rows[0].error_message).toBe('downstream 500');
  });

  it('UPDATES existing unresolved row and increments attempt_count', async () => {
    const { client, rows } = makeMockSupabase([
      { id: 'dlq-existing', webhook_event_id: 'evt-row-2', attempt_count: 1, resolved: false },
    ]);
    const r = await recordFailure(client, {
      webhookEventId: 'evt-row-2',
      source: 'stripe',
      eventType: 'payment_intent.succeeded',
      error: new Error('still broken'),
    });
    expect(r.attemptCount).toBe(2);
    expect(r.dlqRowId).toBe('dlq-existing');
    expect(rows).toHaveLength(1);   // no new row
    expect(rows[0].attempt_count).toBe(2);
  });

  it('inserts a NEW row when prior failure was already resolved', async () => {
    const { client, rows } = makeMockSupabase([
      { id: 'dlq-old', webhook_event_id: 'evt-row-3', attempt_count: 5, resolved: true },
    ]);
    await recordFailure(client, {
      webhookEventId: 'evt-row-3',
      source: 'stripe', eventType: 't',
      error: new Error('regression'),
    });
    expect(rows).toHaveLength(2);
  });
});

describe('webhooks/dlq — markResolved', () => {
  it('sets resolved=true, timestamp, resolver clerk_id, note', async () => {
    const { client, rows } = makeMockSupabase([
      { id: 'dlq-1', webhook_event_id: 'e', attempt_count: 3, resolved: false },
    ]);
    await markResolved(client, 'dlq-1', 'user_clerk_abc', 'manually reconciled');
    expect(rows[0].resolved).toBe(true);
    expect(rows[0].resolved_by_clerk_id).toBe('user_clerk_abc');
    expect(rows[0].resolution_note).toBe('manually reconciled');
  });

  it('null resolver is allowed (system-initiated cleanup)', async () => {
    const { client, rows } = makeMockSupabase([
      { id: 'dlq-1', webhook_event_id: 'e', attempt_count: 1, resolved: false },
    ]);
    await markResolved(client, 'dlq-1', null);
    expect(rows[0].resolved).toBe(true);
    expect(rows[0].resolved_by_clerk_id).toBeNull();
  });
});
