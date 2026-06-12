/**
 * AI gateway. Every server-side inference call goes through here.
 *
 * Pipeline:
 *   1. checkBudget(churchId) — refuse with 'over_cap' or 'hard_cut'
 *   2. call the provider (delegated to a callable passed in)
 *   3. recordUsage — fire-and-forget; latency + token counts + cost
 *
 * The provider call itself is NOT implemented here — that keeps the
 * gateway pure-functional and the existing adapters in api/_lib/aiProviders.ts
 * unchanged. Callers pass a `callProvider` closure that returns
 * `ProviderCallResult`. This decouples cost control (the gateway's job)
 * from inference (the adapter's job).
 *
 * Per-call shape:
 *   const result = await generate({ supabase, churchId, ... }, async () => callGemini(prompt));
 *
 * Budget refusals return { allowed: false, status: 'over_cap' | 'hard_cut', ... }
 * with the same details surfaced via checkBudget so the route can
 * compose a useful 402 body. No exception is thrown for budget refusals
 * — they're an expected outcome, not an error.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { checkBudget, BudgetCheck, BudgetStatus } from './budget.js';
import { recordUsage } from './usage.js';
import { moderate, type ModerationResult } from './moderation.js';

export interface ProviderCallResult {
  success: boolean;
  text?: string;
  error?: string;
  errorCode?: string;
  /** Token counts; both can be 0 if the provider doesn't report them. */
  promptTokens?: number;
  completionTokens?: number;
}

export interface GatewayRequest {
  supabase: SupabaseClient;
  churchId: string;
  feature: string;             // e.g. 'ask-grace', 'draft-reply', 'member-care'
  provider: string;            // e.g. 'gemini'
  model: string;               // e.g. 'gemini-2.0-flash'
  requestId?: string | null;
  actorClerkId?: string | null;
  /** Inject `Date` for tests. */
  now?: Date;
  /**
   * Optional INPUT text to send through OpenAI Moderation BEFORE the
   * provider call. When flagged, the call is refused with reason
   * 'moderation_input'. No-op without OPENAI_API_KEY.
   */
  moderateInput?: string;
  /**
   * When true, the provider's output text is sent through OpenAI
   * Moderation AFTER the call. When flagged, provider.success is
   * overridden to false with errorCode='moderation_output' and the
   * response text is redacted. No-op without OPENAI_API_KEY.
   */
  moderateOutput?: boolean;
  /** Test seam: inject moderation. */
  moderateImpl?: (text: string) => Promise<ModerationResult>;
}

export type ModerationReason = 'moderation_input' | 'moderation_output';

export type GatewayResult =
  | { allowed: false; budget: BudgetCheck; reason: Exclude<BudgetStatus, 'ok'> }
  | { allowed: false; budget: BudgetCheck; reason: ModerationReason; moderation: ModerationResult }
  | { allowed: true; budget: BudgetCheck; provider: ProviderCallResult; latencyMs: number; moderation?: { input?: ModerationResult; output?: ModerationResult } };

export async function generate(
  req: GatewayRequest,
  callProvider: () => Promise<ProviderCallResult>,
): Promise<GatewayResult> {
  const budget = await checkBudget(req.supabase, req.churchId, req.now);
  const mod = req.moderateImpl ?? moderate;

  if (budget.status !== 'ok') {
    // Don't even call the provider. Record a zero-cost row so the
    // refusal shows up in usage analytics — useful for "we hit budget"
    // dashboards even though it cost us nothing.
    void recordUsage(req.supabase, {
      churchId: req.churchId,
      provider: req.provider,
      model: req.model,
      feature: req.feature,
      promptTokens: 0,
      completionTokens: 0,
      success: false,
      errorCode: budget.status === 'hard_cut' ? 'budget_hard_cut' : 'budget_over_cap',
      latencyMs: 0,
      requestId: req.requestId,
      actorClerkId: req.actorClerkId,
    });

    return { allowed: false, budget, reason: budget.status };
  }

  // INPUT moderation (when requested + key configured). Flagged inputs
  // are refused before we spend a single token at the upstream provider.
  let inputModeration: ModerationResult | undefined;
  if (req.moderateInput) {
    inputModeration = await mod(req.moderateInput);
    if (inputModeration.flagged) {
      void recordUsage(req.supabase, {
        churchId: req.churchId,
        provider: req.provider,
        model: req.model,
        feature: req.feature,
        promptTokens: 0,
        completionTokens: 0,
        success: false,
        errorCode: 'moderation_input',
        latencyMs: 0,
        requestId: req.requestId,
        actorClerkId: req.actorClerkId,
      });
      return { allowed: false, budget, reason: 'moderation_input', moderation: inputModeration };
    }
  }

  const started = Date.now();
  let result: ProviderCallResult;
  try {
    result = await callProvider();
  } catch (err) {
    result = {
      success: false,
      error: err instanceof Error ? err.message : 'provider call threw',
      errorCode: 'provider_exception',
    };
  }
  const latencyMs = Date.now() - started;

  // OUTPUT moderation. Catches model hallucinations / jailbreaks that
  // produced harmful content despite a clean input. Redacts the text
  // and flips success to false so callers see a moderation block.
  let outputModeration: ModerationResult | undefined;
  if (req.moderateOutput && result.success && result.text) {
    outputModeration = await mod(result.text);
    if (outputModeration.flagged) {
      result = {
        success: false,
        text: undefined,
        error: 'Output blocked by moderation',
        errorCode: 'moderation_output',
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
      };
    }
  }

  void recordUsage(req.supabase, {
    churchId: req.churchId,
    provider: req.provider,
    model: req.model,
    feature: req.feature,
    promptTokens: result.promptTokens ?? 0,
    completionTokens: result.completionTokens ?? 0,
    success: result.success,
    errorCode: result.errorCode,
    latencyMs,
    requestId: req.requestId,
    actorClerkId: req.actorClerkId,
  });

  const moderationSummary: { input?: ModerationResult; output?: ModerationResult } | undefined =
    inputModeration || outputModeration
      ? { input: inputModeration, output: outputModeration }
      : undefined;

  return { allowed: true, budget, provider: result, latencyMs, moderation: moderationSummary };
}
