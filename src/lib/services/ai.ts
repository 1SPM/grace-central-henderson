/**
 * AI Service - Frontend client for Gemini API integration
 */

import { createLogger } from '../../utils/logger';

const log = createLogger('ai-service');

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

/**
 * Generate text using the Gemini AI model
 */
export async function generateAIText(options: AIGenerateOptions): Promise<AIGenerateResult> {
  const { prompt, context, maxTokens } = options;

  try {
    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        context,
        maxTokens,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const baseError = data.error || `Request failed with status ${response.status}`;
      const withDetail = data.detail ? `${baseError} — ${data.detail}` : baseError;
      return {
        success: false,
        error: withDetail,
      };
    }

    return {
      success: true,
      text: data.text,
      model: data.model,
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

/**
 * Stream text from the Gemini AI model. Calls onChunk as tokens arrive.
 * If streaming isn't available (e.g. server misconfigured), returns without
 * invoking onChunk so the caller can fall back to generateAIText.
 */
export async function generateAIStreamed({ prompt, maxTokens, onChunk, signal }: StreamOptions): Promise<void> {
  try {
    const response = await fetch(`${API_ENDPOINT}?stream=1`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, maxTokens }),
      signal,
    });

    if (!response.ok || !response.body) return;

    const contentType = response.headers.get('content-type') || '';
    // If the server didn't honor the stream flag, bail — caller falls back.
    if (!contentType.includes('text/plain') && !contentType.includes('text/event-stream')) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      const text = decoder.decode(value, { stream: true });
      if (text) onChunk(text);
    }
  } catch (e) {
    log.error('AI stream error', e);
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
