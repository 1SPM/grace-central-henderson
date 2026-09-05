import { ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Crown,
  BarChart3,
  Heart,
  CheckSquare,
  Wallet,
  Settings as SettingsIcon,
  Hand,
  Sparkles,
} from 'lucide-react';
import type { View, Person, Task, Giving, CalendarEvent, PrayerRequest } from '../../types';
import { GraceMobileLayout, type MoreLink } from './GraceMobileLayout';
import { HomeScreen } from './screens/HomeScreen';
import { BriefScreen } from './screens/BriefScreen';
import { PeopleScreen } from './screens/PeopleScreen';
import { WorkScreen } from './screens/WorkScreen';
import { SundayScreen } from './screens/SundayScreen';
import { AskGraceScreen } from './screens/AskGraceScreen';
import { mergeCalendarWithRhythm } from '../../lib/churchCalendarRhythm';
import { deriveSundayReadiness } from '../../lib/mobileAttention';
import { MOBILE_TAB_TO_VIEW, parseMobileTab, type GraceMobileTab } from '../../lib/graceMobileNav';

interface GraceMobileProps {
  /** Current admin view (controlled by the parent's router / preview state). */
  view: View;
  /** Navigate to a view (hash router on the live route, local state in preview). */
  onNavigate: (view: View) => void;
  /** Renders an admin View inside the mobile content area (delegates to ViewRenderer). */
  renderView: (view: View) => ReactNode;
  churchName?: string;
  churchId?: string;
  /** IANA timezone for the greeting clock. */
  churchTimezone?: string;
  branding?: { primaryColor?: string; logoUrl?: string };
  userName?: string;
  roleLabel?: string;
  /** Data used by the bespoke mobile screens. */
  people: Person[];
  tasks: Task[];
  giving: Giving[];
  events: CalendarEvent[];
  prayers: PrayerRequest[];
}

const MORE_LINKS: { view: View; label: string; icon: ReactNode }[] = [
  { view: 'feed', label: 'Brief', icon: <Sparkles size={18} /> },
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

/** Reverse map: admin View -> GRACE Mobile screen (if any). */
const VIEW_TO_SCREEN = (Object.entries(MOBILE_TAB_TO_VIEW) as [string, View][]).reduce(
  (acc, [screen, view]) => ({ ...acc, [view]: screen }),
  {} as Record<string, string>,
);

const HOME_VIEWS = new Set<string>(['dashboard', 'home', 'grace-mobile']);
/** Views with a bespoke mobile-native screen; everything else delegates to ViewRenderer. */
const MOBILE_NATIVE_VIEWS = new Set<View>(['dashboard', 'home', 'feed', 'people', 'sunday-prep', 'tasks', 'grace']);
/** Views presented as pushed stack screens (back chevron, no tab highlight). */
const STACK_VIEWS: Record<string, string> = { feed: 'Your Brief', grace: 'Ask Grace' };

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
  churchId,
  churchTimezone,
  branding,
  userName,
  roleLabel,
  people,
  tasks,
  events,
  prayers,
}: GraceMobileProps) {
  // Seed prompt / auto-listen handed to the Ask Grace screen on open.
  const [graceSeed, setGraceSeed] = useState<string | null>(null);
  const [graceListen, setGraceListen] = useState(false);

  // Honor ?tab= deep links (shared /mobile?tab=… URLs) once on mount. In
  // the desktop preview the URL carries no tab param, so this is a no-op.
  useEffect(() => {
    const screen = parseMobileTab();
    if (screen !== 'home') onNavigate(MOBILE_TAB_TO_VIEW[screen]);
  }, []);

  const isHome = HOME_VIEWS.has(view);
  const isStack = view in STACK_VIEWS;
  const activeTab: GraceMobileTab = isHome
    ? 'home'
    : ((VIEW_TO_SCREEN[view] as GraceMobileTab | undefined) ?? 'home');
  const isDrillDown = !isHome && !VIEW_TO_SCREEN[view];

  // One shared calendar + Sunday-readiness derivation for every screen.
  const mergedEvents = useMemo(() => {
    const year = new Date().getFullYear();
    return mergeCalendarWithRhythm(events, [year, year + 1]);
  }, [events]);
  const readiness = useMemo(() => deriveSundayReadiness(tasks, mergedEvents), [tasks, mergedEvents]);

  const moreLinks: MoreLink[] = useMemo(
    () => MORE_LINKS.map((l) => ({ view: l.view, label: l.label, icon: l.icon })),
    [],
  );

  const openGrace = (seed?: string, opts?: { listen?: boolean }) => {
    setGraceSeed(seed ?? null);
    setGraceListen(opts?.listen ?? false);
    onNavigate('grace');
  };

  const handleTabChange = (next: GraceMobileTab) => {
    onNavigate(next === 'home' ? 'dashboard' : MOBILE_TAB_TO_VIEW[next]);
  };

  const renderScreen = () => {
    if (view === 'feed') {
      return (
        <BriefScreen people={people} tasks={tasks} prayers={prayers} readiness={readiness} onNavigate={onNavigate} />
      );
    }
    if (view === 'people') {
      return <PeopleScreen people={people} tasks={tasks} prayers={prayers} onNavigate={onNavigate} />;
    }
    if (view === 'sunday-prep') {
      return (
        <SundayScreen readiness={readiness} mergedEvents={mergedEvents} churchId={churchId} onNavigate={onNavigate} />
      );
    }
    if (view === 'tasks') {
      return <WorkScreen tasks={tasks} onNavigate={onNavigate} />;
    }
    if (view === 'grace') {
      return (
        <AskGraceScreen
          seed={graceSeed}
          onSeedConsumed={() => setGraceSeed(null)}
          autoListen={graceListen}
          onListenConsumed={() => setGraceListen(false)}
          onNavigate={onNavigate}
        />
      );
    }
    return (
      <HomeScreen
        userName={userName}
        churchTimezone={churchTimezone}
        people={people}
        tasks={tasks}
        prayers={prayers}
        mergedEvents={mergedEvents}
        readiness={readiness}
        onNavigate={onNavigate}
        onOpenGrace={openGrace}
      />
    );
  };

  return (
    <GraceMobileLayout
      activeTab={activeTab}
      onTabChange={handleTabChange}
      mode={isStack || isDrillDown ? 'stack' : 'tab'}
      churchName={churchName}
      branding={branding}
      userName={userName}
      roleLabel={roleLabel}
      onBack={isStack || isDrillDown ? () => onNavigate('dashboard') : undefined}
      headerTitle={
        isStack ? STACK_VIEWS[view] : isDrillDown ? (VIEW_LABELS[view] ?? prettify(view)) : undefined
      }
      moreLinks={moreLinks}
      onSelectMore={(v) => onNavigate(v as View)}
      onOpenGrace={openGrace}
      onMicTap={() => openGrace(undefined, { listen: true })}
      hideAskPill={view === 'grace'}
    >
      {MOBILE_NATIVE_VIEWS.has(view) ? renderScreen() : renderView(view)}
    </GraceMobileLayout>
  );
}
