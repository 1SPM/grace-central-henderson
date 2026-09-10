import { describe, it, expect } from 'vitest';
import { ALLOWED_CAUSES, validateAllocations, validateHeadlineCause, resolveWorkshopUrlForChurch } from './_shared.js';

const CENTRAL_HENDERSON_CHURCH_ID = '11111111-1111-1111-1111-111111111111';
const FAITHFUL_CHURCH_ID = '22222222-2222-2222-2222-222222222222';

describe('validateAllocations (moved from _simulate.ts, unchanged behavior)', () => {
  it('accepts a valid single-cause allocation summing to 100', () => {
    const result = validateAllocations([{ cause: 'missions', pct: 100 }]);
    expect(result.ok).toBe(true);
  });

  it('accepts a valid multi-cause allocation summing to 100', () => {
    const result = validateAllocations([
      { cause: 'missions', pct: 50 },
      { cause: 'youth', pct: 50 },
    ]);
    expect(result.ok).toBe(true);
  });

  it('rejects an allocation that does not sum to 100', () => {
    const result = validateAllocations([{ cause: 'missions', pct: 60 }]);
    expect(result.ok).toBe(false);
  });

  it('rejects an unknown cause', () => {
    const result = validateAllocations([{ cause: 'vacation_fund', pct: 100 }]);
    expect(result.ok).toBe(false);
  });

  it('rejects a duplicate cause', () => {
    const result = validateAllocations([
      { cause: 'missions', pct: 50 },
      { cause: 'missions', pct: 50 },
    ]);
    expect(result.ok).toBe(false);
  });

  it('rejects an empty array', () => {
    const result = validateAllocations([]);
    expect(result.ok).toBe(false);
  });

  it('rejects non-array input', () => {
    const result = validateAllocations('not an array');
    expect(result.ok).toBe(false);
  });
});

describe('validateHeadlineCause', () => {
  it.each(ALLOWED_CAUSES)('accepts %s', (cause) => {
    const result = validateHeadlineCause(cause);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe(cause);
  });

  it('rejects an unknown string', () => {
    const result = validateHeadlineCause('vacation_fund');
    expect(result.ok).toBe(false);
  });

  it('rejects non-string input', () => {
    expect(validateHeadlineCause(undefined).ok).toBe(false);
    expect(validateHeadlineCause(42).ok).toBe(false);
    expect(validateHeadlineCause(null).ok).toBe(false);
  });
});

describe('resolveWorkshopUrlForChurch', () => {
  // The function's second parameter is currently unused (the map is
  // static, not DB-driven) — pass an obviously-inert stand-in rather
  // than a real Supabase client, matching the function's own contract.
  const inertSupabase = {} as never;

  it('returns the known grace-members URL for Central Henderson', async () => {
    const url = await resolveWorkshopUrlForChurch(CENTRAL_HENDERSON_CHURCH_ID, inertSupabase);
    expect(url).toBe('https://grace-members.vercel.app/workshop.html');
  });

  it('returns null for Faithful — no member-web host known yet', async () => {
    const url = await resolveWorkshopUrlForChurch(FAITHFUL_CHURCH_ID, inertSupabase);
    expect(url).toBeNull();
  });

  it('returns null for an unrecognized church id', async () => {
    const url = await resolveWorkshopUrlForChurch('99999999-9999-9999-9999-999999999999', inertSupabase);
    expect(url).toBeNull();
  });
});
