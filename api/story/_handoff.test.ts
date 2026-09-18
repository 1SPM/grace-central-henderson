/**
 * Handoff minting: consent, allowlist enforcement, tenant gating, and the
 * promise that the raw token exists only in the QR.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { VercelRequest, VercelResponse } from '@vercel/node';

const FAITHFUL = '22222222-2222-2222-2222-222222222222';
const CENTRAL = '11111111-1111-1111-1111-111111111111';

let insertedDraft: Record<string, unknown> | null = null;
let insertedToken: Record<string, unknown> | null = null;
let emitted: { eventType: string; payload?: Record<string, unknown> }[] = [];

vi.mock('../_lib/rateLimit/limiter.js', () => ({
  enforceRateLimit: vi.fn().mockResolvedValue(false),
  clientIp: () => '203.0.113.9',
}));
vi.mock('../_lib/platformEvents.js', () => ({
  emitPlatformEvent: vi.fn(async (_c: unknown, e: { eventType: string; payload?: Record<string, unknown> }) => {
    emitted.push(e);
  }),
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    from: (table: string) => {
      const b: Record<string, unknown> = {};
      const chain = () => b;
      Object.assign(b, {
        select: chain, eq: chain, contains: chain, limit: chain,
        insert: (payload: Record<string, unknown>) => {
          if (table === 'visitor_story_drafts') insertedDraft = payload;
          if (table === 'visitor_story_handoffs') insertedToken = payload;
          return b;
        },
        single: vi.fn(async () => ({ data: { id: 'draft_1' }, error: null })),
        maybeSingle: vi.fn(async () => ({ data: null, error: null })),
        then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
      });
      return b;
    },
  }),
}));

function makeRes() {
  const res: Record<string, unknown> = {};
  res.setHeader = vi.fn(() => res);
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.end = vi.fn(() => res);
  return res as unknown as VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}
async function call(body: unknown, host = 'grace-members.vercel.app') {
  const { default: handler } = await import('./_handoff.js');
  const res = makeRes();
  await handler({ method: 'POST', headers: { host }, body } as unknown as VercelRequest, res);
  return res;
}
const base = { tenant: 'faithful', consentCarryStory: true };

beforeEach(() => {
  vi.clearAllMocks(); vi.resetModules();
  insertedDraft = null; insertedToken = null; emitted = [];
  process.env.VITE_SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  // Reset here rather than in the test that sets it: a failed assertion would
  // otherwise leak the override into every test that follows.
  delete process.env.MEMBER_PORTAL_URL;
});

describe('consent', () => {
  it('refuses to mint a handoff without the carry consent', async () => {
    const res = await call({ tenant: 'faithful', sections: { church: ['x'] } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].error).toBe('consent_required');
    expect(insertedDraft).toBeNull();
  });

  it('excludes money sections unless separately consented', async () => {
    const res = await call({ ...base, sections: { wallet: ['identity'] } });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json.mock.calls[0][0].detail).toMatch(/money-sections consent/);
  });

  it('includes money sections when they are', async () => {
    await call({ ...base, consentMoneySections: true, sections: { impact: ['Food pantry'] } });
    expect(insertedDraft?.consent_money_sections).toBe(true);
    expect(insertedDraft?.sections).toMatchObject({ impact: ['Food pantry'] });
  });

  it('records a declined follow-up as false rather than omitting it', async () => {
    await call({ ...base, sections: { church: ['x'] } });
    expect(insertedDraft?.consent_followup).toBe(false);
  });
});

describe('tenant gating', () => {
  it('stores against Faithful when the faithful slug is sent on the shared host', async () => {
    await call({ ...base, sections: { church: ['x'] } });
    expect(insertedDraft?.church_id).toBe(FAITHFUL);
  });

  it('falls back to the host when no slug is sent', async () => {
    await call({ consentCarryStory: true, sections: { church: ['x'] } });
    expect(insertedDraft?.church_id).toBe(CENTRAL);
  });

  it('refuses a real-tenant slug on a host that does not own it', async () => {
    await call({ tenant: 'central-henderson', consentCarryStory: true, sections: { church: ['x'] } },
      'grace-crm-two.vercel.app');
    expect(insertedDraft?.church_id).toBe(FAITHFUL);
  });
});

describe('token', () => {
  it('stores only the SHA-256 — the raw token exists solely in the QR', async () => {
    const res = await call({ ...base, sections: { church: ['x'] } });
    const payload = res.json.mock.calls[0][0];
    expect(insertedToken?.token_sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(insertedToken)).not.toContain(payload.token);
  });

  it('puts the token in the URL FRAGMENT, so it never reaches a server log', async () => {
    const res = await call({ ...base, sections: { church: ['x'] } });
    const { claim_url, token } = res.json.mock.calls[0][0];
    expect(claim_url).toContain(`#t=${token}`);
    // Everything before the fragment is what a server, proxy or analytics
    // tool can see. The token must not be in any of it.
    expect(claim_url.split('#')[0]).not.toContain(token);
    expect(new URL(claim_url).searchParams.get('t')).toBeNull();
  });

  it('carries the tenant in the query so the token is looked up in the right church', async () => {
    // Without this, a Faithful token on the shared host resolves against
    // Central Henderson and comes back 'unknown'.
    const res = await call({ ...base, sections: { church: ['x'] } });
    const url = new URL(res.json.mock.calls[0][0].claim_url);
    expect(url.pathname).toBe('/claim');
    expect(url.searchParams.get('tenant')).toBe('faithful');
  });

  it('renders the QR itself rather than calling a third-party image service', async () => {
    const res = await call({ ...base, sections: { church: ['x'] } });
    const { qr_png_data_url } = res.json.mock.calls[0][0];
    expect(qr_png_data_url).toMatch(/^data:image\/png;base64,/);
    expect(qr_png_data_url).not.toContain('qrserver');
  });

  it('builds an http claim URL for a local host, so local QA is scannable', async () => {
    const res = await call({ ...base, sections: { church: ['x'] } }, 'localhost:3011');
    expect(res.json.mock.calls[0][0].claim_url).toMatch(/^http:\/\/localhost:3011\/claim\?tenant=faithful#t=/);
  });

  it('prefers the configured portal origin when one is set', async () => {
    process.env.MEMBER_PORTAL_URL = 'https://portal.example';
    const res = await call({ ...base, sections: { church: ['x'] } });
    expect(res.json.mock.calls[0][0].claim_url).toMatch(/^https:\/\/portal\.example\/claim\?tenant=faithful#t=/);
  });

  it('expires in 15 minutes', async () => {
    const res = await call({ ...base, sections: { church: ['x'] } });
    expect(res.json.mock.calls[0][0].expires_in_seconds).toBe(900);
  });
});

describe('telemetry', () => {
  it('emits counts and expiry, never story content', async () => {
    await call({ ...base, sections: { church: ['I have been here two years'] } });
    const e = emitted.find(x => x.eventType === 'story.handoff_issued');
    expect(e?.payload).toMatchObject({ section_count: 1 });
    expect(JSON.stringify(e?.payload)).not.toContain('two years');
  });
});

describe('input bounds', () => {
  it('rejects an oversized payload', async () => {
    const big = 'x'.repeat(400);
    const res = await call({ ...base, sections: {
      church: Array(6).fill(big), connect: Array(6).fill(big),
      reflect: Array(6).fill(big), leadership: Array(6).fill(big),
    } });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an unknown section rather than dropping it', async () => {
    const res = await call({ ...base, sections: { journal: ['private'] } });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an invalid segment value', async () => {
    const res = await call({ ...base, segments: { age_band: '35' } });
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('rejects an over-long preferred name', async () => {
    const res = await call({ ...base, preferredName: 'x'.repeat(81) });
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
