import {
  Check,
  Church,
  MapPin,
  Clock,
  Users,
  UserPlus,
  CalendarDays,
  Mail,
  X,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import type { ChurchSettings } from '../hooks/useChurchSettings';

interface ChecklistItem {
  key: string;
  label: string;
  icon: typeof Check;
  done: boolean;
  view: string;
}

interface SetupChecklistProps {
  churchSettings: ChurchSettings;
  peopleCount: number;
  groupsCount: number;
  eventsCount: number;
  onNavigate: (view: string) => void;
  onDismiss: () => void;
  onReopenWizard?: () => void;
  onOpenTutorials?: () => void;
}

export function SetupChecklist({
  churchSettings,
  peopleCount,
  groupsCount,
  eventsCount,
  onNavigate,
  onDismiss,
  onReopenWizard,
  onOpenTutorials,
}: SetupChecklistProps) {
  const profile = churchSettings.profile;

  const items: ChecklistItem[] = [
    {
      key: 'name',
      label: 'Name your church',
      icon: Church,
      done: !!profile.name && profile.name !== 'Grace Community Church',
      view: 'settings',
    },
    {
      key: 'address',
      label: 'Add church address',
      icon: MapPin,
      done: !!profile.address && !!profile.city,
      view: 'settings',
    },
    {
      key: 'services',
      label: 'Set service times',
      icon: Clock,
      done: profile.serviceTimes.length > 0 && profile.serviceTimes.some(s => s.name.length > 0),
      view: 'settings',
    },
    {
      key: 'people',
      label: 'Add your first person',
      icon: Users,
      done: peopleCount > 0,
      view: 'people',
    },
    {
      key: 'groups',
      label: 'Create a group',
      icon: UserPlus,
      done: groupsCount > 0,
      view: 'groups',
    },
    {
      key: 'events',
      label: 'Create an event',
      icon: CalendarDays,
      done: eventsCount > 0,
      view: 'calendar',
    },
    {
      key: 'email',
      label: 'Set up email',
      icon: Mail,
      done: !!churchSettings.integrations.emailFromAddress,
      view: 'settings',
    },
  ];

  const completedCount = items.filter(i => i.done).length;
  const allDone = completedCount === items.length;

  if (allDone) return null;

  const pct = Math.round((completedCount / items.length) * 100);
  const circumference = 2 * Math.PI * 18;
  const strokeDashoffset = circumference - (pct / 100) * circumference;

  return (
    <div className="mb-6 bg-white dark:bg-dark-800 rounded-xl border border-gray-200 dark:border-dark-700 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-dark-700/50">
        <div className="flex items-center gap-3">
          {/* Progress ring */}
          <div className="relative w-10 h-10">
            <svg className="w-10 h-10 -rotate-90" viewBox="0 0 40 40">
              <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor"
                className="text-gray-100 dark:text-dark-700" strokeWidth="3" />
              <circle cx="20" cy="20" r="18" fill="none" stroke="currentColor"
                className="text-violet-500" strokeWidth="3" strokeLinecap="round"
                strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
                style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700 dark:text-dark-200">
              {completedCount}/{items.length}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-dark-100">Finish Setting Up</h3>
            <p className="text-xs text-gray-500 dark:text-dark-400">{items.length - completedCount} items remaining</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onOpenTutorials && (
            <button
              onClick={onOpenTutorials}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 rounded-lg transition-colors"
            >
              <Sparkles size={12} />
              Take a Tour
            </button>
          )}
          {onReopenWizard && (
            <button
              onClick={onReopenWizard}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-violet-600 dark:text-violet-400 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 rounded-lg transition-colors"
            >
              <Sparkles size={12} />
              Resume setup
            </button>
          )}
          <button
            onClick={onDismiss}
            className="p-1.5 hover:bg-gray-100 dark:hover:bg-dark-750 rounded-lg transition-colors"
            aria-label="Dismiss checklist"
          >
            <X size={14} className="text-gray-400 dark:text-dark-500" />
          </button>
        </div>
      </div>

      {/* Items */}
      <div className="divide-y divide-gray-50 dark:divide-dark-700/30">
        {items.map(item => (
          <button
            key={item.key}
            onClick={() => !item.done && onNavigate(item.view)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
              item.done
                ? 'opacity-60'
                : 'hover:bg-gray-50 dark:hover:bg-dark-750'
            }`}
            disabled={item.done}
          >
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
              item.done
                ? 'bg-emerald-500 text-white'
                : 'border-2 border-gray-300 dark:border-dark-600'
            }`}>
              {item.done && <Check size={10} />}
            </div>
            <item.icon size={14} className={item.done ? 'text-gray-400 dark:text-dark-500' : 'text-gray-500 dark:text-dark-400'} />
            <span className={`flex-1 text-sm ${
              item.done
                ? 'text-gray-400 dark:text-dark-500 line-through'
                : 'text-gray-700 dark:text-dark-300 font-medium'
            }`}>
              {item.label}
            </span>
            {!item.done && <ChevronRight size={14} className="text-gray-300 dark:text-dark-600" />}
          </button>
        ))}
      </div>
    </div>
  );
}
