import { lazy, Suspense, useEffect, useState } from 'react';
import { Home, Church, Compass, Users, User, HeartHandshake, Gift, Sparkles } from 'lucide-react';
import { parsePortalTab, navigatePortalTab, type PortalTab } from './portalNav';

const PortalHome = lazy(() => import('./pages/PortalHome').then(m => ({ default: m.PortalHome })));
const PortalChurch = lazy(() => import('./pages/PortalChurch').then(m => ({ default: m.PortalChurch })));
const PortalJourney = lazy(() => import('./pages/PortalJourney').then(m => ({ default: m.PortalJourney })));
const PortalCommunity = lazy(() => import('./pages/PortalCommunity').then(m => ({ default: m.PortalCommunity })));
const PortalCare = lazy(() => import('./pages/PortalCare').then(m => ({ default: m.PortalCare })));
const PortalGiving = lazy(() => import('./pages/PortalGiving').then(m => ({ default: m.PortalGiving })));
const PortalAssistant = lazy(() => import('./pages/PortalAssistant').then(m => ({ default: m.PortalAssistant })));
const PortalProfile = lazy(() => import('./pages/PortalProfile').then(m => ({ default: m.PortalProfile })));

const TABS: { id: PortalTab; label: string; icon: typeof Home }[] = [
  { id: 'home', label: 'My Home', icon: Home },
  { id: 'church', label: 'My Church', icon: Church },
  { id: 'journey', label: 'My Journey', icon: Compass },
  { id: 'community', label: 'My Community', icon: Users },
  { id: 'care', label: 'Care & Prayer', icon: HeartHandshake },
  { id: 'giving', label: 'Give', icon: Gift },
  { id: 'assistant', label: 'Ask GRACE', icon: Sparkles },
  { id: 'profile', label: 'My Profile', icon: User },
];

function PageFallback() {
  return (
    <div className="p-6 space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-16 rounded-xl bg-stone-100 animate-pulse" />
      ))}
    </div>
  );
}

export function PortalShell() {
  const [tab, setTab] = useState<PortalTab>(parsePortalTab());

  useEffect(() => {
    const onHashChange = () => setTab(parsePortalTab());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  function go(next: PortalTab) {
    navigatePortalTab(next);
    setTab(next);
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col sm:flex-row">
      {/* Desktop sidebar */}
      <nav
        className="hidden sm:flex sm:flex-col sm:w-56 sm:shrink-0 sm:border-r sm:border-stone-200 sm:bg-white sm:py-6 sm:px-3"
        aria-label="Members Portal navigation"
        data-testid="portal-nav-desktop"
      >
        <div className="flex items-center gap-2 px-2 mb-6">
          <div className="h-8 w-8 rounded-full bg-rose-600" aria-hidden="true" />
          <span className="font-semibold text-stone-900">My GRACE Portal</span>
        </div>
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium mb-1 text-left ${
                active ? 'bg-rose-50 text-rose-700' : 'text-stone-600 hover:bg-stone-100'
              }`}
            >
              <Icon size={18} /> {t.label}
            </button>
          );
        })}
      </nav>

      {/* Content */}
      <main className="flex-1 pb-20 sm:pb-0" role="main">
        <Suspense fallback={<PageFallback />}>
          {tab === 'home' && <PortalHome onNavigate={go} />}
          {tab === 'church' && <PortalChurch />}
          {tab === 'journey' && <PortalJourney />}
          {tab === 'community' && <PortalCommunity />}
          {tab === 'care' && <PortalCare />}
          {tab === 'giving' && <PortalGiving />}
          {tab === 'assistant' && <PortalAssistant />}
          {tab === 'profile' && <PortalProfile />}
        </Suspense>
      </main>

      {/* Mobile bottom tab bar */}
      <nav
        className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 flex items-stretch z-40"
        aria-label="Members Portal navigation"
        data-testid="portal-nav-mobile"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(t => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => go(t.id)}
              aria-current={active ? 'page' : undefined}
              aria-label={t.label}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium ${
                active ? 'text-rose-600' : 'text-stone-400'
              }`}
            >
              <Icon size={20} />
              {t.label.replace('My ', '')}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
