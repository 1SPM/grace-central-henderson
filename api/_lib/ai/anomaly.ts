/**
 * AI burn-rate anomaly detection.
 *
 * Hourly cron: for each tenant with usage in the last 24h, compare the
 * most recent 1-hour spend to the trailing 7-day hourly average. If
 * the ratio exceeds the threshold AND the absolute spend is meaningful
 * (filters out the "$0 → $0.000001 = ∞×" noise case), emit a Sentry
 * alert.
 *
 * The cron handler (api/cron/ai-anomaly.ts) is the I/O wrapper. The
 * math lives here as pure functions for tests.
 *
 * Tuning rationale (defaults below):
 *   - thresholdRatio: 5× the trailing average. Catches sudden loops
 *     without alerting on legit ~2x spikes (a busy Sunday, a campaign).
 *   - minAbsoluteMicroUsd: 100_000 = $0.10. Below this an alert is
 *     more annoying than useful; total spend is too small to indicate
 *     runaway risk.
 *   - lookbackHours: 7 days = 168 hours.
 */

export interface AnomalyInput {
  lastHourSpendMicroUsd: number;
  trailingTotalMicroUsd: number;        // sum over lookbackHours
  lookbackHours: number;                // typically 168
}

export interface AnomalyConfig {
  thresholdRatio: number;               // default 5.0
  minAbsoluteMicroUsd: number;          // default 100_000 ($0.10)
}

export interface AnomalyResult {
  anomalous: boolean;
  ratio: number;                        // hour / hourly_avg; Infinity when avg=0
  trailingHourlyAvgMicroUsd: number;
  reason?: 'below_min_absolute' | 'ratio_below_threshold' | 'no_history';
}

export const DEFAULT_ANOMALY_CONFIG: AnomalyConfig = {
  thresholdRatio: 5.0,
  minAbsoluteMicroUsd: 100_000,
};

export function detectAnomaly(
  input: AnomalyInput,
  cfg: AnomalyConfig = DEFAULT_ANOMALY_CONFIG,
): AnomalyResult {
  const trailingHourlyAvg = input.lookbackHours > 0
    ? input.trailingTotalMicroUsd / input.lookbackHours
    : 0;

  // Filter 1: absolute spend floor. Don't alert on rounding-error spikes.
  if (input.lastHourSpendMicroUsd < cfg.minAbsoluteMicroUsd) {
    return {
      anomalous: false,
      ratio: trailingHourlyAvg > 0 ? input.lastHourSpendMicroUsd / trailingHourlyAvg : 0,
      trailingHourlyAvgMicroUsd: trailingHourlyAvg,
      reason: 'below_min_absolute',
    };
  }

  // Filter 2: no history → can't compare. Alert anyway when above the
  // absolute floor — a tenant with zero history suddenly spending
  // $0.10 in one hour IS the signal.
  if (trailingHourlyAvg <= 0) {
    return {
      anomalous: true,
      ratio: Infinity,
      trailingHourlyAvgMicroUsd: 0,
      reason: 'no_history',
    };
  }

  const ratio = input.lastHourSpendMicroUsd / trailingHourlyAvg;
  if (ratio < cfg.thresholdRatio) {
    return {
      anomalous: false,
      ratio,
      trailingHourlyAvgMicroUsd: trailingHourlyAvg,
      reason: 'ratio_below_threshold',
    };
  }

  return { anomalous: true, ratio, trailingHourlyAvgMicroUsd: trailingHourlyAvg };
}
