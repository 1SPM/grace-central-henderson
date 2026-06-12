/**
 * OpenAI Chat Completions adapter.
 *
 * Returns a ProviderCallResult — never throws. No-op (returns failure)
 * without OPENAI_API_KEY.
 */

import type { ProviderCallResult } from '../gateway.js';

export interface OpenAiCallOptions {
  apiKey: string;
  model?: string;                       // default gpt-4o-mini
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;                   // default 1500
  temperature?: number;                 // default 0.6
  fetchImpl?: typeof fetch;
}

interface OpenAiResponse {
  choices?: Array<{ message?: { content?: string }; finish_reason?: string }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
  error?: { type?: string; message?: string };
}

export async function callOpenAi(opts: OpenAiCallOptions): Promise<ProviderCallResult> {
  if (!opts.apiKey) {
    return { success: false, error: 'OpenAI not configured', errorCode: 'openai_no_key' };
  }
  const model = opts.model ?? 'gpt-4o-mini';
  const fetchImpl = opts.fetchImpl ?? fetch;

  const messages: Array<{ role: 'system' | 'user'; content: string }> = [];
  if (opts.systemPrompt) messages.push({ role: 'system', content: opts.systemPrompt });
  messages.push({ role: 'user', content: opts.prompt });

  let r: Response;
  try {
    r = await fetchImpl('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: opts.maxTokens ?? 1500,
        temperature: opts.temperature ?? 0.6,
      }),
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'openai fetch failed',
      errorCode: 'openai_fetch_failed',
    };
  }

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return {
      success: false,
      error: `OpenAI ${r.status}: ${detail.slice(0, 200)}`,
      errorCode: `openai_${r.status}`,
    };
  }

  const data = (await r.json().catch(() => null)) as OpenAiResponse | null;
  if (!data) return { success: false, error: 'OpenAI returned non-JSON', errorCode: 'openai_parse_failed' };
  if (data.error) {
    return {
      success: false,
      error: data.error.message ?? 'OpenAI error',
      errorCode: `openai_${data.error.type ?? 'error'}`,
    };
  }
  const text = (data.choices?.[0]?.message?.content ?? '').trim();
  if (!text) return { success: false, error: 'Empty response', errorCode: 'empty_response' };

  return {
    success: true,
    text,
    promptTokens: data.usage?.prompt_tokens ?? 0,
    completionTokens: data.usage?.completion_tokens ?? 0,
  };
}
