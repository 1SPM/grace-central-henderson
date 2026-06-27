import { ReactNode } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
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

const accentColors = {
  emerald: {
    bg: 'bg-emerald-50/90 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    icon: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-white dark:bg-emerald-900/30',
    sparkline: '#10b981',
    glow: 'from-emerald-500/12',
  },
  amber: {
    bg: 'bg-amber-50/90 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/50',
    icon: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-white dark:bg-amber-900/30',
    sparkline: '#f59e0b',
    glow: 'from-amber-500/12',
  },
  rose: {
    bg: 'bg-rose-50/90 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-800/50',
    icon: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-white dark:bg-rose-900/30',
    sparkline: '#f43f5e',
    glow: 'from-rose-500/12',
  },
  blue: {
    bg: 'bg-blue-50/90 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800/50',
    icon: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-white dark:bg-blue-900/30',
    sparkline: '#3b82f6',
    glow: 'from-blue-500/12',
  },
  violet: {
    bg: 'bg-slate-50/90 dark:bg-slate-900/20',
    border: 'border-slate-200 dark:border-slate-800/50',
    icon: 'text-slate-600 dark:text-slate-400',
    iconBg: 'bg-white dark:bg-slate-900/30',
    sparkline: '#8b5cf6',
    glow: 'from-slate-500/12',
  },
  slate: {
    bg: 'bg-slate-50/90 dark:bg-slate-800/50',
    border: 'border-slate-200 dark:border-slate-700',
    icon: 'text-slate-600 dark:text-slate-400',
    iconBg: 'bg-white dark:bg-slate-700',
    sparkline: '#64748b',
    glow: 'from-slate-500/12',
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

    const isNeutral = change === 0;
    const isGoodTrend = invertTrend ? change < 0 : change > 0;

    return (
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
            isNeutral
              ? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
              : isGoodTrend
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300'
          }`}
        >
          {isNeutral ? (
            <Minus size={12} />
          ) : change > 0 ? (
            <TrendingUp size={12} />
          ) : (
            <TrendingDown size={12} />
          )}
          {change > 0 ? '+' : ''}
          {change}%
        </span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{changeLabel}</span>
      </div>
    );
  };

  const Component = onClick ? 'button' : 'div';

  return (
    <Component
      onClick={onClick}
      className={`${colors.bg} border ${colors.border} rounded-2xl ${
        isLarge ? 'p-5 sm:p-6' : 'p-4'
      } relative overflow-hidden transition-all duration-300 shadow-sm ${
        onClick ? 'hover:-translate-y-0.5 hover:shadow-md cursor-pointer' : ''
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${colors.glow} to-transparent`} />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent dark:via-white/10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-transparent to-white/35 dark:to-white/5" />

      <div className={`relative flex items-start justify-between gap-4 ${isLarge ? 'mb-4' : 'mb-3'}`}>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {icon && (
            <div
              className={`${isLarge ? 'w-11 h-11' : 'w-9 h-9'} ${colors.iconBg} rounded-xl flex items-center justify-center shrink-0 ring-1 ring-black/5 dark:ring-white/5`}
            >
              <span className={colors.icon}>{icon}</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400 truncate">
              {label}
            </p>
            {isLarge && (
              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Live at a glance</p>
            )}
          </div>
        </div>

        {sparklineData && sparklineData.length > 1 && (
          <div className="rounded-full bg-white/60 dark:bg-black/10 p-1 ring-1 ring-black/5 dark:ring-white/5 backdrop-blur-sm">
            <Sparkline
              data={sparklineData}
              color={colors.sparkline}
              fillColor={colors.sparkline}
              width={isLarge ? 108 : 84}
              height={isLarge ? 34 : 26}
            />
          </div>
        )}
      </div>

      <div className="relative flex items-end justify-between gap-4">
        <p
          className={`font-semibold tracking-tight text-slate-900 dark:text-white tabular-nums leading-none ${
            isLarge ? 'text-3xl sm:text-[2.15rem]' : 'text-2xl'
          }`}
        >
          {value}
        </p>
      </div>

      {renderChange()}
    </Component>
  );
}
