import { describe, it, expect } from 'vitest';
import { computeBounce } from './CampusRenderer';

describe('computeBounce (the agent "wave" pulse)', () => {
  it('is null before it starts and once it finishes', () => {
    expect(computeBounce(-0.01)).toBeNull();
    expect(computeBounce(0.7)).toBeNull();
    expect(computeBounce(1.5)).toBeNull();
  });

  it('starts and ends at rest (no lift, no scale change)', () => {
    const start = computeBounce(0)!;
    expect(start.lift).toBeCloseTo(0, 5);
    expect(start.scale).toBeCloseTo(1, 5);
  });

  it('peaks at the midpoint: lifts up and scales up, never down', () => {
    const mid = computeBounce(0.35)!; // duration/2
    expect(mid.lift).toBeCloseTo(-10, 1);
    expect(mid.scale).toBeCloseTo(1.18, 2);
  });

  it('is symmetric — the curve rises and falls the same way', () => {
    const early = computeBounce(0.1)!;
    const late = computeBounce(0.6)!; // duration - 0.1
    expect(early.lift).toBeCloseTo(late.lift, 5);
    expect(early.scale).toBeCloseTo(late.scale, 5);
  });

  it('never lifts downward or shrinks — a bounce always reads as "up"', () => {
    for (let e = 0; e < 0.7; e += 0.05) {
      const r = computeBounce(e)!;
      expect(r.lift).toBeLessThanOrEqual(0);
      expect(r.scale).toBeGreaterThanOrEqual(1);
    }
  });

  it('respects a custom duration', () => {
    expect(computeBounce(1.9, 2)).not.toBeNull();
    expect(computeBounce(2.1, 2)).toBeNull();
  });
});
