import React from 'react';
import ReactDOM from 'react-dom/client';
import { ThemeProvider } from '@grace/platform-core/theme';
import { getTenant } from '@grace/platform-core/tenant';
import { handleDemoEntryQuery } from '@grace/platform-core/demoEntry';
import { checkEnvironment } from '@grace/platform-core/envCheck';
import { initSentry, initPosthog, SentryErrorBoundary } from '@grace/platform-core/observability';
import { UpdatePrompt } from '@grace/platform-core/UpdatePrompt';
import { PortalRoot } from './portal/PortalRoot';
import './tailwind.css';

// Tenant theming — resolved at RUNTIME (hostname map / VITE_TENANT), same
// as apps/admin-web/src/main.tsx. Kept in sync deliberately: both apps
// share one HOST_TENANTS map (packages/platform-core/src/tenant.ts).
const ACTIVE_TENANT = getTenant();
if (ACTIVE_TENANT.id !== 'centralHenderson') {
  document.documentElement.dataset.tenant = ACTIVE_TENANT.id;
  const brand = ACTIVE_TENANT.defaultSettings.branding?.primaryColor;
  if (brand) {
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', brand);
  }
} else if (typeof window !== 'undefined') {
  const host = window.location.hostname;
  if (host !== 'localhost' && host !== '127.0.0.1') {
    fetch(`/api/tenant/config?host=${encodeURIComponent(host)}`)
      .then(r => (r.ok ? r.json() : null))
      .then((data: { church_name?: string | null; branding?: { primaryColor?: string; logoUrl?: string } } | null) => {
        const brand = data?.branding?.primaryColor;
        if (brand) {
          document.querySelector('meta[name="theme-color"]')?.setAttribute('content', brand);
        }
      })
      .catch(() => {});
  }
}

// Init Sentry first so anything thrown during setup is captured.
initSentry();
void initPosthog();

checkEnvironment();
handleDemoEntryQuery();

// If index.html came from a newer deploy than this tab's cached bundle,
// reload once — mirrors apps/admin-web. UpdatePrompt (below) handles the
// separate case of an already-open tab whose service worker updates in
// the background.
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
        <PortalRoot />
      </ThemeProvider>
    </SentryErrorBoundary>
  </React.StrictMode>
);
