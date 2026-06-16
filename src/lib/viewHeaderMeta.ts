import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Church,
  Crown,
  DollarSign,
  Heart,
  Home,
  Megaphone,
  Settings,
  TrendingUp,
  Users,
  Wallet,
  Zap,
} from 'lucide-react';

export interface ViewHeaderMeta {
  icon: LucideIcon;
  iconBoxClassName: string;
  iconClassName?: string;
  title: string;
}

export const viewHeaderMeta = {
  leadership: {
    icon: Crown,
    iconBoxClassName: 'bg-violet-600',
    title: 'Leadership',
  },
  wallets: {
    icon: Wallet,
    iconBoxClassName: 'bg-indigo-600',
    title: 'Impact Card Accounts',
  },
  giving: {
    icon: DollarSign,
    iconBoxClassName: 'bg-emerald-700',
    title: 'Impact Campaigns',
  },
  feed: {
    icon: Zap,
    iconBoxClassName: 'bg-slate-900',
    iconClassName: 'text-amber-300',
    title: 'Action Center',
  },
  people: {
    icon: Users,
    iconBoxClassName: 'bg-sky-600',
    title: 'Congregation',
  },
  'sunday-prep': {
    icon: Church,
    iconBoxClassName: 'bg-emerald-700',
    title: 'Sunday Service Tools',
  },
  'pastoral-care': {
    icon: Heart,
    iconBoxClassName: 'bg-rose-600',
    title: 'Crisis Center Dispatch',
  },
  analytics: {
    icon: BarChart3,
    iconBoxClassName: 'bg-slate-900',
    title: 'Analytics',
  },
  'discipleship-engagement': {
    icon: TrendingUp,
    iconBoxClassName: 'bg-blue-600',
    title: 'Growth & Engagement',
  },
  announcements: {
    icon: Megaphone,
    iconBoxClassName: 'bg-amber-600',
    title: 'Announcements',
  },
  settings: {
    icon: Settings,
    iconBoxClassName: 'bg-slate-700',
    title: 'Settings',
  },
  'life-services': {
    icon: Heart,
    iconBoxClassName: 'bg-rose-600',
    title: 'Life Services',
  },
  families: {
    icon: Home,
    iconBoxClassName: 'bg-violet-600',
    title: 'Families',
  },
} as const satisfies Record<string, ViewHeaderMeta>;

export type ViewHeaderKey = keyof typeof viewHeaderMeta;

export function getViewHeaderMeta(key: ViewHeaderKey): ViewHeaderMeta {
  return viewHeaderMeta[key];
}
