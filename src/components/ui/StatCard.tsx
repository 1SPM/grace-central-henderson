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

// GRACE SaaS style (see previews/grace_saas_theme_concept.html): icons sit
// in soft tinted circles with thin outline strokes — the illustration-badge
// treatment — instead of solid saturated chips. Color carries meaning
// through the tint hue + sparkline only; the card surface stays neutral
// with a uniform border (the 5px accent stripe is gone).
const accentColors = {
  emerald: {
    iconBg: 'bg-emerald-50 dark:bg-emerald-500/10',
    iconInk: 'text-emerald-600 dark:text-emerald-300',
    sparkline: '#10b981',
  },
  amber: {
    iconBg: 'bg-amber-50 dark:bg-amber-500/10',
    iconInk: 'text-amber-600 dark:text-amber-300',
    sparkline: '#f59e0b',
  },
  rose: {
    iconBg: 'bg-brand-50 dark:bg-brand-500/10',
    iconInk: 'text-brand-600 dark:text-brand-300',
    sparkline: '#3B53BB',
  },
  blue: {
    iconBg: 'bg-brand-50 dark:bg-brand-500/10',
    iconInk: 'text-brand-500 dark:text-brand-300',
    sparkline: '#4E9BE8',
  },
  violet: {
    iconBg: 'bg-violet-50 dark:bg-violet-500/10',
    iconInk: 'text-violet-600 dark:text-violet-300',
    sparkline: '#8b5cf6',
  },
  slate: {
    iconBg: 'bg-slate-100 dark:bg-slate-500/10',
    iconInk: 'text-slate-600 dark:text-slate-300',
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
              : 'bg-brand-100 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
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
      className={`bg-white dark:bg-dark-850 border border-gray-200 dark:border-dark-700 rounded-2xl ${
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
              className={`${isLarge ? 'w-14 h-14' : 'w-11 h-11'} ${colors.iconBg} rounded-full flex items-center justify-center shrink-0`}
            >
              <span className={`${colors.iconInk} [&_svg]:stroke-[1.5]`}>{icon}</span>
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
