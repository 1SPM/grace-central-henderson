import { describe, it, expect } from 'vitest';
import { countErrors, API_TYPECHECK_BASELINE } from './api-typecheck-ratchet.js';

describe('api typecheck ratchet', () => {
  it('counts one per tsc error line', () => {
    const output = [
      '> @grace/api@1.0.0 typecheck',
      '> tsc --noEmit',
      '',
      "_routes/payments.ts(176,36): error TS2339: Property 'current_period_end' does not exist.",
      "webhooks/stripe.ts(65,50): error TS2322: Type '\"2023-10-16\"' is not assignable.",
    ].join('\n');
    expect(countErrors(output)).toBe(2);
  });

  it('counts nothing for a clean run', () => {
    expect(countErrors('> tsc --noEmit\n')).toBe(0);
  });

  it('does not count prose that merely mentions an error code', () => {
    // npm echoes the failing command and its own summary lines; neither is a
    // tsc diagnostic. Only `error TSxxxx:` counts.
    const output = [
      'npm error Lifecycle script `typecheck` failed with error TS2339 mentioned here',
      'note: error TS2339 appears in this sentence without a colon after the code',
      "real.ts(1,1): error TS2339: Property 'x' does not exist.",
    ].join('\n');
    expect(countErrors(output)).toBe(1);
  });

  it('keeps the baseline non-negative and documented as a floor', () => {
    expect(API_TYPECHECK_BASELINE).toBeGreaterThanOrEqual(0);
  });
});
