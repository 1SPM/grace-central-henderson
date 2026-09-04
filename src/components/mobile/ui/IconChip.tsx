import { ReactNode } from 'react';
import { chipTones, type ChipTone } from './mobileTheme';

/** Rounded icon square used at the left edge of list rows and quick actions. */
export function IconChip({
  tone = 'indigo',
  children,
  size = 9,
}: {
  tone?: ChipTone;
  children: ReactNode;
  /** Tailwind size unit (9 → w-9 h-9). */
  size?: 9 | 10 | 12;
}) {
  const sizeClass = size === 12 ? 'w-12 h-12' : size === 10 ? 'w-10 h-10' : 'w-9 h-9';
  return (
    <span className={`${sizeClass} rounded-xl grid place-items-center shrink-0 ${chipTones[tone]}`}>
      {children}
    </span>
  );
}
