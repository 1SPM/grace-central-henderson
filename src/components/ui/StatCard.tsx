import { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Sparkline } from './Sparkline';

interface StatCardProps {
  label: string;
  value: number | string;
  icon?: ReactNode;
  change?: number;
  changeLabel?: string;
  /** When true, a negative change is treated as positive (e.g., fewer inactive members) */
  invertTrend?: boolean;
  sparklineData?: number[];
  accentColor?: 'emerald' | 'amber' | 'rose' | 'blue' | 'violet' | 'slate';
  size?: 'default' | 'large';
  onClick?: () => void;
}

// Color lives in the icon chip, the left border stripe, and the sparkline —
// every tile still shares the same neutral white card surface, so this
// reads as "one bold system" rather than four different pastel tile
// backgrounds. Pushed further than the first bolder pass: icon chips are
// now solid fills (white icon on saturated color, not a tinted badge), and
// the accent stripe is a full 5px rather than a hairline.
const accentColors = {
  emerald: {
    iconBg: 'bg-emerald-600',
    border: 'border-l-emerald-600',
    sparkline: '#10b981',
  },
  amber: {
    iconBg: 'bg-amber-500',
    border: 'border-l-amber-500',
    sparkline: '#f59e0b',
  },
  rose: {
    iconBg: 'bg-rose-600',
    border: 'border-l-rose-600',
    sparkline: '#f43f5e',
  },
  blue: {
    iconBg: 'bg-blue-600',
    border: 'border-l-blue-600',
    sparkline: '#3b82f6',
  },
  violet: {
    iconBg: 'bg-violet-600',
    border: 'border-l-violet-600',
    sparkline: '#8b5cf6',
  },
  slate: {
    iconBg: 'bg-slate-700 dark:bg-slate-600',
    border: 'border-l-gray-300 dark:border-l-dark-600',
    sparkline: '#64748b',
  },
};

export function StatCard({
  label,
  value,
  icon,
  change,
  changeLabel = 'vs last week',
  invertTrend = false,
  sparklineData,
  accentColor = 'slate',
  size = 'default',
  onClick,
}: StatCardProps) {
  const colors = accentColors[accentColor];
  const isLarge = size === 'large';

  const renderChange = () => {
    if (change === undefined) return null;

    // A zero-value delta in a colored pill ("−0% logins this week") reads
    // as a sad, pointless badge. Fold it into plain muted text instead —
    // the changeLabel alone still carries the context.
    if (change === 0) {
      return (
        <p className="mt-3 text-xs text-gray-500 dark:text-dark-400">{changeLabel}</p>
      );
    }

    const isGoodTrend = invertTrend ? change < 0 : change > 0;

    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium tabular-nums ${
            isGoodTrend
              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
              : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
          }`}
        >
          {change > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {change > 0 ? '+' : ''}
          {change}%
        </span>
        <span className="text-xs text-gray-500 dark:text-dark-400">{changeLabel}</span>
      </div>
    );
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`bg-white dark:bg-dark-850 border-y border-r border-l-[5px] border-gray-200 dark:border-dark-700 ${colors.border} rounded-2xl ${
        isLarge ? 'p-6 sm:p-7' : 'p-5'
      } text-left w-full relative transition-all duration-200 shadow-sm ${
        onClick
          ? 'hover:-translate-y-0.5 hover:shadow-md hover:border-gray-300 dark:hover:border-dark-600 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-dark-900'
          : ''
      }`}
    >
      <div className={`flex items-start justify-between gap-2 ${isLarge ? 'mb-4' : 'mb-3'}`}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon && (
            <div
              className={`${isLarge ? 'w-14 h-14' : 'w-11 h-11'} ${colors.iconBg} rounded-xl flex items-center justify-center shrink-0 shadow-sm`}
            >
              <span className="text-white">{icon}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-dark-400 truncate">
              {label}
            </p>
            {isLarge && (
              <p className="mt-1 text-[11px] text-gray-500 dark:text-dark-400">Live at a glance</p>
            )}
          </div>
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <Sparkline
            data={sparklineData}
            color={colors.sparkline}
            fillColor={colors.sparkline}
            width={isLarge ? 108 : 42}
            height={isLarge ? 34 : 26}
          />
        )}
      </div>

      <div className="flex items-end justify-between gap-4">
        <p
          className={`stat-number text-gray-900 dark:text-white leading-none ${
            isLarge ? 'text-5xl sm:text-6xl' : 'text-4xl'
          }`}
        >
          {value}
        </p>
      </div>

      {renderChange()}
    </Component>
  );
}
