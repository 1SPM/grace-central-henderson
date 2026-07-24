/**
 * Route tests for POST /api/people/seed-demo-persona — proves the
 * tenant guard: a non-demo church requires typed confirmation matching
 * its exact configured name, and the 409 responses never echo that name.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';
import { FIXTURE_CHURCH_ID, FIXTURE_STAFF_USER } from '../../tests/fixtures/shared-platform.js';

vi.mock('@clerk/backend', () => ({ verifyToken: vi.fn() }));
vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeReq(body: unknown) {
  return { method: 'POST', headers: { authorization: 'Bearer valid-token' }, body } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

function supabaseWithChurchName(churchName: string) {
  return createMockSupabase({
    tables: {
      users: () => ({ data: { id: FIXTURE_STAFF_USER.id, account_status: 'active' } }),
      user_roles: () => ({ data: [{ role_id: 'fixture-role-id' }] }),
      role_permissions: () => ({ data: [{ permissions: { key: 'portal.provision_member' } }] }),
      churches: () => ({ data: { settings: { profile: { name: churchName } } } }),
      small_groups: () => ({ data: null }),
      calendar_events: () => ({ data: null }),
      people: () => ({ data: null }),
      platform_events: () => ({ data: { id: 'fixture-platform-event-id' } }),
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

describe('POST /api/people/seed-demo-persona — tenant guard (non-demo church)', () => {
  it('409s with confirmation_required when confirm is missing, and never includes the church name', async () => {
    const handler = (await import('./_seed-demo-persona.js')).default;
    const supabase = supabaseWithChurchName('Central Test Church');
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ first_name: 'Test', last_name: 'Persona' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('confirmation_required');
    expect(JSON.stringify(body)).not.toContain('Central Test Church');

    const peopleInsertCalls = supabase.__calls.filter(c => c.table === 'people' && c.op === 'insert');
    expect(peopleInsertCalls).toHaveLength(0);
  });

  it('409s with confirmation_mismatch when the typed name is wrong, and never includes the real church name', async () => {
    const handler = (await import('./_seed-demo-persona.js')).default;
    const supabase = supabaseWithChurchName('Central Test Church');
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ first_name: 'Test', last_name: 'Persona', confirm: 'Wrong Name' });
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0][0];
    expect(body.error).toBe('confirmation_mismatch');
    expect(JSON.stringify(body)).not.toContain('Central Test Church');

    const peopleInsertCalls = supabase.__calls.filter(c => c.table === 'people' && c.op === 'insert');
    expect(peopleInsertCalls).toHaveLength(0);
  });

  it('proceeds to create the person when the typed name matches exactly', async () => {
    const handler = (await import('./_seed-demo-persona.js')).default;
    const supabase = supabaseWithChurchName('Central Test Church');
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq({ first_name: 'Test', last_name: 'Persona', confirm: 'Central Test Church' });
    const res = makeRes();
    await handler(req, res);

    const peopleInsertCalls = supabase.__calls.filter(c => c.table === 'people' && c.op === 'insert');
    expect(peopleInsertCalls).toHaveLength(1);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
