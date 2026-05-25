/**
 * Sentry — client-side error monitoring.
 *
 * PII redaction:
 *  - `sendDefaultPii: false`
 *  - `beforeSend` scrubs known sensitive keys from event payloads
 *  - URLs are stripped of query strings (might carry tokens)
 *
 * No-op if VITE_SENTRY_DSN is not configured. Calling initSentry()
 * twice is safe.
 */

import * as Sentry from '@sentry/react';
import { scrub, stripQuery } from './scrub';

let initialized = false;

export function initSentry(): void {
  if (initialized) return;

  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_SENTRY_ENVIRONMENT || (import.meta.env.PROD ? 'production' : 'development'),
    release: import.meta.env.VITE_SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 0,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: import.meta.env.PROD ? 0.1 : 0,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],
    beforeSend(event) {
      if (event.request) {
        event.request.headers = scrub(event.request.headers) as typeof event.request.headers;
        event.request.cookies = undefined;
        event.request.url = stripQuery(event.request.url);
        if (event.request.data) {
          event.request.data = scrub(event.request.data);
        }
      }
      if (event.extra) event.extra = scrub(event.extra) as typeof event.extra;
      if (event.contexts) event.contexts = scrub(event.contexts) as typeof event.contexts;
      if (event.user) {
        event.user = {
          id: event.user.id,
          ip_address: undefined,
          email: undefined,
          username: undefined,
        };
      }
      return event;
    },
    beforeBreadcrumb(crumb) {
      if (crumb.category === 'fetch' || crumb.category === 'xhr') {
        if (crumb.data && typeof crumb.data === 'object') {
          crumb.data = scrub(crumb.data) as typeof crumb.data;
        }
      }
      return crumb;
    },
  });

  initialized = true;
}

export function setSentryUser(userId: string | undefined, churchId: string | undefined): void {
  if (!initialized) return;
  if (!userId) {
    Sentry.setUser(null);
    return;
  }
  Sentry.setUser({ id: userId });
  if (churchId) {
    Sentry.setTag('church_id', churchId);
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (!initialized) {
    // Local fallback so failures aren't lost in dev
    console.error('[capture]', err, context);
    return;
  }
  if (context) {
    Sentry.withScope((scope) => {
      scope.setContext('extra', scrub(context) as Record<string, unknown>);
      Sentry.captureException(err);
    });
  } else {
    Sentry.captureException(err);
  }
}

export const SentryErrorBoundary = Sentry.ErrorBoundary;
