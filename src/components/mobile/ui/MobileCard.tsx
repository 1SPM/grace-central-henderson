import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { surface, muted } from './mobileTheme';

export function MobileCard({
  children,
  className = '',
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${surface} w-full text-left ${className}`}>
        {children}
      </button>
    );
  }
  return <div className={`${surface} ${className}`}>{children}</div>;
}

/** Icon chip + title + detail + trailing slot — the standard mobile list row. */
export function MobileCardRow({
  icon,
  title,
  detail,
  trailing,
  onClick,
  chevron = false,
}: {
  icon: ReactNode;
  title: ReactNode;
  detail?: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
}) {
  const body = (
    <>
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-100 truncate">{title}</span>
        {detail != null && <span className={`block text-xs mt-0.5 ${muted}`}>{detail}</span>}
      </span>
      {trailing}
      {chevron && <ChevronRight size={17} className="text-slate-600 shrink-0" />}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${surface} w-full p-3.5 flex items-center gap-3 text-left`}>
        {body}
      </button>
    );
  }
  return <div className={`${surface} p-3.5 flex items-center gap-3`}>{body}</div>;
}

/** Muted empty-state card used wherever a section has nothing real to show. */
export function EmptyCard({ children }: { children: ReactNode }) {
  return <div className={`${surface} p-4 text-sm ${muted}`}>{children}</div>;
}
