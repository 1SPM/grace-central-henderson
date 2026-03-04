import React, { lazy, Suspense, useState, useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './ThemeContext';
import { ToastProvider } from './components/Toast';
import { AuthProvider, IntegrationsProvider, AccessibilityProvider } from './contexts';
import { checkEnvironment } from './utils/envCheck';
import { supabase } from './lib/supabase';
import './index.css';

// Surface missing config early instead of failing silently
checkEnvironment();

// Public routes that bypass auth entirely
const isConnectRoute = window.location.pathname === '/connect';
const ConnectCard = lazy(() => import('./components/ConnectCard').then(m => ({ default: m.ConnectCard })));

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
      <div className="h-screen bg-gradient-to-br from-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    }>
      <ConnectCard churchName={churchName} churchId={churchId} mode="public" />
    </Suspense>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      {isConnectRoute ? (
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
  </React.StrictMode>
);
