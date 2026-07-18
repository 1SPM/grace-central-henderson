import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useSupabaseData } from './useSupabaseData';

const fromSpy = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase', () => {
  const chain = {
    select: () => chain,
    order: () => Promise.resolve({ data: [], error: null }),
    gte: () => chain,
  };
  return {
    isSupabaseConfigured: () => true,
    supabase: {
      from: (...args: unknown[]) => {
        fromSpy(...args);
        return chain;
      },
    },
    setClerkTokenProvider: () => {},
  };
});

describe('useSupabaseData — auth-readiness gating', () => {
  beforeEach(() => {
    fromSpy.mockClear();
  });

  it('does not query Supabase while the caller reports auth is not yet ready', async () => {
    renderHook(() => useSupabaseData(false));

    // Give any stray microtask a chance to run before asserting silence.
    await new Promise(resolve => setTimeout(resolve, 10));

    expect(fromSpy).not.toHaveBeenCalled();
  });

  it('queries Supabase once auth becomes ready', async () => {
    const { rerender } = renderHook(({ ready }) => useSupabaseData(ready), {
      initialProps: { ready: false },
    });

    expect(fromSpy).not.toHaveBeenCalled();

    rerender({ ready: true });

    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('people');
    });
  });

  it('queries immediately when authReady defaults to true (backward-compatible callers)', async () => {
    renderHook(() => useSupabaseData());

    await waitFor(() => {
      expect(fromSpy).toHaveBeenCalledWith('people');
    });
  });
});
