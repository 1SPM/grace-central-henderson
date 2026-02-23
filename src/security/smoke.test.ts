import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveAuthMode } from '../contexts/authMode';
import { buildPrintableDocument } from '../components/printing';
import { secureFetch } from '../utils/security';

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
});
