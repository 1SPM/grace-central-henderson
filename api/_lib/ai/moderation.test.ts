import { describe, it, expect, vi } from 'vitest';
import { moderate } from './moderation.js';

function mockFetch(response: { ok: boolean; status?: number; body?: unknown }): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.body ?? {},
  }) as unknown as typeof fetch;
}

describe('ai/moderation', () => {
  it('skips with no_api_key when key absent', async () => {
    const r = await moderate('whatever', { apiKey: '', fetchImpl: vi.fn() });
    expect(r.flagged).toBe(false);
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toBe('no_api_key');
  });

  it('skips empty input', async () => {
    const r = await moderate('   ', { apiKey: 'sk-test', fetchImpl: vi.fn() });
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toBe('empty_input');
  });

  it('returns flagged=true when OpenAI flags', async () => {
    const fetchImpl = mockFetch({
      ok: true,
      body: { results: [{ flagged: true, categories: { hate: true, harassment: false, violence: true } }] },
    });
    const r = await moderate('some text', { apiKey: 'sk-test', fetchImpl });
    expect(r.flagged).toBe(true);
    expect(r.skipped).toBe(false);
    expect(r.flaggedCategories.sort()).toEqual(['hate', 'violence']);
  });

  it('returns flagged=false when OpenAI clears', async () => {
    const fetchImpl = mockFetch({
      ok: true,
      body: { results: [{ flagged: false, categories: { hate: false, harassment: false } }] },
    });
    const r = await moderate('good text', { apiKey: 'sk-test', fetchImpl });
    expect(r.flagged).toBe(false);
    expect(r.skipped).toBe(false);
    expect(r.flaggedCategories).toEqual([]);
  });

  it('fails OPEN on HTTP error (does not block calls during outage)', async () => {
    const fetchImpl = mockFetch({ ok: false, status: 503 });
    const r = await moderate('some text', { apiKey: 'sk-test', fetchImpl });
    expect(r.flagged).toBe(false);
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toBe('request_failed');
  });

  it('fails OPEN on fetch throw', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network')) as unknown as typeof fetch;
    const r = await moderate('some text', { apiKey: 'sk-test', fetchImpl });
    expect(r.flagged).toBe(false);
    expect(r.skipped).toBe(true);
    expect(r.skipReason).toBe('request_failed');
  });

  it('fails OPEN when response body has no results array', async () => {
    const fetchImpl = mockFetch({ ok: true, body: { something: 'else' } });
    const r = await moderate('some text', { apiKey: 'sk-test', fetchImpl });
    expect(r.flagged).toBe(false);
    expect(r.skipped).toBe(true);
  });

  it('sends correct payload to OpenAI', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: [{ flagged: false }] }),
    });
    await moderate('hello world', { apiKey: 'sk-test-key', fetchImpl: fetchImpl as unknown as typeof fetch });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/moderations');
    expect((init as RequestInit).method).toBe('POST');
    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test-key');
    expect(headers['Content-Type']).toBe('application/json');
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.input).toBe('hello world');
    expect(body.model).toBe('omni-moderation-latest');
  });
});
