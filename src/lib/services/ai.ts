/**
 * AI Service - Frontend client for Gemini API integration
 */

import { createLogger } from '../../utils/logger';
import { getClerkTokenProvider } from '../supabase';

const log = createLogger('ai-service');

/**
 * Attaches the Clerk session token. The backend requires a valid Bearer
 * token on every request (TD-033) — calls without one receive a 401.
 */
async function buildHeaders(): Promise<Record<string, string>> {
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

export interface AIGenerateOptions {
  prompt: string;
  context?: string;
  maxTokens?: number;
}

export interface AIGenerateResult {
  success: boolean;
  text?: string;
  error?: string;
  model?: string;
}

const API_ENDPOINT = '/api/ai/generate';

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
  if (status === 500) {
    return 'AI server unreachable. Run `npm run dev:api` in a second terminal (port 3010) and add GEMINI_API_KEY to .env.local.';
  }
  if (status === 503) {
    return 'AI not configured. Add GEMINI_API_KEY to .env.local (copy from Vercel → Settings → Environment Variables).';
  }
  return `Request failed with status ${status}`;
}

/**
 * Generate text using the Gemini AI model
 */
export async function generateAIText(options: AIGenerateOptions): Promise<AIGenerateResult> {
  const { prompt, context, maxTokens } = options;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({
        prompt,
        context,
        maxTokens,
      }),
    });

    const data = await parseJsonOrText(response);

    if (!response.ok) {
      return {
        success: false,
        error: getProviderError(data, response.status),
      };
    }

    return {
      success: true,
      text: typeof data.text === 'string' ? data.text : '',
      model: typeof data.model === 'string' ? data.model : undefined,
    };
  } catch (error) {
    log.error('AI service error', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    };
  }
}

export interface StreamOptions extends AIGenerateOptions {
  onChunk: (chunk: string) => void;
  signal?: AbortSignal;
}

export interface AIStreamResult {
  streamed: boolean;
  error?: string;
}

/**
 * Stream text from the Gemini AI model. Calls onChunk as tokens arrive.
 * Returns { streamed: false, error } when the stream fails so callers
 * can surface the message without a redundant non-stream retry.
 */
export async function generateAIStreamed({ prompt, maxTokens, onChunk, signal }: StreamOptions): Promise<AIStreamResult> {
  try {
    const response = await fetch(`${API_ENDPOINT}?stream=1`, {
      method: 'POST',
      headers: await buildHeaders(),
      body: JSON.stringify({ prompt, maxTokens }),
      signal,
    });

    if (!response.ok) {
      const data = await parseJsonOrText(response);
      return { streamed: false, error: getProviderError(data, response.status) };
    }

    if (!response.body) {
      return { streamed: false, error: 'Streaming unavailable' };
    }

    const contentType = response.headers.get('content-type') || '';
    // If the server didn't honor the stream flag, bail — caller falls back.
    if (!contentType.includes('text/plain') && !contentType.includes('text/event-stream')) {
      return { streamed: false };
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
        onChunk(text);
      }
    }
    return { streamed };
  } catch (e) {
    log.error('AI stream error', e);
    return {
      streamed: false,
      error: e instanceof Error ? e.message : 'Network error',
    };
  }
}

// ============================================
// Pre-built prompts for common church CRM tasks
// ============================================

/**
 * Generate a personalized welcome message for a new member
 */
export async function generateWelcomeMessage(
  firstName: string,
  churchName: string,
  interests?: string[]
): Promise<AIGenerateResult> {
  const interestContext = interests?.length
    ? `They have expressed interest in: ${interests.join(', ')}.`
    : '';

  return generateAIText({
    prompt: `Write a warm, personal welcome message for ${firstName} who just joined ${churchName}.
${interestContext}
Keep it under 100 words, friendly, and inviting. Don't use overly religious language.`,
    maxTokens: 256,
  });
}

/**
 * Generate a personalized thank-you message for a donation
 */
export async function generateDonationThankYou(
  firstName: string,
  amount: number,
  fund: string,
  churchName: string,
  isFirstTime: boolean
): Promise<AIGenerateResult> {
  const firstTimeNote = isFirstTime
    ? 'This is their first donation to the church.'
    : '';

  return generateAIText({
    prompt: `Write a heartfelt thank-you message for ${firstName} who donated $${amount.toFixed(2)} to the ${fund} fund at ${churchName}.
${firstTimeNote}
Keep it under 80 words, genuine, and appreciative. Mention the impact of their generosity without being preachy.`,
    maxTokens: 200,
  });
}

/**
 * Generate a birthday greeting
 */
export async function generateBirthdayGreeting(
  firstName: string,
  churchName: string
): Promise<AIGenerateResult> {
  return generateAIText({
    prompt: `Write a warm birthday greeting for ${firstName} from ${churchName}.
Keep it under 50 words, cheerful, and personal. Include a brief blessing or well-wish.`,
    maxTokens: 128,
  });
}

/**
 * Generate follow-up talking points for a visitor
 */
export async function generateFollowUpTalkingPoints(
  visitorName: string,
  visitDate: string,
  notes?: string
): Promise<AIGenerateResult> {
  const notesContext = notes ? `Notes from their visit: ${notes}` : '';

  return generateAIText({
    prompt: `Generate 3-4 brief talking points for a follow-up call with ${visitorName} who visited on ${visitDate}.
${notesContext}
Focus on: making them feel remembered, asking about their experience, and naturally inviting them back.
Format as a bulleted list.`,
    maxTokens: 300,
  });
}

/**
 * Summarize prayer requests for a weekly digest
 */
export async function summarizePrayerRequests(
  requests: Array<{ name: string; request: string }>
): Promise<AIGenerateResult> {
  if (requests.length === 0) {
    return { success: true, text: 'No prayer requests this week.' };
  }

  const requestList = requests
    .map((r) => `- ${r.name}: ${r.request}`)
    .join('\n');

  return generateAIText({
    prompt: `Summarize these prayer requests into a concise weekly prayer digest for church staff:

${requestList}

Group similar requests together. Keep names but summarize the requests briefly.
Format with clear sections if there are different categories (health, family, work, etc.).`,
    context: 'This is for internal church staff to pray over during the week.',
    maxTokens: 500,
  });
}

/**
 * Generate a small group discussion question based on a topic
 */
export async function generateDiscussionQuestions(
  topic: string,
  numberOfQuestions: number = 3
): Promise<AIGenerateResult> {
  return generateAIText({
    prompt: `Generate ${numberOfQuestions} thoughtful small group discussion questions about: "${topic}"

Questions should:
- Encourage personal reflection and sharing
- Be open-ended (not yes/no)
- Progress from easier to deeper
- Be appropriate for a church small group setting

Format as a numbered list.`,
    maxTokens: 400,
  });
}
