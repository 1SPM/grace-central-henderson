import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { VercelRequest, VercelResponse } from '@vercel/node';

vi.mock('../_lib/auth-helper.js', () => ({
  requireClerkAuth: vi.fn(async () => ({ ok: true, churchId: 'church-1', role: 'pastor' })),
}));

vi.mock('../_lib/agents/runner.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../_lib/agents/runner.js')>();
  return {
    ...actual,
    loadSettings: vi.fn(async () => ({
      member_care_enabled: true,
      stewardship_enabled: true,
      operations_enabled: false,
      portal_engagement_enabled: true,
      card_ops_enabled: true,
      crisis_escalation_enabled: true,
      member_care_inactive_days: 30,
      member_care_birthday_window_days: 7,
      stewardship_lapsed_days: 60,
      stewardship_large_gift_micro_usd: 1_000_000_000,
      stewardship_flag_first_time_gift: true,
      operations_event_no_leader_days: 7,
      portal_engagement_inactive_days: 30,
      card_ops_kyc_stuck_hours: 48,
    })),
  };
});

vi.mock('../_lib/agents/messaging.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../_lib/agents/messaging.js')>();
  return {
    ...actual,
    loadMessagingSettings: vi.fn(async () => ({
      'life-event-agent': { enabled: true },
    })),
  };
});

vi.mock('../_lib/grace-tts.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../_lib/grace-tts.js')>();
  return {
    ...actual,
    probeTtsHealth: vi.fn(async () => ({ ok: true, provider: 'elevenlabs', voice: 'v1' })),
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({
            data: [
              { job: 'agents', ran_at: '2026-07-06T07:00:00Z', ok: true, duration_ms: 1200, summary: { churches_processed: 1 } },
            ],
            error: null,
          }),
        }),
      }),
    }),
  })),
}));

function mockRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) { this.statusCode = code; return this; },
    json(payload: unknown) { this.body = payload; return this; },
  };
  return res as unknown as VercelResponse & { statusCode: number; body: unknown };
}

describe('GET /api/automation/status', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.RESEND_API_KEY = 'resend-key';
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.STRIPE_SECRET_KEY;
  });

  it('rejects non-GET methods', async () => {
    const { default: handler } = await import('./_status.js');
    const res = mockRes();
    await handler({ method: 'POST', headers: {} } as unknown as VercelRequest, res);
    expect(res.statusCode).toBe(405);
  });

  it('returns crons, agents, and services in the expected shape', async () => {
    const { default: handler } = await import('./_status.js');
    const res = mockRes();
    await handler({ method: 'GET', headers: {} } as unknown as VercelRequest, res);

    expect(res.statusCode).toBe(200);
    const body = res.body as {
      ok: boolean;
      crons: Array<{ job: string; schedule: string; last_run: { ok: boolean } | null }>;
      agents: { server: Array<{ id: string; enabled: boolean }>; messaging: Array<{ id: string; enabled: boolean }> };
      services: Record<string, { configured: boolean }>;
    };

    expect(body.ok).toBe(true);
    expect(body.crons).toHaveLength(4);
    const agentsCron = body.crons.find(c => c.job === 'agents');
    expect(agentsCron?.last_run?.ok).toBe(true);
    const anomalyCron = body.crons.find(c => c.job === 'ai-anomaly');
    expect(anomalyCron?.last_run).toBeNull();

    expect(body.agents.server).toHaveLength(6);
    expect(body.agents.server.find(a => a.id === 'operations')?.enabled).toBe(false);
    expect(body.agents.messaging.find(a => a.id === 'life-event-agent')?.enabled).toBe(true);
    expect(body.agents.messaging.find(a => a.id === 'new-member-agent')?.enabled).toBe(false);

    expect(body.services.voice.configured).toBe(true);
    expect(body.services.email.configured).toBe(true);
    expect(body.services.sms.configured).toBe(false);
    expect(body.services.stripe.configured).toBe(false);
  });
});

describe('automation/status API route registration', () => {
  it('is registered in the consolidated dispatcher', () => {
    const dispatcherSource = readFileSync(join(process.cwd(), 'api/[...path].ts'), 'utf8');
    expect(dispatcherSource).toContain("'automation/status'");
  });
});
