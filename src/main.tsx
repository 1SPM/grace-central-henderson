import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { ThemeProvider } from './ThemeContext';
import { ToastProvider } from './components/Toast';
import { AuthProvider, IntegrationsProvider } from './contexts';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <IntegrationsProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </IntegrationsProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>
);
