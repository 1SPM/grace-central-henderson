import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCountUp, useReducedMotion } from './useCountUp';

function mockMatchMedia(matches: boolean) {
  const listeners: (() => void)[] = [];
  const mql = {
    matches,
    addEventListener: (_: string, cb: () => void) => listeners.push(cb),
    removeEventListener: () => {},
  };
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue(mql));
  return mql;
}

describe('useReducedMotion', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reflects the current prefers-reduced-motion value', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(true);
  });

  it('is false when the media query does not match', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useReducedMotion());
    expect(result.current).toBe(false);
  });
});

describe('useCountUp', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('shows the target value immediately on first render (no animating from zero)', () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useCountUp(42));
    expect(result.current).toBe(42);
  });

  it('with reduced motion, snaps directly to a new target with no animation', () => {
    mockMatchMedia(true);
    const { result, rerender } = renderHook(({ target }) => useCountUp(target), { initialProps: { target: 10 } });
    expect(result.current).toBe(10);
    rerender({ target: 100 });
    expect(result.current).toBe(100);
  });
});
