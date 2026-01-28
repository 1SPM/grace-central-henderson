import { Flag } from 'lucide-react';

type BadgeVariant = 'urgent' | 'normal' | 'low' | 'success' | 'warning' | 'info' | 'default';

interface StatusBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: boolean;
  size?: 'sm' | 'md';
}

const variantStyles = {
  urgent: {
    bg: 'bg-rose-100 dark:bg-rose-900/30',
    text: 'text-rose-700 dark:text-rose-400',
    icon: 'text-rose-500',
  },
  normal: {
    bg: 'bg-blue-100 dark:bg-blue-900/30',
    text: 'text-blue-700 dark:text-blue-400',
    icon: 'text-blue-500',
  },
  low: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    icon: 'text-slate-400',
  },
  success: {
    bg: 'bg-emerald-100 dark:bg-emerald-900/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    icon: 'text-emerald-500',
  },
  warning: {
    bg: 'bg-amber-100 dark:bg-amber-900/30',
    text: 'text-amber-700 dark:text-amber-400',
    icon: 'text-amber-500',
  },
  info: {
    bg: 'bg-cyan-100 dark:bg-cyan-900/30',
    text: 'text-cyan-700 dark:text-cyan-400',
    icon: 'text-cyan-500',
  },
  default: {
    bg: 'bg-slate-100 dark:bg-slate-800',
    text: 'text-slate-600 dark:text-slate-400',
    icon: 'text-slate-400',
  },
};

const sizeStyles = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-1 text-xs',
};

export function StatusBadge({ variant = 'default', children, icon = false, size = 'sm' }: StatusBadgeProps) {
  const styles = variantStyles[variant];

  return (
    <span
      className={`inline-flex items-center gap-1 ${styles.bg} ${styles.text} ${sizeStyles[size]} font-medium rounded-full`}
    >
      {icon && <Flag size={size === 'sm' ? 10 : 12} className={styles.icon} />}
      {children}
    </span>
  );
}

// Helper function to convert priority to variant
export function priorityToVariant(priority: 'low' | 'medium' | 'high'): BadgeVariant {
  switch (priority) {
    case 'high':
      return 'urgent';
    case 'medium':
      return 'normal';
    case 'low':
      return 'low';
    default:
      return 'default';
  }
}
