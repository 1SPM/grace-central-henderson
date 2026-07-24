/**
 * Route tests for PUT /api/tenant/hosts — proves the host-squatting
 * guard (409 when another church already claims a submitted host,
 * without leaking which church) and the hostname shape check.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeReq(body: unknown) {
  return { method: 'PUT', headers: { authorization: 'Bearer valid-token' }, body } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function authorizedSupabase(overrides: Record<string, () => { data: unknown }> = {}) {
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: [{ permissions: { key: 'portal.provision_member' } }] }),
      platform_events: () => ({ data: { id: 'fixture-platform-event-id' } }),
      ...overrides,
    },
  });
}

beforeEach(async () => {
  vi.resetModules();
  process.env.CLERK_SECRET_KEY = 'test-secret-key';
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
  const { verifyToken } = await import('@clerk/backend');
  (verifyToken as ReturnType<typeof vi.fn>).mockResolvedValue({
    sub: FIXTURE_STAFF_USER.clerk_id,
    app_metadata: { church_id: FIXTURE_CHURCH_ID },
  });
});

describe('PUT /api/tenant/hosts — host squatting guard', () => {
  it('409s and never updates when a submitted host is already claimed by another church', async () => {
    const handler = (await import('./_hosts.js')).default;
    const supabase = authorizedSupabase({
      churches: () => ({ data: [{ id: 'some-other-church-id', hosts: ['taken.example.org'] }] }),
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ hosts: ['taken.example.org'] });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('host_already_claimed');
    expect(JSON.stringify(body)).not.toContain('some-other-church-id');
    const updateCalls = supabase.__calls.filter(c => c.table === 'churches' && c.op === 'update');
    expect(updateCalls).toHaveLength(0);
  });

  it('200s and updates when no other church claims the submitted hosts', async () => {
    const handler = (await import('./_hosts.js')).default;
    const supabase = authorizedSupabase({
      churches: (op: string) => {
        if (op === 'update') return { data: { hosts: ['free.example.org'] } };
        return { data: [] };
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ hosts: ['free.example.org'] });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const updateCalls = supabase.__calls.filter(c => c.table === 'churches' && c.op === 'update');
    expect(updateCalls).toHaveLength(1);
  });

  it('400s on an invalid hostname shape (scheme/slash/space) before any conflict check', async () => {
    const handler = (await import('./_hosts.js')).default;
    const supabase = authorizedSupabase({
      churches: () => ({ data: [] }),
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ hosts: ['https://not-a-bare-host.example.org/'] });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('invalid_host_shape');
  });
});
