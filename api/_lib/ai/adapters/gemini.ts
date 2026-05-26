/**
 * Gemini adapter.
 *
 * Returns a ProviderCallResult — never throws. Called by the gateway
 * via an injected closure, so the gateway stays decoupled from any
 * specific upstream.
 */

import type { ProviderCallResult } from '../gateway';

export interface GeminiCallOptions {
  apiKey: string;
  model?: string;                      // default gemini-2.5-flash
  prompt: string;
  maxOutputTokens?: number;            // default 1500
  temperature?: number;                // default 0.6
  thinkingBudget?: number;             // default 0 (Sprint 2 fix — 2.5 thinks by default)
  fetchImpl?: typeof fetch;
}

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
  error?: { message?: string; code?: number | string };
}

export async function callGemini(opts: GeminiCallOptions): Promise<ProviderCallResult> {
  const model = opts.model ?? 'gemini-2.5-flash';
  const fetchImpl = opts.fetchImpl ?? fetch;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`;

  let r: Response;
  try {
    r = await fetchImpl(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: opts.prompt }] }],
        generationConfig: {
          maxOutputTokens: opts.maxOutputTokens ?? 1500,
          temperature: opts.temperature ?? 0.6,
          // thinkingBudget=0 is the Sprint 2 carried-over fix: Gemini
          // 2.5-flash defaults to ~1s of internal "thinking" tokens
          // we pay for and don't see. Disable for cheaper + faster.
          thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 0 },
        },
      }),
    });
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'gemini fetch failed',
      errorCode: 'gemini_fetch_failed',
    };
  }

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return {
      success: false,
      error: `Gemini ${r.status}: ${detail.slice(0, 200)}`,
      errorCode: `gemini_${r.status}`,
    };
  }

  const data = (await r.json().catch(() => null)) as GeminiResponse | null;
  if (!data) {
    return { success: false, error: 'Gemini returned non-JSON', errorCode: 'gemini_parse_failed' };
  }
  if (data.error) {
    return { success: false, error: data.error.message ?? 'Gemini error', errorCode: `gemini_${data.error.code ?? 'error'}` };
  }
  const text = (data.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  if (!text) return { success: false, error: 'Empty response', errorCode: 'empty_response' };

  return {
    success: true,
    text,
    promptTokens: data.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: data.usageMetadata?.candidatesTokenCount ?? 0,
  };
}
