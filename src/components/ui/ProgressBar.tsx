interface ProgressBarProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: 'emerald' | 'blue' | 'amber' | 'rose' | 'violet' | 'slate';
  showLabel?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: 'h-1',
  md: 'h-1.5',
  lg: 'h-2',
};

const colorClasses = {
  emerald: 'bg-emerald-500',
  blue: 'bg-blue-500',
  amber: 'bg-amber-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
  slate: 'bg-slate-500',
};

const bgClasses = {
  emerald: 'bg-emerald-100 dark:bg-emerald-900/30',
  blue: 'bg-blue-100 dark:bg-blue-900/30',
  amber: 'bg-amber-100 dark:bg-amber-900/30',
  rose: 'bg-rose-100 dark:bg-rose-900/30',
  violet: 'bg-violet-100 dark:bg-violet-900/30',
  slate: 'bg-slate-100 dark:bg-slate-800',
};

export function ProgressBar({
  value,
  max = 100,
  size = 'md',
  color = 'emerald',
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`flex-1 ${bgClasses[color]} rounded-full overflow-hidden ${sizeClasses[size]}`}>
        <div
          className={`${sizeClasses[size]} ${colorClasses[color]} rounded-full transition-all duration-500`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      {showLabel && (
        <span className="text-xs font-medium text-slate-600 dark:text-slate-400 min-w-[36px] text-right">
          {Math.round(percentage)}%
        </span>
      )}
    </div>
  );
}
