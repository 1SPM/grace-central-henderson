/**
 * Anthropic Claude adapter.
 *
 * Returns a ProviderCallResult — never throws. No-op (returns failure)
 * without ANTHROPIC_API_KEY so a misconfigured deployment doesn't
 * silently mis-route Claude calls to a fallback.
 */

import type { ProviderCallResult } from '../gateway.js';

export interface ClaudeCallOptions {
  apiKey: string;
  model?: string;                       // default claude-3-5-sonnet-20241022
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;                   // default 1500
  temperature?: number;                 // default 0.6
  fetchImpl?: typeof fetch;
}

interface ClaudeResponse {
  content?: Array<{ type: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

export async function callClaude(opts: ClaudeCallOptions): Promise<ProviderCallResult> {
  if (!opts.apiKey) {
    return { success: false, error: 'Claude not configured', errorCode: 'claude_no_key' };
  }
  const model = opts.model ?? 'claude-3-5-sonnet-20241022';
  const fetchImpl = opts.fetchImpl ?? fetch;

  let r: Response;
  try {
    r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1500,
        temperature: opts.temperature ?? 0.6,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: opts.prompt }],
      }),
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'claude fetch failed',
      errorCode: 'claude_fetch_failed',
    };
  }

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return {
      success: false,
      error: `Claude ${r.status}: ${detail.slice(0, 200)}`,
      errorCode: `claude_${r.status}`,
    };
  }

  const data = (await r.json().catch(() => null)) as ClaudeResponse | null;
  if (!data) return { success: false, error: 'Claude returned non-JSON', errorCode: 'claude_parse_failed' };
  if (data.error) {
    return {
      success: false,
      error: data.error.message ?? 'Claude error',
      errorCode: `claude_${data.error.type ?? 'error'}`,
    };
  }
  const text = (data.content?.find((c) => c.type === 'text')?.text ?? '').trim();
  if (!text) return { success: false, error: 'Empty response', errorCode: 'empty_response' };

  return {
    success: true,
    text,
    promptTokens: data.usage?.input_tokens ?? 0,
    completionTokens: data.usage?.output_tokens ?? 0,
  };
}
