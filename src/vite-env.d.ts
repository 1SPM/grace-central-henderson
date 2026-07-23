/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase (Database)
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // Fallback church UUID when Clerk isn't configured (single-tenant interim)
  readonly VITE_DEFAULT_CHURCH_ID?: string;

  /** Explicit tenant override (see src/config/tenant.ts). Usually unset —
   * white-label demo hosts resolve via the runtime hostname map. */
  readonly VITE_TENANT?: string;

  readonly VITE_ENABLE_DEMO_MODE?: string;

  // Clerk (Authentication)
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;

  // Interim admin display name when auth has no first name yet
  readonly VITE_TEMP_NAME?: string;

  // Stripe (Payments)
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;

  // Email sender identity (display only — the Resend API key is a
  // backend-only secret, never VITE_-prefixed, so it can't reach the
  // browser bundle). SMS/Twilio credentials are likewise backend-only:
  // no VITE_TWILIO_* / VITE_RESEND_API_KEY exists here on purpose, so a
  // secret can't be accidentally browser-exposed by declaring it.
  readonly VITE_EMAIL_FROM_ADDRESS?: string;
  readonly VITE_EMAIL_FROM_NAME?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
