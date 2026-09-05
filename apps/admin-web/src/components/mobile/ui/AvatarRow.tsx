import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Person } from '../../../types';
import { surface, muted } from './mobileTheme';
import { initials } from './mobileFormat';
import { StatusDot, type StatusDotTone } from './StatusDot';

/** Avatar + name + subtitle + optional status dot — the People list row. */
export function AvatarRow({
  person,
  title,
  subtitle,
  dot,
  onClick,
}: {
  person?: Person;
  /** Overrides the person's name (e.g. a family label). */
  title?: ReactNode;
  subtitle?: ReactNode;
  dot?: StatusDotTone;
  onClick?: () => void;
}) {
  const name = title ?? (person ? `${person.firstName} ${person.lastName}`.trim() : 'Unknown');
  const avatarText = person
    ? initials(person)
    : String(typeof name === 'string' ? name : '?')
        .split(' ')
        .filter((w) => /^[A-Za-z]/.test(w))
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase() || '?';
  const body = (
    <>
      <span className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-600 to-slate-800 grid place-items-center text-xs font-semibold text-slate-100 shrink-0">
        {avatarText}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-slate-100 truncate">{name}</span>
        {subtitle != null && <span className={`block text-xs mt-0.5 ${muted}`}>{subtitle}</span>}
      </span>
      {dot && <StatusDot tone={dot} />}
      {onClick && <ChevronRight size={17} className="text-slate-600 shrink-0" />}
    </>
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${surface} w-full flex items-center gap-3 p-3 text-left`}>
        {body}
      </button>
    );
  }
  return <div className={`${surface} flex items-center gap-3 p-3`}>{body}</div>;
}
