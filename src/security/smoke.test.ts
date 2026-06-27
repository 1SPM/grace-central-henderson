import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAuthMode } from '../contexts/authMode';
import { buildPrintableDocument } from '../components/printing';
import { secureFetch } from '../utils/security';
import { scrub, stripQuery, SENSITIVE_KEY_PATTERN } from '../lib/observability/scrub';

describe('security smoke checks', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('fails closed for auth in production when clerk key is missing and demo mode is off', () => {
    const mode = resolveAuthMode({
      clerkPublishableKey: undefined,
      isProduction: true,
      isDemoModeEnabled: false,
    });

    expect(mode).toBe('blocked');
  });

  it('prefers demo mode over clerk when demo mode is enabled', () => {
    const mode = resolveAuthMode({
      clerkPublishableKey: 'pk_test_xxx',
      isProduction: true,
      isDemoModeEnabled: true,
    });

    expect(mode).toBe('demo');
  });

  it('adds CSRF header for state-changing requests', async () => {
    const fetchSpy = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    global.fetch = fetchSpy;

    await secureFetch('/api/auth/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const [, options] = fetchSpy.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;

    expect(headers.get('X-CSRF-Token')).toBeTruthy();
    expect(options.credentials).toBe('same-origin');
  });

  it('sanitizes printable HTML before document output', () => {
    const rawHtml = '<h1>Report</h1><img src=x onerror="alert(1)"><script>alert(1)</script>';

    const printableDocument = buildPrintableDocument(rawHtml);

    expect(printableDocument).toContain('<h1>Report</h1>');
    expect(printableDocument).not.toContain('<script>');
    expect(printableDocument).not.toContain('onerror=');
  });

  it('Sentry PII scrubber redacts sensitive header and body keys', () => {
    const event = {
      request: {
        headers: {
          'authorization': 'Bearer secret-jwt',
          'cookie': 'session=abc',
          'x-stripe-signature': 'sig_xxx',
          'user-agent': 'jest',
        },
        data: {
          password: 'hunter2',
          api_key: 'sk_test_abc',
          token: 't',
          name: 'Sam',
        },
      },
    };

    const scrubbed = scrub(event) as typeof event;

    expect(scrubbed.request.headers['authorization']).toBe('[REDACTED]');
    expect(scrubbed.request.headers['cookie']).toBe('[REDACTED]');
    expect(scrubbed.request.headers['x-stripe-signature']).toBe('[REDACTED]');
    expect(scrubbed.request.headers['user-agent']).toBe('jest');
    expect(scrubbed.request.data.password).toBe('[REDACTED]');
    expect(scrubbed.request.data.api_key).toBe('[REDACTED]');
    expect(scrubbed.request.data.token).toBe('[REDACTED]');
    expect(scrubbed.request.data.name).toBe('Sam');
  });

  it('Sentry PII scrubber walks nested structures', () => {
    const input = {
      ctx: { headers: { Authorization: 'x' }, list: [{ secret: 'y', ok: 1 }] },
    };
    const out = scrub(input) as typeof input;
    expect(out.ctx.headers.Authorization).toBe('[REDACTED]');
    expect(out.ctx.list[0].secret).toBe('[REDACTED]');
    expect(out.ctx.list[0].ok).toBe(1);
  });

  it('Sentry URL stripper removes query strings (may carry tokens)', () => {
    expect(stripQuery('https://x.com/y?token=abc')).toBe('https://x.com/y');
    expect(stripQuery('https://x.com/y')).toBe('https://x.com/y');
    expect(stripQuery(undefined)).toBeUndefined();
  });

  it('Sentry PII pattern matches common credential names', () => {
    for (const key of ['authorization', 'Cookie', 'PASSWORD', 'api_key', 'api-key', 'csrf', 'sessionId', 'svix-signature']) {
      expect(SENSITIVE_KEY_PATTERN.test(key)).toBe(true);
    }
    for (const key of ['name', 'email', 'church_id', 'user_id']) {
      expect(SENSITIVE_KEY_PATTERN.test(key)).toBe(false);
    }
  });
});
