import { describe, it, expect } from 'vitest';
import {
  isExposedPublicSecret,
  findServiceRoleUsage,
  extractEnvReads,
  extractEnvDeclarations,
  runFrontendSafety,
} from './check-frontend-safety.js';

describe('isExposedPublicSecret', () => {
  it('clears the app’s real public vars (must not false-positive)', () => {
    for (const ok of [
      'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VITE_CLERK_PUBLISHABLE_KEY',
      'VITE_STRIPE_PUBLISHABLE_KEY', 'VITE_POSTHOG_KEY', 'VITE_POSTHOG_HOST',
      'VITE_DID_CLIENT_KEY', 'VITE_DID_AGENT_ID', 'VITE_SENTRY_DSN',
      'VITE_EMAIL_FROM_ADDRESS', 'VITE_ENABLE_DEMO_MODE', 'VITE_DEFAULT_CHURCH_ID',
    ]) {
      expect(isExposedPublicSecret(ok), ok).toBe(false);
    }
  });

  it('flags a public-prefixed name that looks secret', () => {
    for (const bad of [
      'VITE_RESEND_API_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY', 'VITE_TWILIO_AUTH_TOKEN',
      'VITE_SOME_SECRET', 'VITE_DB_PASSWORD', 'NEXT_PUBLIC_STRIPE_SECRET_KEY',
    ]) {
      expect(isExposedPublicSecret(bad), bad).toBe(true);
    }
  });

  it('ignores non-public-prefixed names (server-side is fine)', () => {
    expect(isExposedPublicSecret('RESEND_API_KEY')).toBe(false);
    expect(isExposedPublicSecret('SUPABASE_SERVICE_ROLE_KEY')).toBe(false);
  });
});

describe('findServiceRoleUsage', () => {
  it('catches an actual env read of a service-role key', () => {
    expect(findServiceRoleUsage('const k = process.env.SUPABASE_SERVICE_ROLE_KEY;')).toEqual([1]);
    expect(findServiceRoleUsage('x\nimport.meta.env.SUPABASE_SERVICE_KEY\ny')).toEqual([2]);
  });
  it('does NOT flag a bare string mention (e.g. a user-facing message)', () => {
    expect(findServiceRoleUsage('msg: "ask your admin to set SUPABASE_SERVICE_ROLE_KEY on Vercel"')).toEqual([]);
  });
});

describe('extractors scan usage, not comments', () => {
  it('extractEnvReads only matches actual reads', () => {
    expect(extractEnvReads('const a = import.meta.env.VITE_SUPABASE_URL;')).toEqual(['VITE_SUPABASE_URL']);
    // a comment mentioning a name is NOT a read → not extracted
    expect(extractEnvReads('// no VITE_RESEND_API_KEY exists here on purpose')).toEqual([]);
  });
  it('extractEnvDeclarations matches NAME= lines', () => {
    expect(extractEnvDeclarations('VITE_POSTHOG_KEY=abc\n# VITE_COMMENTED=nope\nOTHER=1')).toEqual(['VITE_POSTHOG_KEY']);
  });
});

describe('runFrontendSafety (integration on the real repo)', () => {
  it('the current frontend + .env.example are clean (0 findings)', () => {
    expect(runFrontendSafety('src', ['.env.example'])).toEqual([]);
  });
});
