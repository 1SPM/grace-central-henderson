import { describe, it, expect, vi } from 'vitest';
import {
  buildFullPrompt,
  generateWithHermes,
  getHermesConfig,
  isGeminiQuotaError,
} from '../../api/_lib/aiProviders';

describe('AI provider helpers', () => {
  it('builds prompt with optional context', () => {
    expect(buildFullPrompt('hello')).toBe('hello');
    expect(buildFullPrompt('hello', 'church context')).toBe('Context: church context\n\nRequest: hello');
  });

  it('recognizes Gemini spend cap and quota errors for fallback', () => {
    expect(isGeminiQuotaError('Gemini spend cap reached')).toBe(true);
    expect(isGeminiQuotaError('RESOURCE_EXHAUSTED 429')).toBe(true);
    expect(isGeminiQuotaError('random failure')).toBe(false);
  });

  it('reads optional Hermes brain configuration from env', () => {
    const cfg = getHermesConfig({
      HERMES_API_URL: 'https://agent.example.com',
      HERMES_API_KEY: 'secret',
      HERMES_MODEL: 'grace-brain',
    });
    expect(cfg.configured).toBe(true);
    expect(cfg.url).toBe('https://agent.example.com');
    expect(cfg.model).toBe('grace-brain');
  });

  it('calls a Hermes/OpenAI-compatible brain endpoint', async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Hermes answer' } }],
      model: 'hermes-agent',
    }), { status: 200, headers: { 'content-type': 'application/json' } }));

    const result = await generateWithHermes({
      prompt: 'What needs follow-up?',
      maxTokens: 123,
      env: {
        HERMES_API_URL: 'https://agent.example.com',
        HERMES_API_KEY: 'secret',
        HERMES_MODEL: 'hermes-agent',
      },
      fetchImpl,
    });

    expect(result.success).toBe(true);
    expect(result.text).toBe('Hermes answer');
    expect(result.model).toBe('hermes-agent');
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://agent.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Bearer secret' }),
      }),
    );
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, { body: string }];
    const body = JSON.parse(init.body);
    expect(body.max_tokens).toBe(123);
    expect(body.messages[0].content).toContain('Grace AI');
    expect(body.messages[1].content).toBe('What needs follow-up?');
  });

  it('returns unconfigured when Hermes env is missing', async () => {
    const result = await generateWithHermes({ prompt: 'hello', env: {}, fetchImpl: vi.fn() });
    expect(result.success).toBe(false);
    expect(result.error).toBe('Hermes brain not configured');
  });
});
