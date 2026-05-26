/**
 * OpenAI Moderation API wrapper.
 *
 * Two gates wrap each AI call when enabled:
 *   - INPUT moderation: block before we send a prompt to the LLM
 *   - OUTPUT moderation: block before we surface the response to the user
 *
 * The OpenAI Moderation API is free, so we don't meter it through the
 * gateway. Per-call latency is ~150ms; we pay it twice when both gates
 * are on. Tolerable next to a ~1s Gemini call.
 *
 * No-op when OPENAI_API_KEY is absent: returns { flagged: false,
 * skipped: true }. This is INTENTIONAL — running a self-hosted-only
 * deployment without OpenAI should not break the AI path. The skip is
 * recorded in token_usage.error_code so it shows up in audit.
 *
 * Categories surfaced: 'sexual', 'hate', 'harassment', 'self-harm',
 * 'sexual/minors', 'hate/threatening', 'violence/graphic', 'self-harm/intent',
 * 'self-harm/instructions', 'harassment/threatening', 'violence'.
 * Booleans, plus per-category numeric scores (0-1).
 */

const MODERATION_URL = 'https://api.openai.com/v1/moderations';
const MODERATION_MODEL = 'omni-moderation-latest';

export interface ModerationResult {
  flagged: boolean;
  /** True when moderation was skipped (no key, or fetch error). Treated as not-flagged. */
  skipped: boolean;
  /** Reason for skip, if applicable. */
  skipReason?: 'no_api_key' | 'request_failed' | 'empty_input';
  /** Categories that tripped, e.g. ['hate', 'harassment']. Empty when not flagged. */
  flaggedCategories: string[];
  /** Raw OpenAI response object, for audit logging. Null when skipped. */
  raw: unknown;
}

interface ModerationOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

interface OpenAiModerationResponse {
  id?: string;
  model?: string;
  results?: Array<{
    flagged?: boolean;
    categories?: Record<string, boolean>;
    category_scores?: Record<string, number>;
  }>;
}

function notFlagged(skipReason?: ModerationResult['skipReason']): ModerationResult {
  return { flagged: false, skipped: Boolean(skipReason), skipReason, flaggedCategories: [], raw: null };
}

export async function moderate(
  text: string,
  opts: ModerationOptions = {},
): Promise<ModerationResult> {
  const apiKey = (opts.apiKey ?? process.env.OPENAI_API_KEY ?? '').trim();
  const fetchImpl = opts.fetchImpl ?? fetch;

  if (!apiKey) return notFlagged('no_api_key');
  const trimmed = String(text || '').trim();
  if (!trimmed) return notFlagged('empty_input');

  try {
    const r = await fetchImpl(MODERATION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: MODERATION_MODEL, input: trimmed }),
    });
    if (!r.ok) {
      // Fail OPEN: moderation outages should not block legitimate calls.
      // The skip is recorded; if an operator sees a spike in moderation
      // skips they can investigate. Better than denying service to every
      // user when OpenAI is down.
      console.warn('[moderation] non-200', r.status);
      return notFlagged('request_failed');
    }
    const payload = (await r.json().catch(() => null)) as OpenAiModerationResponse | null;
    const result = payload?.results?.[0];
    if (!result) return notFlagged('request_failed');

    const flagged = Boolean(result.flagged);
    const flaggedCategories = result.categories
      ? Object.entries(result.categories)
          .filter(([, v]) => v === true)
          .map(([k]) => k)
      : [];

    return { flagged, skipped: false, flaggedCategories, raw: payload };
  } catch (err) {
    console.warn('[moderation] request threw', err);
    return notFlagged('request_failed');
  }
}
