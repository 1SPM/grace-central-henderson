import { describe, it, expect } from 'vitest';
import { detectAnomaly, DEFAULT_ANOMALY_CONFIG } from './anomaly';

describe('ai/anomaly — detectAnomaly', () => {
  it('flags 6× spike when above the $0.10 absolute floor', () => {
    // Trailing 168h total = 168_000 micro = $0.168, avg 1000/h
    // Last hour = 600_000 micro = $0.60 → ratio 600
    const r = detectAnomaly({
      lastHourSpendMicroUsd: 600_000,
      trailingTotalMicroUsd: 168_000,
      lookbackHours: 168,
    });
    expect(r.anomalous).toBe(true);
    expect(r.ratio).toBe(600);
  });

  it('does NOT flag a 3× spike (below threshold)', () => {
    // avg 100_000/h; last hour 300_000 → ratio 3
    const r = detectAnomaly({
      lastHourSpendMicroUsd: 300_000,
      trailingTotalMicroUsd: 100_000 * 168,
      lookbackHours: 168,
    });
    expect(r.anomalous).toBe(false);
    expect(r.ratio).toBeCloseTo(3);
    expect(r.reason).toBe('ratio_below_threshold');
  });

  it('does NOT flag when absolute spend is below $0.10 floor (filters noise)', () => {
    // Even though ratio is huge, $0.05 is too small to indicate runaway
    const r = detectAnomaly({
      lastHourSpendMicroUsd: 50_000,         // $0.05
      trailingTotalMicroUsd: 100,            // ~0 history
      lookbackHours: 168,
    });
    expect(r.anomalous).toBe(false);
    expect(r.reason).toBe('below_min_absolute');
  });

  it('flags a fresh tenant ($0 history) whose first hour exceeds absolute floor', () => {
    const r = detectAnomaly({
      lastHourSpendMicroUsd: 500_000,        // $0.50
      trailingTotalMicroUsd: 0,
      lookbackHours: 168,
    });
    expect(r.anomalous).toBe(true);
    expect(r.ratio).toBe(Infinity);
    expect(r.reason).toBe('no_history');
  });

  it('exactly at threshold ratio counts as anomalous (>=)', () => {
    const r = detectAnomaly({
      lastHourSpendMicroUsd: 500_000,
      trailingTotalMicroUsd: 100_000 * 168,   // avg 100_000/h
      lookbackHours: 168,
    });
    expect(r.ratio).toBe(5);
    expect(r.anomalous).toBe(true);   // ratio >= 5 fires (not strictly >)
  });

  it('respects custom threshold and absolute floor', () => {
    // High threshold (10×): a 6× spike no longer fires
    const r = detectAnomaly(
      { lastHourSpendMicroUsd: 600_000, trailingTotalMicroUsd: 100_000 * 168, lookbackHours: 168 },
      { thresholdRatio: 10.0, minAbsoluteMicroUsd: 100_000 },
    );
    expect(r.anomalous).toBe(false);
  });

  it('returns ratio=0 when below floor and no history', () => {
    const r = detectAnomaly({ lastHourSpendMicroUsd: 1000, trailingTotalMicroUsd: 0, lookbackHours: 168 });
    expect(r.anomalous).toBe(false);
    expect(r.ratio).toBe(0);
  });

  it('handles lookbackHours=0 gracefully', () => {
    const r = detectAnomaly({ lastHourSpendMicroUsd: 500_000, trailingTotalMicroUsd: 0, lookbackHours: 0 });
    expect(r.trailingHourlyAvgMicroUsd).toBe(0);
    expect(r.anomalous).toBe(true);   // no history + above floor
  });

  it('defaults are sensible (5× / $0.10)', () => {
    expect(DEFAULT_ANOMALY_CONFIG.thresholdRatio).toBe(5);
    expect(DEFAULT_ANOMALY_CONFIG.minAbsoluteMicroUsd).toBe(100_000);
  });
});
