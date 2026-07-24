/**
 * Onboarding-checklist derivation for the Members Portal "My Journey" tab.
 *
 * Deliberately NOT a scoring system: every step is a plain boolean
 * derived from a real, explicit signal (profile fields on file, a
 * consent decision recorded, an active group membership, an event
 * RSVP). There is no weighting, no percentage, no "spiritual score" —
 * see migration 042's comment on member_journey_items for the same
 * constraint applied to the schema.
 */

export interface OnboardingSignals {
  hasContactInfo: boolean; // phone or address on file
  hasAnyConsentDecision: boolean; // at least one consents row exists
  hasActiveGroup: boolean; // at least one active group_memberships row
  hasEventRsvp: boolean; // at least one event_rsvps row
}

export interface OnboardingStep {
  key: string;
  label: string;
  completed: boolean;
}

export function computeOnboardingSteps(signals: OnboardingSignals): OnboardingStep[] {
  return [
    { key: 'contact_info', label: 'Add your contact information', completed: signals.hasContactInfo },
    { key: 'preferences', label: 'Set your communication preferences', completed: signals.hasAnyConsentDecision },
    { key: 'group', label: 'Explore a group', completed: signals.hasActiveGroup },
    { key: 'event', label: 'RSVP to an event', completed: signals.hasEventRsvp },
  ];
}

export function currentOnboardingStep(steps: OnboardingStep[]): OnboardingStep | null {
  return steps.find(s => !s.completed) ?? null;
}
