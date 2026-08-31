/**
 * Minimal mock-Clerk/mock-Supabase plumbing for exercising the real
 * api/actions/_execute.ts and _propose.ts handlers from an EvalCase's
 * run().
 *
 * api/actions/governance-authority.fixture-002.test.ts — the authoritative
 * Fixture #002 regression test, left completely unmodified — duplicates
 * this same plumbing locally rather than exporting it. This module
 * duplicates it once here for reuse across every Fixture #002 EvalCase.
 */
import { vi } from 'vitest';
import { createMockSupabase } from '../../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../../tests/fixtures/shared-platform.js';

export function makeReq(body: unknown, headers: Record<string, string> = { authorization: 'Bearer valid-token' }) {
  return { method: 'POST', query: {}, headers, body } as unknown as import('@vercel/node').VercelRequest;
}

export function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & {
    status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn>;
  };
}

export function executeSupabaseFor(opts: { permission?: string; taskFound?: boolean } = {}) {
  const TASK_ID = '00000000-0000-4000-8000-0000000000e1';
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: [{ permissions: { key: opts.permission ?? 'tasks.manage' } }] }),
      tasks: (op: string) => {
        if (op === 'select') {
          return opts.taskFound === false
            ? { data: null }
            : { data: { id: TASK_ID, title: 'Call the Riveras', person_id: null, due_date: '2026-09-01', priority: 'medium', completed: false } };
        }
        return { data: { id: TASK_ID } };
      },
      platform_events: () => ({ data: { id: 'evt-1' } }),
      audit_logs: () => ({ data: null }),
    },
  });
}

export function proposeSupabaseFor(opts: { permission?: string } = {}) {
  const PERSON_ID = '00000000-0000-4000-8000-0000000000e2';
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: [{ permissions: { key: opts.permission ?? 'people.manage' } }] }),
      agent_actions: (op: string) => (op === 'select' ? { data: null } : { data: { id: 'action-1' } }),
      approvals: () => ({ data: { id: 'approval-1' } }),
      people: () => ({ data: { id: PERSON_ID, first_name: 'Dana', last_name: 'Reyes' } }),
      platform_events: () => ({ data: { id: 'evt-1' } }),
      audit_logs: () => ({ data: null }),
    },
  });
}

async function withMocks(churchId: string, tokenOk = true) {
  vi.resetModules();
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

  vi.doMock('@clerk/backend', () => ({
    verifyToken: tokenOk
      ? vi.fn().mockResolvedValue({ sub: FIXTURE_STAFF_USER.clerk_id, app_metadata: { church_id: churchId } })
      : vi.fn().mockRejectedValue(new Error('invalid token')),
  }));
}

export async function callExecute(
  supabase: ReturnType<typeof executeSupabaseFor>,
  body: unknown,
  opts: { headers?: Record<string, string>; churchId?: string; tokenOk?: boolean } = {},
) {
  await withMocks(opts.churchId ?? FIXTURE_CHURCH_ID, opts.tokenOk ?? true);
  vi.doMock('@supabase/supabase-js', () => ({ createClient: vi.fn().mockReturnValue(supabase) }));
  const handler = (await import('../../../api/actions/_execute.js')).default;
  const res = makeRes();
  await handler(makeReq(body, opts.headers), res);
  return { res, supabase };
}

export async function callPropose(
  supabase: ReturnType<typeof proposeSupabaseFor>,
  body: unknown,
  opts: { headers?: Record<string, string>; churchId?: string; tokenOk?: boolean } = {},
) {
  await withMocks(opts.churchId ?? FIXTURE_CHURCH_ID, opts.tokenOk ?? true);
  vi.doMock('@supabase/supabase-js', () => ({ createClient: vi.fn().mockReturnValue(supabase) }));
  const handler = (await import('../../../api/actions/_propose.js')).default;
  const res = makeRes();
  await handler(makeReq(body, opts.headers), res);
  return { res, supabase };
}
