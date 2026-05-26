/**
 * Per-model cost calculation in micro-USD.
 *
 * 1 USD = 1,000,000 micro-USD. All math is integer to avoid float drift.
 *
 * RATES LAST UPDATED: 2026-05-25.
 * Source: provider public pricing pages. Verify quarterly via the
 * Sentry alert "ai_pricing_table_out_of_date" if/when we wire it.
 *
 * The cost function NEVER throws. An unknown model returns 0 cost +
 * a SENTRY-flag value the gateway logs but does not block on — better
 * to under-report than to refuse service when a new model lands.
 */

export interface ModelRate {
  /** Price per 1,000,000 prompt tokens, in micro-USD. */
  promptPerMillionMicroUsd: number;
  /** Price per 1,000,000 completion tokens, in micro-USD. */
  completionPerMillionMicroUsd: number;
}

/**
 * Provider-prefixed model id → rate.
 * Keys are normalized to lowercase. Use `costMicroUsd` rather than
 * looking up directly.
 */
export const RATES: Record<string, ModelRate> = {
  // Google Gemini
  'gemini:gemini-2.0-flash':   { promptPerMillionMicroUsd:    75_000, completionPerMillionMicroUsd:   300_000 },
  'gemini:gemini-2.0-flash-exp': { promptPerMillionMicroUsd:  75_000, completionPerMillionMicroUsd:   300_000 },
  'gemini:gemini-1.5-flash':   { promptPerMillionMicroUsd:    75_000, completionPerMillionMicroUsd:   300_000 },
  'gemini:gemini-1.5-pro':     { promptPerMillionMicroUsd: 1_250_000, completionPerMillionMicroUsd: 5_000_000 },

  // Anthropic Claude
  'claude:claude-3-5-sonnet':  { promptPerMillionMicroUsd: 3_000_000, completionPerMillionMicroUsd: 15_000_000 },
  'claude:claude-3-5-haiku':   { promptPerMillionMicroUsd:   800_000, completionPerMillionMicroUsd:  4_000_000 },
  'claude:claude-3-haiku':     { promptPerMillionMicroUsd:   250_000, completionPerMillionMicroUsd:  1_250_000 },
  'claude:claude-3-opus':      { promptPerMillionMicroUsd:15_000_000, completionPerMillionMicroUsd: 75_000_000 },

  // OpenAI
  'openai:gpt-4o':             { promptPerMillionMicroUsd: 2_500_000, completionPerMillionMicroUsd: 10_000_000 },
  'openai:gpt-4o-mini':        { promptPerMillionMicroUsd:   150_000, completionPerMillionMicroUsd:    600_000 },

  // Hermes / self-hosted — no per-token cost
  'hermes:hermes-agent':       { promptPerMillionMicroUsd:         0, completionPerMillionMicroUsd:          0 },
};

export function modelKey(provider: string, model: string): string {
  return `${provider.trim().toLowerCase()}:${model.trim().toLowerCase()}`;
}

export interface CostInput {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface CostResult {
  microUsd: number;
  /** True when no rate was registered for (provider, model). */
  unknownModel: boolean;
}

export function costMicroUsd({ provider, model, promptTokens, completionTokens }: CostInput): CostResult {
  const rate = RATES[modelKey(provider, model)];
  if (!rate) {
    return { microUsd: 0, unknownModel: true };
  }
  // (tokens * rate_per_million) / 1_000_000 — integer math, rounds down.
  const promptCost     = Math.floor((Math.max(0, promptTokens)     * rate.promptPerMillionMicroUsd)     / 1_000_000);
  const completionCost = Math.floor((Math.max(0, completionTokens) * rate.completionPerMillionMicroUsd) / 1_000_000);
  return { microUsd: promptCost + completionCost, unknownModel: false };
}

export function microUsdToUsd(micro: number): number {
  return micro / 1_000_000;
}
