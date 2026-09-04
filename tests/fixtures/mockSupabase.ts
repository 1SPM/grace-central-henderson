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

export type TableHandler = (op: 'select' | 'insert' | 'update' | 'upsert' | 'delete', payload: unknown) => MockResponse;

/**
 * A Postgres function called via `.rpc()`.
 *
 * Worth being clear about what a mocked RPC can and cannot prove. It can
 * show that the caller passed the right parameters and handled the result
 * correctly. It CANNOT show anything about what the function does — the
 * transaction, the row locks, the rollback-on-audit-failure in migration
 * 070 are all on the other side of this boundary. Those need a real
 * database (tools/agent-atomic-audit-smoke.test.ts).
 */
export type RpcHandler = (params: Record<string, unknown> | undefined) => MockResponse;

export interface MockSupabaseOptions {
  tables: Record<string, TableHandler>;
  rpcs?: Record<string, RpcHandler>;
}

export function createMockSupabase(options: MockSupabaseOptions) {
  const calls: { table: string; op: string; payload: unknown }[] = [];

  function makeBuilder(table: string, op: 'select' | 'insert' | 'update' | 'upsert' | 'delete', payload: unknown) {
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
      overlaps: vi.fn(() => builder),
      filter: vi.fn(() => builder),
      or: vi.fn(() => builder),
      ilike: vi.fn(() => builder),
      textSearch: vi.fn(() => builder),
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
      // Added when the first server-side delete executor needed testing.
      // Takes no payload — the row is identified by the filters, which this
      // fixture treats as no-ops, so a test asserts on the CALL rather than
      // on which row would have matched.
      delete: vi.fn(() => {
        calls.push({ table, op: 'delete', payload: null });
        return makeBuilder(table, 'delete', null);
      }),
    };
  }

  const supabase = {
    from: vi.fn((table: string) => {
      if (!tableEntries.has(table)) tableEntries.set(table, buildTableEntry(table));
      return tableEntries.get(table)!;
    }),
    // Recorded into the same `__calls` list as table operations, with the
    // function name in `table`, so a test can assert on the ORDER of a
    // mixed sequence — e.g. that no audit insert followed an RPC that
    // already wrote one.
    rpc: vi.fn(async (fn: string, params?: Record<string, unknown>) => {
      calls.push({ table: fn, op: 'rpc', payload: params });
      const handler = options.rpcs?.[fn];
      // An unstubbed RPC resolves to nothing rather than throwing, matching
      // how an unstubbed table behaves — the code under test decides
      // whether that is a failure.
      const result = handler ? handler(params) : { data: null, error: null };
      return { data: result.data ?? null, error: result.error ?? null };
    }),
    __calls: calls,
  };

  return supabase;
}
