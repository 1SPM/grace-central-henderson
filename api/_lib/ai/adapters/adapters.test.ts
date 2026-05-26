import { describe, it, expect, vi } from 'vitest';
import { callGemini } from './gemini';
import { callClaude } from './claude';
import { callOpenAi } from './openai';

function mockFetch(response: { ok: boolean; status?: number; body?: unknown; text?: string }): typeof fetch {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 500),
    json: async () => response.body ?? {},
    text: async () => response.text ?? '',
  }) as unknown as typeof fetch;
}

// ============================================
// GEMINI
// ============================================
describe('adapters/gemini', () => {
  it('returns text + token counts from usageMetadata', async () => {
    const fetchImpl = mockFetch({
      ok: true,
      body: {
        candidates: [{ content: { parts: [{ text: 'hello' }] } }],
        usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 50 },
      },
    });
    const r = await callGemini({ apiKey: 'k', prompt: 'hi', fetchImpl });
    expect(r.success).toBe(true);
    expect(r.text).toBe('hello');
    expect(r.promptTokens).toBe(100);
    expect(r.completionTokens).toBe(50);
  });

  it('sets thinkingBudget=0 by default (Sprint 2 carried-over fix)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: 'ok' }] } }] }),
    });
    await callGemini({ apiKey: 'k', prompt: 'hi', fetchImpl: fetchImpl as unknown as typeof fetch });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('returns failure on HTTP error', async () => {
    const fetchImpl = mockFetch({ ok: false, status: 429, text: 'quota exceeded' });
    const r = await callGemini({ apiKey: 'k', prompt: 'hi', fetchImpl });
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('gemini_429');
    expect(r.error).toContain('quota exceeded');
  });

  it('returns failure on empty response', async () => {
    const fetchImpl = mockFetch({ ok: true, body: { candidates: [{ content: { parts: [{ text: '' }] } }] } });
    const r = await callGemini({ apiKey: 'k', prompt: 'hi', fetchImpl });
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('empty_response');
  });

  it('handles thrown fetch (network error) without throwing', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch;
    const r = await callGemini({ apiKey: 'k', prompt: 'hi', fetchImpl });
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('gemini_fetch_failed');
  });
});

// ============================================
// CLAUDE
// ============================================
describe('adapters/claude', () => {
  it('returns text + token counts from usage', async () => {
    const fetchImpl = mockFetch({
      ok: true,
      body: {
        content: [{ type: 'text', text: 'hello' }],
        usage: { input_tokens: 200, output_tokens: 75 },
      },
    });
    const r = await callClaude({ apiKey: 'k', prompt: 'hi', fetchImpl });
    expect(r.success).toBe(true);
    expect(r.text).toBe('hello');
    expect(r.promptTokens).toBe(200);
    expect(r.completionTokens).toBe(75);
  });

  it('sends anthropic-version header', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ content: [{ type: 'text', text: 'ok' }] }),
    });
    await callClaude({ apiKey: 'k', prompt: 'hi', fetchImpl: fetchImpl as unknown as typeof fetch });
    const headers = fetchImpl.mock.calls[0][1].headers as Record<string, string>;
    expect(headers['anthropic-version']).toBe('2023-06-01');
    expect(headers['x-api-key']).toBe('k');
  });

  it('refuses without an api key', async () => {
    const r = await callClaude({ apiKey: '', prompt: 'hi' });
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('claude_no_key');
  });

  it('parses error payload', async () => {
    const fetchImpl = mockFetch({
      ok: true,
      body: { error: { type: 'overloaded_error', message: 'overloaded' } },
    });
    const r = await callClaude({ apiKey: 'k', prompt: 'hi', fetchImpl });
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('claude_overloaded_error');
  });
});

// ============================================
// OPENAI
// ============================================
describe('adapters/openai', () => {
  it('returns text + token counts from usage', async () => {
    const fetchImpl = mockFetch({
      ok: true,
      body: {
        choices: [{ message: { content: 'hello' } }],
        usage: { prompt_tokens: 150, completion_tokens: 25 },
      },
    });
    const r = await callOpenAi({ apiKey: 'k', prompt: 'hi', fetchImpl });
    expect(r.success).toBe(true);
    expect(r.text).toBe('hello');
    expect(r.promptTokens).toBe(150);
    expect(r.completionTokens).toBe(25);
  });

  it('includes system prompt when provided', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'ok' } }] }),
    });
    await callOpenAi({ apiKey: 'k', prompt: 'hi', systemPrompt: 'be brief', fetchImpl: fetchImpl as unknown as typeof fetch });
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body as string);
    expect(body.messages).toEqual([
      { role: 'system', content: 'be brief' },
      { role: 'user', content: 'hi' },
    ]);
  });

  it('refuses without an api key', async () => {
    const r = await callOpenAi({ apiKey: '', prompt: 'hi' });
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('openai_no_key');
  });

  it('returns failure on HTTP 429', async () => {
    const fetchImpl = mockFetch({ ok: false, status: 429, text: 'rate limit' });
    const r = await callOpenAi({ apiKey: 'k', prompt: 'hi', fetchImpl });
    expect(r.success).toBe(false);
    expect(r.errorCode).toBe('openai_429');
  });
});
