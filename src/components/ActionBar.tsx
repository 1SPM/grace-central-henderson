/**
 * Persistent, compact strip of operational signals — every chip links
 * to the canonical WorkOS route where it's actionable. Deliberately not
 * a second dashboard: no chip renders unless there's something awaiting
 * a human, and there is no "all clear" state (the dashboard's
 * TodayActionStrip already owns that reassurance on the one page where
 * it belongs). Hidden on the WorkOS view itself, where the full Decision
 * Queue panel is the real surface.
 */
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { StatusBadge } from './ui/StatusBadge';
import { buildActionBarSignals } from '../lib/actionBarSignals';
import type { DecisionQueueItem } from '../hooks/useDecisionQueue';

const COLLAPSE_KEY = 'graceActionBar.collapsed';
const MAX_VISIBLE = 5;

interface ActionBarProps {
  items: DecisionQueueItem[];
  isLoading: boolean;
  currentView: string;
}

export function ActionBar({ items, isLoading, currentView }: ActionBarProps) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === 'true');

  // Fail closed while loading, matching WorkOsHub's gate — never flash
  // a stale or partial signal set.
  if (isLoading) return null;
  if (currentView === 'workos') return null;

  const signals = buildActionBarSignals(items);
  if (signals.length === 0) return null;

  const total = signals.reduce((sum, s) => sum + s.count, 0);
  const hasUrgent = signals.some(s => s.attention === 'urgent');

  const toggleCollapsed = () => {
    const next = !collapsed;
    setCollapsed(next);
    localStorage.setItem(COLLAPSE_KEY, String(next));
  };

  if (collapsed) {
    return (
      <div className="px-4 py-1 border-b border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-850">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-dark-400 hover:text-gray-700 dark:hover:text-dark-200"
        >
          {hasUrgent && <span className="w-1.5 h-1.5 rounded-full bg-brand-500" aria-hidden="true" />}
          {total} awaiting attention
        </button>
      </div>
    );
  }

  const visible = signals.slice(0, MAX_VISIBLE);
  const overflowCount = signals.length - visible.length;

  return (
    <div className="px-4 py-1.5 border-b border-gray-200 dark:border-dark-700 bg-gray-50 dark:bg-dark-850 flex items-center gap-2 overflow-x-auto">
      <AlertTriangle size={14} className="text-gray-400 dark:text-dark-500 flex-shrink-0" aria-hidden="true" />
      <div className="flex items-center gap-1.5 flex-1 min-w-0">
        {visible.map(signal => (
          <a
            key={signal.kind}
            href={signal.href}
            className="flex-shrink-0"
          >
            <StatusBadge variant={signal.badgeVariant} size="sm">
              {signal.label} ({signal.count})
            </StatusBadge>
          </a>
        ))}
        {overflowCount > 0 && (
          <span className="text-xs text-gray-400 dark:text-dark-500 flex-shrink-0">+{overflowCount} more</span>
        )}
      </div>
      <button
        onClick={toggleCollapsed}
        aria-label="Collapse action bar"
        className="flex-shrink-0 text-xs text-gray-400 dark:text-dark-500 hover:text-gray-600 dark:hover:text-dark-300"
      >
        Collapse
      </button>
    </div>
  );
}
