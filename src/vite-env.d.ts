/// <reference types="vite/client" />

interface ImportMetaEnv {
  // Supabase (Database)
  readonly VITE_SUPABASE_URL: string;
  readonly VITE_SUPABASE_ANON_KEY: string;

  // Clerk (Authentication)
  readonly VITE_CLERK_PUBLISHABLE_KEY?: string;

  // Stripe (Payments)
  readonly VITE_STRIPE_PUBLISHABLE_KEY?: string;

  // Resend (Email)
  readonly VITE_RESEND_API_KEY?: string;
  readonly VITE_EMAIL_FROM_ADDRESS?: string;
  readonly VITE_EMAIL_FROM_NAME?: string;

  // Twilio (SMS)
  readonly VITE_TWILIO_ACCOUNT_SID?: string;
  readonly VITE_TWILIO_AUTH_TOKEN?: string;
  readonly VITE_TWILIO_PHONE_NUMBER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
