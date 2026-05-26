/**
 * Token-usage recorder. Writes one row to `token_usage` per inference.
 *
 * Fire-and-forget from the gateway: a failed insert is logged + sent
 * to Sentry but never bubbles out to the user. Better to under-report
 * than to refuse service when the metering DB hiccups — the audit
 * trail in audit_logs still captures that the call happened.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { costMicroUsd } from './pricing';

export interface RecordUsageInput {
  churchId: string | null;
  provider: string;
  model: string;
  feature: string;
  promptTokens: number;
  completionTokens: number;
  success: boolean;
  errorCode?: string;
  latencyMs?: number;
  requestId?: string | null;
  actorClerkId?: string | null;
  /** Override cost when we want to record promo / pre-priced calls. */
  costMicroUsdOverride?: number;
}

interface UsageRow {
  church_id: string | null;
  provider: string;
  model: string;
  feature: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_micro_usd: number;
  success: boolean;
  error_code: string | null;
  latency_ms: number | null;
  request_id: string | null;
  actor_clerk_id: string | null;
}

export function buildUsageRow(input: RecordUsageInput): UsageRow {
  const cost = input.costMicroUsdOverride ?? costMicroUsd({
    provider: input.provider,
    model: input.model,
    promptTokens: input.promptTokens,
    completionTokens: input.completionTokens,
  }).microUsd;

  return {
    church_id: input.churchId,
    provider: input.provider,
    model: input.model,
    feature: input.feature,
    prompt_tokens: Math.max(0, Math.floor(input.promptTokens)),
    completion_tokens: Math.max(0, Math.floor(input.completionTokens)),
    cost_micro_usd: Math.max(0, Math.floor(cost)),
    success: input.success,
    error_code: input.errorCode ?? null,
    latency_ms: input.latencyMs ?? null,
    request_id: input.requestId ?? null,
    actor_clerk_id: input.actorClerkId ?? null,
  };
}

export async function recordUsage(
  supabase: SupabaseClient,
  input: RecordUsageInput,
): Promise<void> {
  const row = buildUsageRow(input);
  try {
    const { error } = await supabase.from('token_usage').insert(row);
    if (error) {
      throw new Error(`token_usage insert failed: ${error.message}`);
    }
  } catch (err) {
    console.error('[usage] write failed', {
      provider: row.provider,
      model: row.model,
      feature: row.feature,
      church_id: row.church_id,
      error: err instanceof Error ? err.message : String(err),
    });
    // Best-effort Sentry. Same pattern as audit middleware.
    void import('../../instrument').then(({ Sentry, sentryEnabled }) => {
      if (sentryEnabled) {
        Sentry.withScope((scope) => {
          scope.setContext('usage_row', row);
          Sentry.captureException(err);
        });
      }
    }).catch(() => { /* Sentry off; already logged locally */ });
  }
}
