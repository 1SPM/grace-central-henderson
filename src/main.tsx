import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './ThemeContext';
import { ToastProvider } from './components/Toast';
import { AuthProvider, IntegrationsProvider, AccessibilityProvider } from './contexts';
import { checkEnvironment } from './utils/envCheck';
import './index.css';

// Surface missing config early instead of failing silently
checkEnvironment();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AccessibilityProvider>
        <AuthProvider>
          <IntegrationsProvider>
            <ToastProvider>
              <App />
            </ToastProvider>
          </IntegrationsProvider>
        </AuthProvider>
      </AccessibilityProvider>
    </ThemeProvider>
  </React.StrictMode>
);
