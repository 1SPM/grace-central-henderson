/**
 * Sentry instrumentation bootstrap.
 *
 * MUST be imported as the very first side-effect import in
 * api/_server.ts (or loaded via `node --import ./api/instrument.ts`)
 * so Sentry.init() runs at MODULE TOP LEVEL — before Express, http,
 * or fetch are evaluated. This is required for auto-instrumentation
 * to patch the runtime correctly:
 *   https://docs.sentry.io/platforms/javascript/guides/node/#configure
 *
 * Importing this file is a no-op when SENTRY_DSN is unset.
 *
 * Do not call Sentry.init() anywhere else in the server code path.
 */

import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import { scrub, stripQuery } from '../src/lib/observability/scrub.js';

const dsn = process.env.SENTRY_DSN;

export const sentryEnabled = Boolean(dsn);

if (dsn) {
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
}

export { Sentry };
