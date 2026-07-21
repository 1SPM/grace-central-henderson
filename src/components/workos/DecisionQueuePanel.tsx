/**
 * The unified Decision Queue — everything awaiting a human decision,
 * severity-grouped, each row a deep link to where it's actionable.
 * Placed first in the WorkOS Overview per the "mission control" goal:
 * this is the first thing staff should see.
 */
import { AlertTriangle, AlertCircle, Circle, CheckCircle2, RefreshCw } from 'lucide-react';
import { useDecisionQueue, type DecisionQueueItem } from '../../hooks/useDecisionQueue';

function formatAge(hours: number): string {
  if (hours < 1) return '<1h';
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

const SEVERITY_STYLES: Record<DecisionQueueItem['severity'], { icon: typeof AlertTriangle; badge: string; dot: string }> = {
  critical: { icon: AlertTriangle, badge: 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400', dot: 'bg-brand-500' },
  high: { icon: AlertCircle, badge: 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400', dot: 'bg-amber-500' },
  normal: { icon: Circle, badge: 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-300', dot: 'bg-gray-400' },
};

function QueueRow({ item }: { item: DecisionQueueItem }) {
  const style = SEVERITY_STYLES[item.severity];
  const Icon = style.icon;
  return (
    <a
      href={item.href}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors group"
    >
      <span className={`flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0 ${style.badge}`}>
        <Icon size={14} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-medium text-gray-900 dark:text-dark-100 truncate">{item.title}</span>
        {item.detail && (
          <span className="block text-xs text-gray-500 dark:text-dark-400 truncate">{item.detail}</span>
        )}
      </span>
      <span className="text-xs text-gray-400 dark:text-dark-500 flex-shrink-0">{formatAge(item.age_hours)}</span>
    </a>
  );
}

export function DecisionQueuePanel() {
  const { items, counts, isLoading, error, refresh } = useDecisionQueue();

  return (
    <div className="rounded-xl border border-gray-200 dark:border-dark-700 bg-white dark:bg-dark-850 p-4 sm:p-6 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-dark-100 flex items-center gap-1.5">
          Decision Queue
          {counts.total > 0 && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
              counts.critical > 0
                ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/15 dark:text-brand-400'
                : 'bg-gray-100 text-gray-600 dark:bg-dark-700 dark:text-dark-300'
            }`}>
              {counts.total}
            </span>
          )}
        </h2>
        <button
          onClick={() => void refresh()}
          className="text-gray-400 hover:text-gray-600 dark:text-dark-500 dark:hover:text-dark-300"
          aria-label="Refresh decision queue"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
        </button>
      </div>

      {error && (
        <p className="text-sm text-brand-600 dark:text-brand-400">{error}</p>
      )}

      {!error && isLoading && items.length === 0 && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-10 rounded-lg bg-gray-100 dark:bg-dark-800 animate-pulse" />
          ))}
        </div>
      )}

      {!error && !isLoading && items.length === 0 && (
        <div className="flex items-center gap-2 py-4 text-sm text-gray-500 dark:text-dark-400">
          <CheckCircle2 size={16} className="text-emerald-500" />
          Queue clear — nothing awaiting a decision.
        </div>
      )}

      {!error && items.length > 0 && (
        <div className="divide-y divide-gray-100 dark:divide-dark-800">
          {items.map(item => <QueueRow key={item.id} item={item} />)}
        </div>
      )}
    </div>
  );
}
