/**
 * Impact Card adoption-funnel panel for the WorkOS Executive Overview.
 *
 * Every card shows the metric's source/definition/reporting period/
 * calculation/assumptions/data freshness/reconciliation status via the
 * info popover — the phase brief requires all seven on every figure, not
 * just a label + number. A metric with no real source table
 * (program_benefit) renders "Not yet computed" rather than a fabricated
 * value or a silent $0.
 */
import { useState } from 'react';
import { Info, Lock, ShieldAlert } from 'lucide-react';
import {
  useImpactCardFunnelMetrics,
  isPermissionRequired,
  type ImpactCardMetricKey,
} from '../../hooks/useImpactCardFunnelMetrics';

const LABELS: Record<ImpactCardMetricKey, string> = {
  application_count: 'Applications',
  completion_count: 'Completed applications',
  activation_count: 'Card activations',
  active_participation: 'Active participation',
  approved_aggregate_value_usd: 'Approved aggregate value',
  program_benefit: 'Program benefit',
  onboarding_drop_off_rate: 'Onboarding drop-off',
  support_cases: 'Support cases',
  reconciliation_status: 'Reconciliation exceptions',
  campaign_performance: 'Campaign completion rate',
};

const ORDER: ImpactCardMetricKey[] = [
  'application_count', 'completion_count', 'activation_count', 'active_participation',
  'approved_aggregate_value_usd', 'program_benefit', 'onboarding_drop_off_rate',
  'support_cases', 'reconciliation_status', 'campaign_performance',
];

function formatValue(key: ImpactCardMetricKey, value: number | null): string {
  if (value === null) return 'Not yet computed';
  if (key === 'approved_aggregate_value_usd') return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  if (key === 'onboarding_drop_off_rate' || key === 'campaign_performance') return `${(value * 100).toFixed(0)}%`;
  return value.toLocaleString('en-US');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

const RECONCILIATION_BADGE: Record<string, string> = {
  reconciled: 'text-emerald-700 bg-emerald-50',
  exceptions_open: 'text-amber-700 bg-amber-50',
  not_applicable: 'text-gray-500 bg-gray-50',
  not_yet_computed: 'text-gray-400 bg-gray-50',
};

export function ImpactCardFunnelPanel() {
  const { metrics, reportingPeriod, isLoading, error, forbidden, refresh } = useImpactCardFunnelMetrics();
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  if (forbidden) {
    return (
      <div className="p-4 sm:p-6 text-sm text-gray-500 dark:text-dark-400 flex items-center gap-2">
        <Lock size={14} /> Impact Card metrics require impact_card.view or giving_financial.view.
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <div className="flex items-center gap-2 text-brand-600 dark:text-brand-400 text-sm mb-3">
          <ShieldAlert size={16} /> {error}
        </div>
        <button onClick={() => void refresh()} className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Try again</button>
      </div>
    );
  }

  return (
    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-dark-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Impact Card adoption funnel</h2>
        {reportingPeriod && (
          <p className="text-xs text-gray-400 dark:text-dark-500">
            {formatDate(reportingPeriod.start)} – {formatDate(reportingPeriod.end)}
          </p>
        )}
      </div>

      {isLoading || !metrics ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-dark-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {ORDER.map(key => {
            const metric = metrics[key];
            if (isPermissionRequired(metric)) {
              return (
                <div key={key} className="rounded-xl border border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-800 p-4 flex items-center gap-2 text-xs text-gray-400" data-testid={`impact-metric-${key}`}>
                  <Lock size={14} /> {LABELS[key]} — requires additional permission
                </div>
              );
            }
            return (
              <div
                key={key}
                className="relative rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4"
                data-testid={`impact-metric-${key}`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-xs font-medium text-gray-500 dark:text-dark-400">{LABELS[key]}</p>
                  <button
                    aria-label={`About ${LABELS[key]}`}
                    onClick={() => setOpenInfo(openInfo === key ? null : key)}
                    className="text-gray-300 hover:text-gray-500 dark:text-dark-600 dark:hover:text-dark-300"
                  >
                    <Info size={14} />
                  </button>
                </div>
                <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100 mt-1">{formatValue(key, metric.value)}</p>
                <span className={`inline-block mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium ${RECONCILIATION_BADGE[metric.reconciliation_status]}`}>
                  {metric.reconciliation_status.replace(/_/g, ' ')}
                </span>

                {openInfo === key && (
                  <div className="absolute z-10 top-full left-0 mt-1 w-72 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-3 shadow-lg text-xs text-gray-600 dark:text-dark-300 space-y-1">
                    <p><span className="font-medium">Definition:</span> {metric.definition}</p>
                    <p><span className="font-medium">Source:</span> {metric.source}</p>
                    <p><span className="font-medium">Calculation:</span> {metric.calculation}</p>
                    <p><span className="font-medium">Assumptions:</span> {metric.assumptions}</p>
                    <p><span className="font-medium">Data freshness:</span> {metric.data_freshness}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
