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

// ---------------------------------------------------------------------
// Tool-calling variant — additive, does not change callClaude() above.
// Used by the member GRACE assistant (api/_lib/ai/assistant-runtime.ts)
// for its multi-turn tool-execution loop — the Claude counterpart to
// callGeminiWithTools in ./gemini.ts. Anthropic's tool-use turn shape
// differs from Gemini's: there's no separate 'function' role — a tool
// result is a 'user' message containing tool_result content blocks, and
// the model's own tool_use blocks (with their ids) must be replayed back
// verbatim in the next request for Anthropic to match them up.
// ---------------------------------------------------------------------

export interface ClaudeToolDeclaration {
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, { type: string; description?: string; enum?: string[]; items?: unknown }>;
    required?: string[];
  };
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string };

export interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string | ClaudeContentBlock[];
}

export interface ClaudeToolCall {
  id: string;
  name: string;
  args: Record<string, unknown>;
}

export interface ClaudeToolCallResult {
  success: boolean;
  text?: string;
  toolCalls?: ClaudeToolCall[];
  /** The raw assistant content blocks — replay verbatim as the next
   *  request's assistant message when toolCalls is non-empty. */
  assistantContent?: ClaudeContentBlock[];
  error?: string;
  errorCode?: string;
  promptTokens?: number;
  completionTokens?: number;
}

export interface ClaudeToolCallOptions {
  apiKey: string;
  model?: string;
  systemInstruction: string;
  messages: ClaudeMessage[];
  tools: ClaudeToolDeclaration[];
  maxTokens?: number;
  temperature?: number;
  workspaceId?: string;
  fetchImpl?: typeof fetch;
}

interface ClaudeToolResponse {
  content?: ClaudeContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number };
  error?: { type?: string; message?: string };
}

export async function callClaudeWithTools(opts: ClaudeToolCallOptions): Promise<ClaudeToolCallResult> {
  if (!opts.apiKey) {
    return { success: false, error: 'Claude not configured', errorCode: 'claude_no_key' };
  }
  const model = opts.model ?? DEFAULT_CLAUDE_MODEL;
  const fetchImpl = opts.fetchImpl ?? fetch;
  const headers = claudeHeaders({ apiKey: opts.apiKey, workspaceId: opts.workspaceId } as ClaudeCallOptions);

  let r: Response;
  try {
    r = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1000,
        temperature: opts.temperature ?? 0.4,
        system: opts.systemInstruction,
        messages: opts.messages,
        tools: opts.tools,
      }),
    });
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'claude fetch failed', errorCode: 'claude_fetch_failed' };
  }

  if (!r.ok) {
    const detail = await r.text().catch(() => '');
    return { success: false, error: `Claude ${r.status}: ${detail.slice(0, 200)}`, errorCode: `claude_${r.status}` };
  }

  const data = (await r.json().catch(() => null)) as ClaudeToolResponse | null;
  if (!data) return { success: false, error: 'Claude returned non-JSON', errorCode: 'claude_parse_failed' };
  if (data.error) return { success: false, error: data.error.message ?? 'Claude error', errorCode: `claude_${data.error.type ?? 'error'}` };

  const blocks = data.content ?? [];
  const usage = {
    promptTokens: data.usage?.input_tokens ?? 0,
    completionTokens: data.usage?.output_tokens ?? 0,
  };

  const toolCalls = blocks
    .filter((b): b is Extract<ClaudeContentBlock, { type: 'tool_use' }> => b.type === 'tool_use')
    .map(b => ({ id: b.id, name: b.name, args: b.input ?? {} }));

  if (toolCalls.length > 0) {
    return { success: true, toolCalls, assistantContent: blocks, ...usage };
  }

  const text = blocks.filter((b): b is Extract<ClaudeContentBlock, { type: 'text' }> => b.type === 'text').map(b => b.text).join('').trim();
  if (!text) return { success: false, error: 'Empty response', errorCode: 'empty_response', ...usage };

  return { success: true, text, ...usage };
}
