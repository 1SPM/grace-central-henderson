import React, { lazy, Suspense, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './ThemeContext';
import { ToastProvider } from './components/Toast';
import { AuthProvider, IntegrationsProvider, AccessibilityProvider } from './contexts';
import { handleDemoEntryQuery } from './lib/demoEntry';
import { checkEnvironment } from './utils/envCheck';
import { supabase } from './lib/supabase';
import { initSentry, initPosthog, SentryErrorBoundary } from './lib/observability';
import './index.css';
import './styles/grace-orb.css';

// Init Sentry first so anything thrown during setup is captured.
initSentry();
// PostHog is lazy and no-ops without a key — safe to fire-and-forget.
void initPosthog();

// Surface missing config early instead of failing silently
checkEnvironment();
handleDemoEntryQuery();

// Public routes that bypass auth entirely
const isConnectRoute = window.location.pathname === '/connect';
const isLeadersRoute = window.location.pathname === '/leaders';
const isMarketplaceRoute = window.location.pathname === '/verified-leaders' || window.location.pathname === '/marketplace';
const isRedesignRoute = window.location.pathname === '/redesign';
const ConnectCard = lazy(() => import('./components/ConnectCard').then(m => ({ default: m.ConnectCard })));
const LeaderApply = lazy(() => import('./components/LeaderApply').then(m => ({ default: m.LeaderApply })));
const VerifiedLeaders = lazy(() => import('./components/VerifiedLeaders').then(m => ({ default: m.VerifiedLeaders })));
const RedesignPreview = lazy(() => import('./components/redesign/RedesignPreview').then(m => ({ default: m.RedesignPreview })));

function PublicConnectPage() {
  const [churchName, setChurchName] = useState('Our Church');
  const [churchId, setChurchId] = useState('demo-church');

  useEffect(() => {
    async function loadChurch() {
      if (!supabase) return;
      try {
        const { data } = await supabase
          .from('churches')
          .select('id, settings')
          .limit(1)
          .single();
        if (data) {
          setChurchId(data.id);
          const settings = data.settings as Record<string, unknown> | null;
          const profile = settings?.profile as Record<string, unknown> | null;
          if (profile?.name && typeof profile.name === 'string') {
            setChurchName(profile.name);
          }
        }
      } catch {
        // Use defaults
      }
    }
    loadChurch();
  }, []);

  return (
    <Suspense fallback={
      <div className="h-screen bg-gradient-to-br from-indigo-50 to-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <ConnectCard churchName={churchName} churchId={churchId} mode="public" />
    </Suspense>
  );
}

import { UpdatePrompt } from './components/UpdatePrompt';

// If index.html came from a newer deploy than this tab's cached bundle, reload once.
const buildMeta = document.querySelector('meta[name="grace-build"]')?.getAttribute('content');
const storedBuild = localStorage.getItem('grace-build');
if (buildMeta && storedBuild && buildMeta !== storedBuild) {
  localStorage.setItem('grace-build', buildMeta);
  if ('serviceWorker' in navigator) {
    void navigator.serviceWorker.getRegistrations().then(regs =>
      Promise.all(regs.map(r => r.unregister())),
    ).finally(() => window.location.reload());
  } else {
    window.location.reload();
  }
} else if (buildMeta) {
  localStorage.setItem('grace-build', buildMeta);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SentryErrorBoundary fallback={<div style={{ padding: 24 }}>Something went wrong. The team has been notified.</div>}>
    <ThemeProvider>
      <UpdatePrompt />
      {isLeadersRoute ? (
        <Suspense fallback={
          <div className="h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          </div>
        }>
          <LeaderApply />
        </Suspense>
      ) : isMarketplaceRoute ? (
        <Suspense fallback={
          <div className="h-screen bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600"></div>
          </div>
        }>
          <VerifiedLeaders />
        </Suspense>
      ) : isRedesignRoute ? (
        <Suspense fallback={
          <div className="h-screen bg-slate-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        }>
          <RedesignPreview />
        </Suspense>
      ) : isConnectRoute ? (
        <PublicConnectPage />
      ) : (
        <AccessibilityProvider>
          <AuthProvider>
            <IntegrationsProvider>
              <ToastProvider>
                <App />
              </ToastProvider>
            </IntegrationsProvider>
          </AuthProvider>
        </AccessibilityProvider>
      )}
    </ThemeProvider>
    </SentryErrorBoundary>
  </React.StrictMode>
);
