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
    bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    icon: 'text-emerald-600 dark:text-emerald-400',
    iconBg: 'bg-white dark:bg-emerald-900/30',
    sparkline: '#10b981',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-200 dark:border-amber-800/50',
    icon: 'text-amber-600 dark:text-amber-400',
    iconBg: 'bg-white dark:bg-amber-900/30',
    sparkline: '#f59e0b',
  },
  rose: {
    bg: 'bg-rose-50 dark:bg-rose-900/20',
    border: 'border-rose-200 dark:border-rose-800/50',
    icon: 'text-rose-600 dark:text-rose-400',
    iconBg: 'bg-white dark:bg-rose-900/30',
    sparkline: '#f43f5e',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-900/20',
    border: 'border-blue-200 dark:border-blue-800/50',
    icon: 'text-blue-600 dark:text-blue-400',
    iconBg: 'bg-white dark:bg-blue-900/30',
    sparkline: '#3b82f6',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-900/20',
    border: 'border-violet-200 dark:border-violet-800/50',
    icon: 'text-violet-600 dark:text-violet-400',
    iconBg: 'bg-white dark:bg-violet-900/30',
    sparkline: '#8b5cf6',
  },
  slate: {
    bg: 'bg-slate-50 dark:bg-slate-800/50',
    border: 'border-slate-200 dark:border-slate-700',
    icon: 'text-slate-600 dark:text-slate-400',
    iconBg: 'bg-white dark:bg-slate-700',
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

    const isNeutral = change === 0;
    // When invertTrend is true, a negative change is good (e.g., fewer inactive members)
    const isGoodTrend = invertTrend ? change < 0 : change > 0;

    return (
      <div className="flex items-center gap-1 mt-1">
        {isNeutral ? (
          <Minus size={12} className="text-slate-400" />
        ) : change > 0 ? (
          <TrendingUp size={12} className={isGoodTrend ? 'text-emerald-500' : 'text-rose-500'} />
        ) : (
          <TrendingDown size={12} className={isGoodTrend ? 'text-emerald-500' : 'text-rose-500'} />
        )}
        <span
          className={`text-xs font-medium ${
            isNeutral
              ? 'text-slate-400'
              : isGoodTrend
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-rose-600 dark:text-rose-400'
          }`}
        >
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
      className={`${colors.bg} border ${colors.border} rounded-xl ${
        isLarge ? 'p-6' : 'p-4'
      } transition-all shadow-sm ${onClick ? 'hover:shadow-md cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            {icon && (
              <div
                className={`${isLarge ? 'w-10 h-10' : 'w-8 h-8'} ${colors.iconBg} rounded-lg flex items-center justify-center shadow-sm`}
              >
                <span className={colors.icon}>{icon}</span>
              </div>
            )}
            <span className="text-sm text-slate-500 dark:text-slate-400">{label}</span>
          </div>
          <p
            className={`font-bold text-slate-900 dark:text-white ${
              isLarge ? 'text-3xl' : 'text-2xl'
            }`}
          >
            {value}
          </p>
          {renderChange()}
        </div>
        {sparklineData && sparklineData.length > 1 && (
          <Sparkline
            data={sparklineData}
            color={colors.sparkline}
            fillColor={colors.sparkline}
            width={isLarge ? 100 : 70}
            height={isLarge ? 36 : 28}
          />
        )}
      </div>
    </Component>
  );
}
