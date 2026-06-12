/**
 * i2c adapter selector.
 *
 * Returns the live adapter when both:
 *   1. I2C_API_KEY env var is set
 *   2. The caller passes `liveMode: true` (driven by PostHog
 *      I2C_LIVE flag at the route layer)
 *
 * Otherwise returns the mock adapter so dev/CI/demo flows work.
 *
 * The live adapter is not yet implemented (TD-036) — the live path
 * currently throws "not implemented" so accidental flag-on without
 * code in place fails loudly rather than silently using mock data
 * that pretends to be real.
 */

import type { I2cAdapter } from './types.js';
import { mockI2cAdapter } from './mock-adapter.js';

export function getI2cAdapter(opts: { liveMode?: boolean } = {}): I2cAdapter {
  const apiKey = process.env.I2C_API_KEY;
  if (opts.liveMode && apiKey) {
    throw new Error(
      'i2c live adapter not yet implemented (TD-036). Set I2C_LIVE flag false or unset I2C_API_KEY to use mock.',
    );
  }
  return mockI2cAdapter;
}

export type { I2cAdapter } from './types.js';
export { mockI2cAdapter } from './mock-adapter.js';
