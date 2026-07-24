/**
 * Unit tests for the onboarding-checklist derivation (My Journey).
 * Confirms every step is a plain boolean from a real signal — no
 * weighting, no percentage, no aggregate score is ever computed.
 */
import { describe, it, expect } from 'vitest';
import { computeOnboardingSteps, currentOnboardingStep } from './portalJourney.js';

describe('computeOnboardingSteps', () => {
  it('marks every step incomplete when no signals are present', () => {
    const steps = computeOnboardingSteps({
      hasContactInfo: false,
      hasAnyConsentDecision: false,
      hasActiveGroup: false,
      hasEventRsvp: false,
    });
    expect(steps.every(s => !s.completed)).toBe(true);
    expect(steps).toHaveLength(4);
  });

  it('marks a step completed only when its specific real signal is true', () => {
    const steps = computeOnboardingSteps({
      hasContactInfo: true,
      hasAnyConsentDecision: false,
      hasActiveGroup: true,
      hasEventRsvp: false,
    });
    expect(steps.find(s => s.key === 'contact_info')!.completed).toBe(true);
    expect(steps.find(s => s.key === 'preferences')!.completed).toBe(false);
    expect(steps.find(s => s.key === 'group')!.completed).toBe(true);
    expect(steps.find(s => s.key === 'event')!.completed).toBe(false);
  });

  it('never produces a numeric score or percentage field', () => {
    const steps = computeOnboardingSteps({
      hasContactInfo: true, hasAnyConsentDecision: true, hasActiveGroup: true, hasEventRsvp: true,
    });
    for (const step of steps) {
      expect(Object.keys(step).sort()).toEqual(['completed', 'key', 'label']);
    }
  });
});

describe('currentOnboardingStep', () => {
  it('returns the first incomplete step', () => {
    const steps = computeOnboardingSteps({
      hasContactInfo: true, hasAnyConsentDecision: false, hasActiveGroup: false, hasEventRsvp: false,
    });
    expect(currentOnboardingStep(steps)?.key).toBe('preferences');
  });

  it('returns null when every step is complete', () => {
    const steps = computeOnboardingSteps({
      hasContactInfo: true, hasAnyConsentDecision: true, hasActiveGroup: true, hasEventRsvp: true,
    });
    expect(currentOnboardingStep(steps)).toBeNull();
  });
});
