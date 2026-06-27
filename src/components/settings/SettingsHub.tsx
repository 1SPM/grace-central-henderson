import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  ClipboardList,
  FileText,
  Mail,
  Settings as SettingsIcon,
  Tag,
} from 'lucide-react';
import { Settings } from '../Settings';
import { ListSkeleton } from '../ui/ViewSkeleton';
import {
  parseSettingsTab,
  settingsHash,
  type SettingsTab,
} from '../../lib/settingsNav';
import type { Person, Task, CalendarEvent, Giving, SmallGroup, PrayerRequest } from '../../types';

const FormBuilder = lazy(() => import('../FormBuilder').then(m => ({ default: m.FormBuilder })));
const EmailTemplateBuilder = lazy(() =>
  import('../EmailTemplateBuilder').then(m => ({ default: m.EmailTemplateBuilder })),
);
const PrintableReports = lazy(() => import('../PrintableReports').then(m => ({ default: m.PrintableReports })));
const TagsManager = lazy(() => import('../TagsManager').then(m => ({ default: m.TagsManager })));
const Analytics = lazy(() => import('../Analytics').then(m => ({ default: m.Analytics })));

const TABS: { id: SettingsTab; label: string; icon: typeof SettingsIcon }[] = [
  { id: 'general', label: 'General', icon: SettingsIcon },
  { id: 'forms', label: 'Forms', icon: ClipboardList },
  { id: 'email-templates', label: 'Email Templates', icon: Mail },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'tags', label: 'Tags', icon: Tag },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

interface SettingsHubProps {
  people: Person[];
  tasks: Task[];
  events: CalendarEvent[];
  giving: Giving[];
  groups: SmallGroup[];
  prayers: PrayerRequest[];
  interactions: import('../../types').Interaction[];
  onNavigate?: (view: 'forms' | 'email-templates' | 'wedding-services' | 'funeral-services' | 'estate-planning') => void;
  onRunWizard?: () => void;
  onOpenTutorials?: () => void;
  onUpdatePersonTags: (personId: string, tags: string[]) => void;
  onViewPerson: (id: string) => void;
  defaultTab?: SettingsTab;
}

export function SettingsHub({
  people,
  tasks,
  events,
  giving,
  groups,
  prayers,
  interactions,
  onNavigate,
  onRunWizard,
  onOpenTutorials,
  onUpdatePersonTags,
  onViewPerson,
  defaultTab,
}: SettingsHubProps) {
  const initial = useMemo(() => defaultTab ?? parseSettingsTab(), [defaultTab]);
  const [tab, setTab] = useState<SettingsTab>(initial);

  useEffect(() => {
    if (defaultTab) setTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    if (defaultTab && defaultTab !== 'general') {
      window.history.replaceState(null, '', settingsHash(defaultTab));
    }
  }, [defaultTab]);

  const syncTabFromHash = useCallback(() => {
    setTab(parseSettingsTab());
  }, []);

  useEffect(() => {
    window.addEventListener('hashchange', syncTabFromHash);
    window.addEventListener('popstate', syncTabFromHash);
    return () => {
      window.removeEventListener('hashchange', syncTabFromHash);
      window.removeEventListener('popstate', syncTabFromHash);
    };
  }, [syncTabFromHash]);

  const selectTab = (next: SettingsTab) => {
    setTab(next);
    window.history.replaceState(null, '', settingsHash(next));
  };

  return (
    <div className="flex flex-col min-h-full bg-[var(--paper-sink,#f7f5ef)] dark:bg-dark-900">
      <div className="shrink-0 border-b border-gray-200 dark:border-dark-700 bg-white/80 dark:bg-dark-900/90 backdrop-blur-sm px-4 sm:px-6 pt-4 pb-0">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center">
              <SettingsIcon className="text-white" size={20} />
            </div>
            <div>
              <h1 className="serif text-2xl sm:text-3xl text-slate-900 dark:text-dark-100 leading-none">
                Settings
              </h1>
              <p className="text-xs text-gray-500 dark:text-dark-400 mt-1">
                Church profile, tools, integrations, and analytics
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => selectTab(id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                  tab === id
                    ? 'border-slate-900 dark:border-dark-100 text-slate-900 dark:text-dark-100 font-medium'
                    : 'border-transparent text-gray-500 dark:text-dark-400 hover:text-gray-800 dark:hover:text-dark-200'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {tab === 'general' && (
          <Settings
            embedded
            people={people}
            tasks={tasks}
            events={events}
            giving={giving}
            groups={groups}
            prayers={prayers}
            onNavigate={onNavigate}
            onRunWizard={onRunWizard}
            onOpenTutorials={onOpenTutorials}
          />
        )}
        {tab === 'forms' && (
          <Suspense fallback={<ListSkeleton />}>
            <FormBuilder embedded />
          </Suspense>
        )}
        {tab === 'email-templates' && (
          <Suspense fallback={<ListSkeleton />}>
            <EmailTemplateBuilder embedded />
          </Suspense>
        )}
        {tab === 'reports' && (
          <Suspense fallback={<ListSkeleton />}>
            <PrintableReports embedded people={people} tasks={tasks} prayers={prayers} giving={giving} />
          </Suspense>
        )}
        {tab === 'tags' && (
          <Suspense fallback={<ListSkeleton />}>
            <TagsManager embedded people={people} onUpdatePersonTags={onUpdatePersonTags} />
          </Suspense>
        )}
        {tab === 'analytics' && (
          <Suspense fallback={<ListSkeleton />}>
            <div className="px-6 pt-4 pb-8 max-w-7xl mx-auto">
              <Analytics
                embedded
                people={people}
                tasks={tasks}
                giving={giving}
                prayers={prayers}
                events={events}
                interactions={interactions}
                onViewPerson={onViewPerson}
              />
            </div>
          </Suspense>
        )}
      </div>
    </div>
  );
}
