/**
 * Anthropic Claude adapter.
 *
 * Returns a ProviderCallResult — never throws. No-op (returns failure)
 * without ANTHROPIC_API_KEY so a misconfigured deployment doesn't
 * silently mis-route Claude calls to a fallback.
 */

import type { ProviderCallResult } from '../gateway.js';

/** Fast/cheap tier — mirrors why Gemini Flash was the original chat+extraction model. */
export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

export interface ClaudeCallOptions {
  apiKey: string;
  model?: string;                       // default DEFAULT_CLAUDE_MODEL
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;                   // default 1500
  temperature?: number;                 // default 0.6
  /** Required by Anthropic when apiKey is an identity-linked key — omit
   *  for a standard workspace/org-wide key. */
  workspaceId?: string;
  fetchImpl?: typeof fetch;
}

function claudeHeaders(opts: ClaudeCallOptions): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': opts.apiKey,
    'anthropic-version': '2023-06-01',
  };
  if (opts.workspaceId) headers['anthropic-workspace-id'] = opts.workspaceId;
  return headers;
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
  const model = opts.model ?? DEFAULT_CLAUDE_MODEL;
  const fetchImpl = opts.fetchImpl ?? fetch;

  let r: Response;
  try {
    r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: claudeHeaders(opts),
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

// ---------------------------------------------------------------------
// Streaming variant — additive, does not change callClaude() above.
// Used by api/grace/_chat.ts (ADR-014) via gateway.generateStreamed().
// Anthropic's Messages API streams as SSE (no SDK dependency in this
// codebase, so parsed by hand — same fetch-based approach as callClaude
// above): content_block_delta events carry the text; message_start's
// usage.input_tokens and message_delta's usage.output_tokens carry cost.
// ---------------------------------------------------------------------

interface ClaudeStreamEvent {
  type?: string;
  message?: { usage?: { input_tokens?: number } };
  delta?: { type?: string; text?: string; stop_reason?: string };
  usage?: { output_tokens?: number };
  error?: { type?: string; message?: string };
}

export async function callClaudeStream(
  opts: ClaudeCallOptions,
  onChunk: (text: string) => void,
): Promise<ProviderCallResult> {
  if (!opts.apiKey) {
    return { success: false, error: 'Claude not configured', errorCode: 'claude_no_key' };
  }
  const model = opts.model ?? DEFAULT_CLAUDE_MODEL;
  const fetchImpl = opts.fetchImpl ?? fetch;

  let r: Response;
  try {
    r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: claudeHeaders(opts),
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1500,
        temperature: opts.temperature ?? 0.6,
        system: opts.systemPrompt,
        messages: [{ role: 'user', content: opts.prompt }],
        stream: true,
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
  if (!r.body) {
    return { success: false, error: 'Claude returned no stream body', errorCode: 'claude_no_body' };
  }

  let text = '';
  let promptTokens = 0;
  let completionTokens = 0;
  const reader = r.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line; each frame is one or
      // more "field: value" lines. We only care about "data:".
      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? ''; // last element may be an incomplete frame
      for (const frame of frames) {
        const dataLine = frame.split('\n').find(l => l.startsWith('data:'));
        if (!dataLine) continue;
        const json = dataLine.slice(5).trim();
        if (!json) continue;
        let event: ClaudeStreamEvent;
        try {
          event = JSON.parse(json);
        } catch {
          continue;
        }
        if (event.type === 'error' || event.error) {
          return {
            success: false,
            error: event.error?.message ?? 'Claude stream error',
            errorCode: `claude_${event.error?.type ?? 'stream_error'}`,
          };
        }
        if (event.type === 'message_start') {
          promptTokens = event.message?.usage?.input_tokens ?? 0;
        } else if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta' && event.delta.text) {
          text += event.delta.text;
          onChunk(event.delta.text);
        } else if (event.type === 'message_delta') {
          completionTokens = event.usage?.output_tokens ?? completionTokens;
        }
      }
    }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'claude stream read failed',
      errorCode: 'claude_stream_read_failed',
      text: text || undefined,
      promptTokens,
      completionTokens,
    };
  }

  if (!text) return { success: false, error: 'Empty response', errorCode: 'empty_response', promptTokens, completionTokens };
  return { success: true, text, promptTokens, completionTokens };
}
