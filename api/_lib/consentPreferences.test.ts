/**
 * Unit tests for consent-derived communication preferences (consent enforcement).
 */
import { describe, it, expect } from 'vitest';
import { deriveCommunicationFlags } from './consentPreferences.js';

describe('deriveCommunicationFlags', () => {
  it('enables a channel only when its consent is granted', () => {
    const flags = deriveCommunicationFlags([
      { consent_type: 'email', status: 'granted' },
      { consent_type: 'sms', status: 'denied' },
    ]);
    expect(flags).toEqual({ email_enabled: true, sms_enabled: false, push_enabled: false });
  });

  it('treats a withdrawn consent the same as denied (fail-closed)', () => {
    const flags = deriveCommunicationFlags([
      { consent_type: 'email', status: 'withdrawn' },
      { consent_type: 'push_notification', status: 'granted' },
    ]);
    expect(flags.email_enabled).toBe(false);
    expect(flags.push_enabled).toBe(true);
  });

  it('defaults every channel to disabled when there are no consent rows yet', () => {
    const flags = deriveCommunicationFlags([]);
    expect(flags).toEqual({ email_enabled: false, sms_enabled: false, push_enabled: false });
  });

  it('ignores non-channel consent types (e.g. directory_visibility) when deriving channel flags', () => {
    const flags = deriveCommunicationFlags([
      { consent_type: 'directory_visibility', status: 'granted' },
      { consent_type: 'photograph', status: 'granted' },
    ]);
    expect(flags).toEqual({ email_enabled: false, sms_enabled: false, push_enabled: false });
  });
});
