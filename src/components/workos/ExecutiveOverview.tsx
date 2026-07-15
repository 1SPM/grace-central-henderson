import { useState } from 'react';
import { Info, ShieldAlert } from 'lucide-react';
import { useWorkOsSummary } from '../../hooks/useWorkOsSummary';
import { openWorkOs } from '../../lib/workosNav';
import { ImpactCardFunnelPanel } from './ImpactCardFunnelPanel';
import type { View } from '../../types';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric' });
}

export function ExecutiveOverview({ setView }: { setView: (v: View) => void }) {
  const { metrics, generatedAt, isLoading, error, forbidden, refresh } = useWorkOsSummary();
  const [openInfo, setOpenInfo] = useState<string | null>(null);

  if (forbidden) {
    return (
      <div className="p-6 text-sm text-gray-500 dark:text-dark-400">
        Your role doesn't include Executive Overview access. Contact a System Administrator if you believe this is wrong.
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm mb-3">
          <ShieldAlert size={16} /> {error}
        </div>
        <button onClick={() => void refresh()} className="text-sm font-medium text-indigo-600 dark:text-indigo-400">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-dark-400">
          Live counts from your church's records. Nothing here is estimated.
        </p>
        {generatedAt && (
          <p className="text-xs text-gray-400 dark:text-dark-500" data-testid="overview-generated-at">
            As of {formatTime(generatedAt)}
          </p>
        )}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-gray-100 dark:bg-dark-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {metrics.map(metric => (
            <div
              key={metric.key}
              className="relative rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4"
              data-testid={`metric-${metric.key}`}
            >
              <div className="flex items-start justify-between">
                <p className="text-xs font-medium text-gray-500 dark:text-dark-400">{metric.label}</p>
                <button
                  aria-label={`About ${metric.label}`}
                  onClick={() => setOpenInfo(openInfo === metric.key ? null : metric.key)}
                  className="text-gray-300 hover:text-gray-500 dark:text-dark-600 dark:hover:text-dark-300"
                >
                  <Info size={14} />
                </button>
              </div>
              <p className="text-2xl font-semibold text-gray-900 dark:text-dark-100 mt-1">{metric.value}</p>
              {metric.drilldown && (
                <button
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 mt-2"
                  onClick={() => {
                    if (metric.drilldown!.view === 'workos') {
                      openWorkOs((metric.drilldown!.tab as 'work-orders' | 'approvals' | 'agents') ?? 'overview', setView);
                    } else {
                      setView(metric.drilldown!.view as View);
                    }
                  }}
                >
                  View details →
                </button>
              )}
              {openInfo === metric.key && (
                <div className="absolute z-10 top-full left-0 mt-1 w-64 rounded-lg border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-800 p-3 shadow-lg text-xs text-gray-600 dark:text-dark-300 space-y-1">
                  <p><span className="font-medium">Definition:</span> {metric.definition}</p>
                  <p><span className="font-medium">Period:</span> {metric.period}</p>
                  <p><span className="font-medium">Source:</span> {metric.source}</p>
                  <p><span className="font-medium">Last updated:</span> {formatTime(metric.last_updated)}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ImpactCardFunnelPanel />
    </div>
  );
}
