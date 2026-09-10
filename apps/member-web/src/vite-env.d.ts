/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase (Database)
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  /** Explicit tenant override (see packages/platform-core/src/tenant.ts).
   * Usually unset — white-label demo hosts resolve via the runtime
   * hostname map. */
  readonly VITE_TENANT?: string;

  readonly VITE_ENABLE_DEMO_MODE?: string;

  // Clerk (Authentication)
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;

  // Stripe (Payments — member giving)
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;

  // Observability
  readonly VITE_SENTRY_DSN?: string;
  readonly VITE_SENTRY_ENVIRONMENT?: string;
  readonly VITE_SENTRY_RELEASE?: string;
  readonly VITE_POSTHOG_KEY?: string;
  readonly VITE_POSTHOG_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
