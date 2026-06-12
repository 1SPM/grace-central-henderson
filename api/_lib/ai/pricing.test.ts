import { describe, it, expect } from 'vitest';
import { costMicroUsd, microUsdToUsd, modelKey, RATES } from './pricing.js';

describe('ai/pricing', () => {
  it('modelKey normalizes case + trims', () => {
    expect(modelKey('Gemini', ' gemini-2.0-flash ')).toBe('gemini:gemini-2.0-flash');
  });

  it('costs a Gemini 2.0 Flash call correctly (75¢/M in, $3/M out)', () => {
    // 1000 prompt + 500 completion tokens
    // prompt:    1000 * 75_000 / 1_000_000 = 75 micro-USD
    // completion: 500 * 300_000 / 1_000_000 = 150 micro-USD
    // total: 225 micro-USD = $0.000225
    const r = costMicroUsd({ provider: 'gemini', model: 'gemini-2.0-flash', promptTokens: 1000, completionTokens: 500 });
    expect(r).toEqual({ microUsd: 225, unknownModel: false });
  });

  it('costs a Claude 3.5 Sonnet call correctly ($3/M in, $15/M out)', () => {
    // 1000 prompt + 500 completion = 3000 + 7500 = 10500 micro-USD = $0.0105
    const r = costMicroUsd({ provider: 'claude', model: 'claude-3-5-sonnet', promptTokens: 1000, completionTokens: 500 });
    expect(r).toEqual({ microUsd: 10500, unknownModel: false });
  });

  it('costs an OpenAI gpt-4o-mini call correctly ($0.15/M in, $0.60/M out)', () => {
    const r = costMicroUsd({ provider: 'openai', model: 'gpt-4o-mini', promptTokens: 1000, completionTokens: 1000 });
    expect(r).toEqual({ microUsd: 750, unknownModel: false });
  });

  it('flags unknown models with cost 0 — never throws', () => {
    const r = costMicroUsd({ provider: 'unknown', model: 'magic', promptTokens: 999, completionTokens: 999 });
    expect(r).toEqual({ microUsd: 0, unknownModel: true });
  });

  it('clamps negative token counts to zero', () => {
    const r = costMicroUsd({ provider: 'gemini', model: 'gemini-2.0-flash', promptTokens: -5, completionTokens: -5 });
    expect(r.microUsd).toBe(0);
  });

  it('Hermes is priced at zero (self-hosted)', () => {
    const r = costMicroUsd({ provider: 'hermes', model: 'hermes-agent', promptTokens: 100_000, completionTokens: 100_000 });
    expect(r.microUsd).toBe(0);
  });

  it('rate table is non-empty and well-formed', () => {
    expect(Object.keys(RATES).length).toBeGreaterThan(5);
    for (const [k, v] of Object.entries(RATES)) {
      expect(v.promptPerMillionMicroUsd).toBeGreaterThanOrEqual(0);
      expect(v.completionPerMillionMicroUsd).toBeGreaterThanOrEqual(0);
      expect(k).toMatch(/^[a-z]+:[a-z0-9.\-_]+$/);
    }
  });

  it('microUsdToUsd is a plain divide', () => {
    expect(microUsdToUsd(1_000_000)).toBe(1);
    expect(microUsdToUsd(225)).toBeCloseTo(0.000225);
  });
});
