/**
 * Client for /api/grace/chat and /api/grace/memories — ADR-014.
 *
 * Replaces the direct generateAIStreamed/generateAIText calls in
 * GraceChatContext.tsx for the staff Ask GRACE surface: this transport
 * persists both sides of the turn server-side and injects the caller's
 * memory automatically, instead of being a stateless single-shot call.
 */

import { createLogger } from '../../utils/logger';
import { getClerkTokenProvider } from '../supabase';

const log = createLogger('grace-chat-service');

/**
 * JSON headers plus the caller's Clerk bearer token. Every fetch from the chat
 * door to an authenticated API route must go through this — a bare
 * `{ 'Content-Type': 'application/json' }` is a guaranteed 401 in the real
 * browser, which is exactly how /api/actions/propose failed on the live
 * tenant on 2026-09-04 ("I couldn't send that for approval: missing bearer
 * token") after passing every test that stubs Clerk.
 */
export async function buildHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  try {
    const provider = getClerkTokenProvider();
    const token = provider ? await provider() : null;
    if (token) headers.Authorization = `Bearer ${token}`;
  } catch {
    // Token retrieval failed; backend will reject with 401.
  }
  return headers;
}

async function parseJsonOrText(response: Response): Promise<Record<string, unknown>> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return await response.json();
  }
  const text = await response.text().catch(() => '');
  return text ? { error: text } : {};
}

function getProviderError(data: Record<string, unknown>, status: number): string {
  const error = data.error;
  const detail = data.detail;
  if (typeof error === 'string' && error.trim()) {
    const base = error.trim();
    if (typeof detail === 'string' && detail.trim() && !base.includes(detail.trim())) {
      return `${base}: ${detail.trim()}`;
    }
    return base;
  }
  if (typeof detail === 'string' && detail.trim()) return detail.trim();
  return `Request failed with status ${status}`;
}

export interface GraceTurnOptions {
  message: string;
  conversationId?: string | null;
  dataContext: string;
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface GraceTurnResult {
  streamed: boolean;
  error?: string;
  conversationId?: string;
}

export async function sendGraceTurn(opts: GraceTurnOptions): Promise<GraceTurnResult> {
  try {
    const response = await fetch('/api/grace/chat', {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({
        message: opts.message,
        conversationId: opts.conversationId ?? undefined,
        dataContext: opts.dataContext,
      }),
      signal: opts.signal,
    });

    const conversationId = response.headers.get('X-Conversation-Id') ?? undefined;

    if (!response.ok) {
      const data = await parseJsonOrText(response);
      return { streamed: false, error: getProviderError(data, response.status), conversationId };
    }
    if (!response.body) {
      return { streamed: false, error: 'Streaming unavailable', conversationId };
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let streamed = false;
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) {
        streamed = true;
        opts.onChunk(text);
      }
    }
    return { streamed, conversationId };
  } catch (e) {
    log.error('Grace chat stream error', e);
    return { streamed: false, error: e instanceof Error ? e.message : 'Network error' };
  }
}

export interface GraceHydrateMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface GraceHydrateResult {
  conversationId: string | null;
  messages: GraceHydrateMessage[];
}

/** Cross-session recall: loads the caller's most recent conversation. */
export async function hydrateGraceConversation(): Promise<GraceHydrateResult> {
  try {
    const response = await fetch('/api/grace/chat', { method: 'GET', headers: await buildHeaders() });
    if (!response.ok) return { conversationId: null, messages: [] };
    const data = await response.json();
    const conversation = data.conversation as { id: string } | null;
    return { conversationId: conversation?.id ?? null, messages: Array.isArray(data.messages) ? data.messages : [] };
  } catch (e) {
    log.error('Grace hydrate error', e);
    return { conversationId: null, messages: [] };
  }
}

/** One-time import of localStorage brain entries into server memory. */
export async function importBrainEntries(texts: string[]): Promise<{ imported: number } | null> {
  if (texts.length === 0) return null;
  try {
    const response = await fetch('/api/grace/memories', {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({ entries: texts.map(text => ({ text })) }),
    });
    if (!response.ok) return null;
    const data = await response.json();
    return { imported: typeof data.imported === 'number' ? data.imported : 0 };
  } catch (e) {
    log.error('Grace memory import error', e);
    return null;
  }
}

export interface EntityMemoryResult {
  reply: string | null;
  /** 'not_found' means fall through to the model — see entityMemory.ts. */
  status?: 'found' | 'ambiguous' | 'not_found';
  /** Server-resolved thread this turn was written to, so the next turn appends. */
  conversationId?: string;
}

/** Read-only canonical profile summary; authorization is enforced server-side. */
export async function retrieveEntityMemory(
  name: string,
  opts: { conversationId?: string; question?: string } = {},
): Promise<EntityMemoryResult> {
  try {
    const response = await fetch('/api/grace/entity-memory', {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({ name, conversationId: opts.conversationId, question: opts.question }),
    });
    const conversationId = response.headers.get('X-Conversation-Id') ?? undefined;
    if (!response.ok) {
      return {
        reply: response.status === 403 ? "You don't have permission to view that person's record." : null,
        conversationId,
      };
    }
    const data = await response.json() as { reply?: unknown; status?: unknown };
    const status = typeof data.status === 'string' ? data.status as EntityMemoryResult['status'] : undefined;
    return { reply: typeof data.reply === 'string' ? data.reply : null, status, conversationId };
  } catch (e) {
    log.error('Grace entity memory error', e);
    return { reply: null };
  }
}
