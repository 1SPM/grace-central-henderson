/**
 * PII scrubber for Sentry events.
 *
 * Single source of truth for the sensitive-key pattern used by both
 * the client (src/lib/observability/sentry.ts) and the server
 * (api/_lib/sentry.ts). Pure — no I/O, no globals.
 */

export const SENSITIVE_KEY_PATTERN =
  /(authorization|cookie|password|secret|token|api[_-]?key|csrf|sessionid|set-cookie|x-stripe-signature|x-clerk-signature|svix-signature)/i;

export function scrub(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(scrub);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY_PATTERN.test(k)) {
      out[k] = '[REDACTED]';
    } else {
      out[k] = scrub(v);
    }
  }
  return out;
}

export function stripQuery(url: string | undefined): string | undefined {
  if (!url) return url;
  const idx = url.indexOf('?');
  return idx === -1 ? url : url.slice(0, idx);
}
