/**
 * Central Henderson Church — demo tenant identity and Grace AI knowledge.
 * Single source of truth for admin CRM defaults and member-portal context.
 * @see https://centralchurch.online/locations/henderson/
 */
import type { ChurchSettings } from '../hooks/useChurchSettings';

export const CENTRAL_HENDERSON_TIMEZONE = 'America/Los_Angeles';

export const CENTRAL_HENDERSON_GRACE_FACTS = `Central Henderson Church (Central Church — Henderson campus) welcomes everyone to come as they are.

Location: 1001 New Beginnings Dr, Henderson, NV 89011
Phone: 702-735-4004
Email: info@centralchurch.online
Website: https://centralchurch.online/locations/henderson/

Weekend experience times (Pacific):
- Saturday 5:00 PM
- Sunday 9:45 AM, 11:30 AM, 1:00 PM, and 5:00 PM (Spanish service)

Ministries:
- Central Kids — preschool through kindergarten and elementary (1st–5th grade), age-appropriate environments
- Central Youth — middle and high school students; meets during weekend experiences upstairs in the Apex; CY Groups for discussion
- First Step — onboarding for new guests
- Small groups, volunteer teams, giving, and events throughout the week

Tone: warm, welcoming, plainspoken — "it's okay to not be okay; you belong here."`;

export const CENTRAL_HENDERSON_DEFAULT_SETTINGS: ChurchSettings = {
  profile: {
    name: 'Central Henderson Church',
    address: '1001 New Beginnings Dr',
    city: 'Henderson',
    state: 'NV',
    zip: '89011',
    phone: '702-735-4004',
    email: 'info@centralchurch.online',
    website: 'https://centralchurch.online/locations/henderson/',
    serviceTimes: [
      { day: 'Saturday', time: '5:00 PM', name: 'Weekend Experience' },
      { day: 'Sunday', time: '9:45 AM', name: 'Weekend Experience' },
      { day: 'Sunday', time: '11:30 AM', name: 'Weekend Experience' },
      { day: 'Sunday', time: '1:00 PM', name: 'Weekend Experience' },
      { day: 'Sunday', time: '5:00 PM', name: 'Weekend Experience (Spanish)' },
    ],
    liveStreamUrl: 'https://www.youtube.com/embed/live_stream?channel=UCentralHenderson',
    currentSeries: {
      title: 'Honor Each Other',
      part: 'Part 4',
      speaker: 'Pastor James Wilson',
    },
  },
  graceFacts: CENTRAL_HENDERSON_GRACE_FACTS,
  timezone: CENTRAL_HENDERSON_TIMEZONE,
  integrations: {},
  notifications: {
    newVisitorAlerts: true,
    taskReminders: true,
    prayerNotifications: false,
    birthdayReminders: true,
  },
  branding: {},
  onboarding: {
    wizardCompleted: false,
    wizardDismissed: false,
    completedSteps: [],
    checklistDismissed: false,
    graceIntroDismissed: false,
  },
};

/** Applied when a visitor enters the demo via marketing CTAs. */
export const DEMO_ONBOARDING_SKIP = {
  wizardCompleted: true,
  wizardDismissed: true,
  checklistDismissed: true,
  tutorialPickerShown: true,
  graceIntroDismissed: true,
  completedSteps: ['profile', 'import', 'giving'],
} as const;

/** Short label for sidebar / compact UI (e.g. "Central Henderson"). */
export function churchShortName(fullName: string): string {
  if (!fullName) return 'GRACE';
  return fullName
    .replace(/\bChurch\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim() || fullName;
}
