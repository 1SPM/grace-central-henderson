/**
 * Single source of truth for the GRACE platform fee on donations.
 *
 * Applied by Stripe as `application_fee_amount` (one-time gifts, computed
 * from the bps rate at PaymentIntent creation — see api/giving/_create-
 * payment-intent.ts) or `application_fee_percent` (recurring gifts, set
 * directly on the Subscription — see api/giving/_create-subscription.ts).
 *
 * The webhook handlers in webhooks/stripe-handlers.ts record whichever
 * value Stripe actually applied into the ledger entry's metadata, and
 * agentWorkflows.ts's Steward workflow compares that recorded value
 * against this constant to catch drift.
 *
 * Keep in sync with the display-only copy of this constant in
 * src/components/settings/SettingsGiving.tsx.
 */
export const PLATFORM_FEE_BPS = 75; // 0.75%
export const PLATFORM_FEE_PERCENT = PLATFORM_FEE_BPS / 100;
