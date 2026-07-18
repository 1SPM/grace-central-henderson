/**
 * Route test for GET /api/tenant/config — proves it never returns
 * anything beyond church_name/branding, even when the underlying
 * settings object contains secret-like keys (integrations, API tokens).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabase } from '../../tests/fixtures/mockSupabase.js';

vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn() }));

function makeReq(host: string) {
  return { method: 'GET', headers: {}, query: { host } } as unknown as import('@vercel/node').VercelRequest;
}

function makeRes() {
  const res: Record<string, unknown> = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.setHeader = vi.fn();
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  vi.resetModules();
  process.env.VITE_SUPABASE_URL = 'https://example.invalid';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';
});

describe('GET /api/tenant/config', () => {
  it('never returns non-branding settings keys, even when they exist in the underlying row', async () => {
    const handler = (await import('./_config.js')).default;
    const supabase = createMockSupabase({
      tables: {
        churches: () => ({
          data: {
            settings: {
              profile: { name: 'Real Church' },
              branding: { primaryColor: '#123456', logoUrl: 'https://example.com/logo.png' },
              integrations: { stripeSecretKey: 'sk_live_should_never_leak', twilioAuthToken: 'super-secret' },
              onboarding: { wizardCompleted: true },
            },
          },
        }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq('church.example.org');
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(Object.keys(body).sort()).toEqual(['branding', 'church_name']);
    expect(body.church_name).toBe('Real Church');
    expect(body.branding).toEqual({ primaryColor: '#123456', logoUrl: 'https://example.com/logo.png' });
    expect(JSON.stringify(body)).not.toContain('sk_live_should_never_leak');
    expect(JSON.stringify(body)).not.toContain('super-secret');
  });

  it('returns null church_name/branding when no church matches the host', async () => {
    const handler = (await import('./_config.js')).default;
    const supabase = createMockSupabase({
      tables: {
        churches: () => ({ data: null }),
      },
    });
    const { createClient } = await import('@supabase/supabase-js');
    vi.mocked(createClient).mockReturnValue(supabase as never);

    const req = makeReq('unknown.example.org');
    const res = makeRes();
    await handler(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = res.json.mock.calls[0][0];
    expect(body).toEqual({ church_name: null, branding: null });
  });
});
