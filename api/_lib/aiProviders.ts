export interface ProviderEnv {
  [key: string]: string | undefined;
  GEMINI_API_KEY?: string;
  HERMES_API_URL?: string;
  HERMES_API_KEY?: string;
  HERMES_MODEL?: string;
  HERMES_API_PATH?: string;
}

export interface AIProviderResult {
  success: boolean;
  text?: string;
  error?: string;
  model?: string;
}

export interface HermesConfig {
  configured: boolean;
  url?: string;
  apiKey?: string;
  model: string;
  path: string;
}

export type FetchLike = typeof fetch;

export function sanitizePrompt(prompt: string, maxLength = 10000): string {
  return String(prompt || '').trim().slice(0, maxLength);
}

export function buildFullPrompt(prompt: string, context?: string): string {
  const sanitizedPrompt = sanitizePrompt(prompt);
  if (!context || typeof context !== 'string') return sanitizedPrompt;
  const sanitizedContext = sanitizePrompt(context, 5000);
  return `Context: ${sanitizedContext}\n\nRequest: ${sanitizedPrompt}`;
}

export function isGeminiQuotaError(message: string): boolean {
  return /quota|spending cap|spend cap|resource exhausted|RESOURCE_EXHAUSTED|429/i.test(message);
}

export function getHermesConfig(env: ProviderEnv = process.env): HermesConfig {
  const url = env.HERMES_API_URL?.trim().replace(/\/$/, '');
  return {
    configured: Boolean(url),
    url,
    apiKey: env.HERMES_API_KEY?.trim(),
    model: env.HERMES_MODEL?.trim() || 'hermes-agent',
    path: env.HERMES_API_PATH?.trim() || '/v1/chat/completions',
  };
}

function hermesEndpoint(config: HermesConfig): string | null {
  if (!config.url) return null;
  const path = config.path.startsWith('/') ? config.path : `/${config.path}`;
  return `${config.url}${path}`;
}

function parseHermesText(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const data = payload as Record<string, unknown>;

  if (typeof data.text === 'string') return data.text;
  if (typeof data.response === 'string') return data.response;
  if (typeof data.content === 'string') return data.content;

  const choices = data.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const first = choices[0] as Record<string, unknown> | undefined;
    const message = first?.message as Record<string, unknown> | undefined;
    if (typeof message?.content === 'string') return message.content;
    if (typeof first?.text === 'string') return first.text;
  }

  return undefined;
}

export async function generateWithHermes({
  prompt,
  maxTokens = 1024,
  env = process.env,
  fetchImpl = fetch,
}: {
  prompt: string;
  maxTokens?: number;
  env?: ProviderEnv;
  fetchImpl?: FetchLike;
}): Promise<AIProviderResult> {
  const config = getHermesConfig(env);
  const endpoint = hermesEndpoint(config);
  if (!config.configured || !endpoint) {
    return { success: false, error: 'Hermes brain not configured' };
  }

  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (config.apiKey) headers.Authorization = `Bearer ${config.apiKey}`;

    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: 'You are Grace AI inside a church CRM. Be concise. For CRM writes, propose structured <action>{...}</action> blocks only; the app will show editable confirmation cards before saving.',
          },
          { role: 'user', content: prompt },
        ],
        max_tokens: Math.min(maxTokens || 1024, 4096),
        temperature: 0.7,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = payload && typeof payload === 'object' && 'error' in payload
        ? String((payload as { error: unknown }).error)
        : `Hermes request failed with status ${response.status}`;
      return { success: false, error };
    }

    const text = parseHermesText(payload);
    if (!text) return { success: false, error: 'Hermes brain returned no text' };

    return {
      success: true,
      text,
      model: typeof (payload as Record<string, unknown>).model === 'string'
        ? (payload as Record<string, string>).model
        : config.model,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Hermes brain request failed',
    };
  }
}
