/**
 * "This year vs. all-time" ministry impact panel. Any figure with no
 * real backing table (households/individuals served) shows "Not yet
 * computed" rather than a fabricated number — see
 * api/_lib/ministryImpactMetrics.ts.
 */
import { HeartHandshake, Lock } from 'lucide-react';
import { useMinistryImpactMetrics, type MinistryImpactStat } from '../../hooks/useMinistryImpactMetrics';

function formatStat(stat: MinistryImpactStat, formatter: (n: number) => string): { thisYear: string; allTime: string } {
  return {
    thisYear: stat.this_year === null ? 'Not yet computed' : formatter(stat.this_year),
    allTime: stat.all_time === null ? 'Not yet computed' : formatter(stat.all_time),
  };
}

const formatUsd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const formatCount = (n: number) => n.toLocaleString('en-US');

export function MinistryImpactPanel() {
  const { metrics, isLoading, error, forbidden } = useMinistryImpactMetrics();

  if (forbidden) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6 mt-4 text-sm text-gray-500 dark:text-dark-400 flex items-center gap-2">
        <Lock size={14} /> Ministry impact metrics require analytics.view.
      </div>
    );
  }

  if (error || isLoading || !metrics) {
    return (
      <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6 mt-4">
        {error ? <p className="text-sm text-brand-600 dark:text-brand-400">{error}</p> : <div className="h-24 rounded-lg bg-gray-100 dark:bg-dark-800 animate-pulse" />}
      </div>
    );
  }

  const rows: { label: string; stat: MinistryImpactStat; format: (n: number) => string }[] = [
    { label: 'Gift-in-kind value distributed', stat: metrics.gift_in_kind_value_distributed, format: formatUsd },
    { label: 'Care requests handled', stat: metrics.care_requests_handled, format: formatCount },
    { label: 'Households served', stat: metrics.households_served, format: formatCount },
    { label: 'Individuals served', stat: metrics.individuals_served, format: formatCount },
  ];

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6 mt-4">
      <div className="flex items-center gap-2 mb-3">
        <HeartHandshake size={16} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Ministry impact — this year vs. all time</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-dark-400">
              <th className="font-medium pb-2">Metric</th>
              <th className="font-medium pb-2">This year</th>
              <th className="font-medium pb-2">All time</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const { thisYear, allTime } = formatStat(r.stat, r.format);
              return (
                <tr key={r.label} className="border-t border-gray-100 dark:border-dark-800">
                  <td className="py-2 text-gray-700 dark:text-dark-200">{r.label}</td>
                  <td className="py-2 font-medium text-gray-900 dark:text-dark-100">{thisYear}</td>
                  <td className="py-2 font-medium text-gray-900 dark:text-dark-100">{allTime}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
