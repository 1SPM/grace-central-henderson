/**
 * Pure derivation logic for communication_preferences, split out of
 * api/consents/_index.ts so it's unit-testable without a Supabase client.
 */

import type { ConsentType, ConsentStatus } from '../../src/types/shared-platform.js';

export interface ConsentRow {
  consent_type: ConsentType;
  status: ConsentStatus;
}

export interface DerivedCommunicationFlags {
  email_enabled: boolean;
  sms_enabled: boolean;
  push_enabled: boolean;
}

/**
 * Derives the denormalized communication_preferences boolean flags from
 * the full set of a person's consent rows. Only 'granted' counts — both
 * 'denied' (never asked/opted in) and 'withdrawn' (opted out after
 * granting) resolve to false, which is the fail-closed default for any
 * outbound-messaging decision.
 */
export function deriveCommunicationFlags(consents: ConsentRow[]): DerivedCommunicationFlags {
  const granted = new Set(consents.filter(c => c.status === 'granted').map(c => c.consent_type));
  return {
    email_enabled: granted.has('email'),
    sms_enabled: granted.has('sms'),
    push_enabled: granted.has('push_notification'),
  };
}
