/**
 * Compatibility shim.
 *
 * Sentry server-side init now lives in `api/instrument.ts`, which
 * MUST be imported as the first side-effect import in api/_server.ts
 * so Sentry.init() runs before Express / http are evaluated.
 *
 * This file re-exports the Sentry namespace and a flag for any code
 * that wants to know whether Sentry is active.
 */

export { Sentry, sentryEnabled } from '../instrument';
