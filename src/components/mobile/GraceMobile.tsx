import { ReactNode, useMemo } from 'react';
import {
  Crown,
  BarChart3,
  Heart,
  CheckSquare,
  Wallet,
  Settings as SettingsIcon,
  Hand,
} from 'lucide-react';
import type { View, Person, Task, Giving, CalendarEvent, PrayerRequest } from '../../types';
import { GraceMobileLayout, type MoreLink } from './GraceMobileLayout';
import { MobileHome } from './MobileHome';
import { MOBILE_TAB_TO_VIEW, type GraceMobileTab } from '../../lib/graceMobileNav';

interface GraceMobileProps {
  /** Current admin view (controlled by the parent's router / preview state). */
  view: View;
  /** Navigate to a view (hash router on the live route, local state in preview). */
  onNavigate: (view: View) => void;
  /** Renders an admin View inside the mobile content area (delegates to ViewRenderer). */
  renderView: (view: View) => ReactNode;
  churchName?: string;
  branding?: { primaryColor?: string; logoUrl?: string };
  userName?: string;
  roleLabel?: string;
  /** Data used by the bespoke Home dashboard. */
  people: Person[];
  tasks: Task[];
  giving: Giving[];
  events: CalendarEvent[];
  prayers: PrayerRequest[];
}

const MORE_LINKS: { view: View; label: string; icon: ReactNode }[] = [
  { view: 'leadership', label: 'Leadership', icon: <Crown size={18} /> },
  { view: 'pastoral-care', label: 'Crisis Care', icon: <Heart size={18} /> },
  { view: 'tasks', label: 'Tasks', icon: <CheckSquare size={18} /> },
  { view: 'prayer', label: 'Prayer', icon: <Hand size={18} /> },
  { view: 'wallets', label: 'Impact Cards', icon: <Wallet size={18} /> },
  { view: 'analytics', label: 'Analytics', icon: <BarChart3 size={18} /> },
  { view: 'settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
];

const VIEW_LABELS: Record<string, string> = MORE_LINKS.reduce(
  (acc, l) => ({ ...acc, [l.view]: l.label }),
  {} as Record<string, string>,
);

/** Reverse map: admin View -> primary GRACE Mobile tab (if any). */
const VIEW_TO_TAB = (Object.entries(MOBILE_TAB_TO_VIEW) as [GraceMobileTab, View][]).reduce(
  (acc, [tab, view]) => ({ ...acc, [view]: tab }),
  {} as Record<string, GraceMobileTab>,
);

const HOME_VIEWS = new Set<string>(['dashboard', 'home', 'grace-mobile']);

function prettify(view: string): string {
  return view
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export function GraceMobile({
  view,
  onNavigate,
  renderView,
  churchName,
  branding,
  userName,
  roleLabel,
  people,
  tasks,
  giving,
  events,
  prayers,
}: GraceMobileProps) {
  const isHome = HOME_VIEWS.has(view);
  const activeTab: GraceMobileTab = isHome ? 'home' : VIEW_TO_TAB[view] ?? ('home' as GraceMobileTab);
  const isDrillDown = !isHome && !VIEW_TO_TAB[view];

  const moreLinks: MoreLink[] = useMemo(
    () => MORE_LINKS.map((l) => ({ view: l.view, label: l.label, icon: l.icon })),
    [],
  );

  const handleTabChange = (next: GraceMobileTab) => {
    onNavigate(next === 'home' ? 'dashboard' : MOBILE_TAB_TO_VIEW[next]);
  };

  return (
    <GraceMobileLayout
      activeTab={isDrillDown ? ('home' as GraceMobileTab) : activeTab}
      onTabChange={handleTabChange}
      churchName={churchName}
      branding={branding}
      userName={userName}
      roleLabel={roleLabel}
      onBack={isDrillDown ? () => onNavigate('dashboard') : undefined}
      headerTitle={isDrillDown ? VIEW_LABELS[view] ?? prettify(view) : undefined}
      moreLinks={moreLinks}
      onSelectMore={(v) => onNavigate(v as View)}
    >
      {isHome ? (
        <MobileHome
          churchName={churchName}
          userName={userName}
          people={people}
          tasks={tasks}
          giving={giving}
          events={events}
          prayers={prayers}
          onNavigate={onNavigate}
        />
      ) : (
        renderView(view)
      )}
    </GraceMobileLayout>
  );
}
