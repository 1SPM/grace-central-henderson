/**
 * enforcePortalWriteLimit — the shared per-member write budget applied
 * across api/portal/* write routes (members-portal audit, Phase 1).
 * Full fixed-window mechanics are covered by rateLimit/limiter.test.ts;
 * this only checks the wrapper's own contract — the 20/60s budget, the
 * key namespacing per route, and the response it writes when tripped.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { enforcePortalWriteLimit } from './portalWriteRateLimit.js';
import { __resetMemoryStore } from './rateLimit/limiter.js';

function fakeRes() {
  const res: Record<string, unknown> = {
    setHeader: vi.fn(),
    status: vi.fn(() => res),
    json: vi.fn(() => res),
  };
  return res as unknown as import('@vercel/node').VercelResponse & { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
}

beforeEach(() => {
  __resetMemoryStore();
});

describe('enforcePortalWriteLimit', () => {
  it('allows the first 20 requests for a person on a route, then blocks the 21st with 429', async () => {
    const res = fakeRes();
    const personId = `person-${Math.random()}`;

    for (let i = 0; i < 20; i++) {
      expect(await enforcePortalWriteLimit(res, 'prayer', personId)).toBe(false);
    }
    expect(await enforcePortalWriteLimit(res, 'prayer', personId)).toBe(true);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: 'rate_limited' }));
  });

  it('scopes the budget per route — hitting the limit on one route does not affect another for the same person', async () => {
    const res = fakeRes();
    const personId = `person-${Math.random()}`;

    for (let i = 0; i < 20; i++) {
      expect(await enforcePortalWriteLimit(res, 'prayer', personId)).toBe(false);
    }
    expect(await enforcePortalWriteLimit(res, 'prayer', personId)).toBe(true);

    // A different route, same person, same window — fresh budget.
    expect(await enforcePortalWriteLimit(res, 'care', personId)).toBe(false);
  });

  it('scopes the budget per person — one member being limited does not affect another on the same route', async () => {
    const res = fakeRes();
    const personA = `person-a-${Math.random()}`;
    const personB = `person-b-${Math.random()}`;

    for (let i = 0; i < 20; i++) {
      expect(await enforcePortalWriteLimit(res, 'journey', personA)).toBe(false);
    }
    expect(await enforcePortalWriteLimit(res, 'journey', personA)).toBe(true);

    expect(await enforcePortalWriteLimit(res, 'journey', personB)).toBe(false);
  });
});
