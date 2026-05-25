/**
 * Sentry — server-side error monitoring.
 *
 * Init must run BEFORE any other instrumentation that hooks into
 * the Node runtime (Express, http, fetch). See:
 *   https://docs.sentry.io/platforms/javascript/guides/node/
 *
 * No-op if SENTRY_DSN is not configured.
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { scrub, stripQuery } from '../../src/lib/observability/scrub';

let initialized = false;

export function initSentryServer(): boolean {
  if (initialized) return true;

  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return false;

  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
    release: process.env.SENTRY_RELEASE,
    sendDefaultPii: false,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? (process.env.NODE_ENV === 'production' ? 0.1 : 0)),
    profilesSampleRate: Number(process.env.SENTRY_PROFILES_SAMPLE_RATE ?? 0),
    integrations: [nodeProfilingIntegration()],
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
        event.user = { id: event.user.id };
      }
      return event;
    },
  });

  initialized = true;
  return true;
}

export { Sentry };
