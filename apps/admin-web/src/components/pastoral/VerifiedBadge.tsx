import { ShieldCheck } from 'lucide-react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md';
}

export function VerifiedBadge({ size = 'sm' }: VerifiedBadgeProps) {
  const iconSize = size === 'sm' ? 12 : 14;
  const textSize = size === 'sm' ? 'text-[10px]' : 'text-xs';

  return (
    <span className={`inline-flex items-center gap-0.5 ${textSize} font-medium text-emerald-600 dark:text-emerald-400`}>
      <ShieldCheck size={iconSize} />
      Verified
    </span>
  );
}
