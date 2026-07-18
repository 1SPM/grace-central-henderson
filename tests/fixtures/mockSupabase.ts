/**
 * Minimal fake Supabase query builder for unit tests.
 *
 * Real integration against Postgres/RLS is covered separately by
 * tools/shared-foundation-smoke.test.ts (staging-gated, same pattern as
 * the existing tools/cross-tenant-smoke.test.ts). This mock exists so
 * api/_lib/authz.ts, api/_lib/platformEvents.ts, and api/_lib/workosAudit.ts
 * can be tested without a live database — every `.eq()/.is()/.order()/...`
 * call is a no-op that returns the same chainable object, and the chain
 * resolves (via `.then`, `.maybeSingle()`, or `.single()`) to a
 * preconfigured response for that table + operation.
 */
import { vi } from 'vitest';

export interface MockResponse {
  data?: unknown;
  error?: { message: string; code?: string } | null;
}

export type TableHandler = (op: 'select' | 'insert' | 'update' | 'upsert', payload: unknown) => MockResponse;

export interface MockSupabaseOptions {
  tables: Record<string, TableHandler>;
}

export function createMockSupabase(options: MockSupabaseOptions) {
  const calls: { table: string; op: string; payload: unknown }[] = [];

  function makeBuilder(table: string, op: 'select' | 'insert' | 'update' | 'upsert', payload: unknown) {
    const resolve = (): MockResponse => {
      const handler = options.tables[table];
      const result = handler ? handler(op, payload) : { data: null, error: null };
      return { data: result.data ?? null, error: result.error ?? null };
    };

    const builder: Record<string, unknown> = {
      select: vi.fn(() => builder),
      eq: vi.fn(() => builder),
      neq: vi.fn(() => builder),
      in: vi.fn(() => builder),
      is: vi.fn(() => builder),
      not: vi.fn(() => builder),
      contains: vi.fn(() => builder),
      lt: vi.fn(() => builder),
      lte: vi.fn(() => builder),
      gt: vi.fn(() => builder),
      gte: vi.fn(() => builder),
      order: vi.fn(() => builder),
      limit: vi.fn(() => builder),
      maybeSingle: vi.fn(async () => resolve()),
      single: vi.fn(async () => resolve()),
      then: (onFulfilled: (v: MockResponse) => unknown) => Promise.resolve(resolve()).then(onFulfilled),
    };
    return builder;
  }

  // Cache one table-entry object (with stable vi.fn spies) per table name,
  // so `supabase.from('x')` called twice in a test — once by the code under
  // test, once by the test itself to inspect `.mock.calls` — returns the
  // SAME spy rather than two independent ones.
  const tableEntries = new Map<string, ReturnType<typeof buildTableEntry>>();

  function buildTableEntry(table: string) {
    return {
      select: vi.fn((...args: unknown[]) => {
        calls.push({ table, op: 'select', payload: args });
        return makeBuilder(table, 'select', args);
      }),
      insert: vi.fn((payload: unknown) => {
        calls.push({ table, op: 'insert', payload });
        return makeBuilder(table, 'insert', payload);
      }),
      update: vi.fn((payload: unknown) => {
        calls.push({ table, op: 'update', payload });
        return makeBuilder(table, 'update', payload);
      }),
      upsert: vi.fn((payload: unknown) => {
        calls.push({ table, op: 'upsert', payload });
        return makeBuilder(table, 'upsert', payload);
      }),
    };
  }

  const supabase = {
    from: vi.fn((table: string) => {
      if (!tableEntries.has(table)) tableEntries.set(table, buildTableEntry(table));
      return tableEntries.get(table)!;
    }),
    __calls: calls,
  };

  return supabase;
}
