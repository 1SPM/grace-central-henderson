import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface HubPageHeaderProps {
  icon: LucideIcon;
  title: string;
  subtitle?: ReactNode;
  iconBoxClassName?: string;
  iconClassName?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  size?: 'default' | 'sm';
  className?: string;
}

export function HubPageHeader({
  icon: Icon,
  title,
  subtitle,
  iconBoxClassName = 'bg-slate-900',
  iconClassName = 'text-white',
  leading,
  trailing,
  size = 'default',
  className = '',
}: HubPageHeaderProps) {
  const titleClass =
    size === 'sm'
      ? 'serif text-2xl sm:text-3xl text-slate-900 dark:text-dark-100 leading-none'
      : 'serif text-3xl text-slate-900 dark:text-dark-100 leading-none';
  const subtitleClass =
    size === 'sm'
      ? 'text-xs text-gray-500 dark:text-dark-400 mt-1'
      : 'text-sm text-gray-500 dark:text-dark-400 mt-1.5';

  return (
    <div className={`flex flex-wrap items-start justify-between gap-3 ${className}`}>
      <div className="flex items-center gap-3 min-w-0">
        {leading}
        <div
          className={`w-10 h-10 ${iconBoxClassName} rounded-xl flex items-center justify-center flex-shrink-0`}
        >
          <Icon className={iconClassName} size={20} />
        </div>
        <div className="min-w-0">
          <h1 className={titleClass}>{title}</h1>
          {subtitle != null && subtitle !== '' && (
            <p className={subtitleClass}>{subtitle}</p>
          )}
        </div>
      </div>
      {trailing != null && <div className="flex-shrink-0">{trailing}</div>}
    </div>
  );
}
