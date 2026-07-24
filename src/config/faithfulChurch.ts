/**
 * Faithful Church — white-label tenant identity and Grace AI knowledge.
 * Active on the white-label demo hosts (grace-crm-two.vercel.app,
 * grace-crm.dev) via the hostname map in ./tenant.ts, or explicitly with
 * VITE_TENANT=faithful.
 *
 * Restored from reverted commit b005b5e (June 2026) — the original was
 * build-time (VITE_TENANT_DEFAULT) which couldn't vary per host within one
 * Vercel project; this version is resolved at runtime.
 */
import type { ChurchSettings } from '../hooks/useChurchSettings';

export const FAITHFUL_CHURCH_TIMEZONE = 'America/Chicago';

export const FAITHFUL_CHURCH_GRACE_FACTS = `Faithful Church welcomes everyone to grow in faith, serve their community, and belong.

GRACE stands for Growth, Resource, Assistance, Community, and Engagement — your guide through church life at Faithful Church.

Ministries include worship, small groups, youth and children's programs, missions, giving, pastoral care, and community outreach.

Tone: warm, welcoming, plainspoken — "you belong here; we're walking with you."`;

export const FAITHFUL_CHURCH_DEFAULT_SETTINGS: ChurchSettings = {
  profile: {
    name: 'Faithful Church',
    address: '100 Faithful Way',
    city: 'Springfield',
    state: 'IL',
    zip: '62701',
    phone: '(555) 555-0100',
    email: 'hello@faithfulchurch.org',
    website: 'https://faithfulchurch.org',
    serviceTimes: [
      { day: 'Sunday', time: '9:00 AM', name: 'Morning Worship' },
      { day: 'Sunday', time: '11:00 AM', name: 'Morning Worship' },
      { day: 'Wednesday', time: '6:30 PM', name: 'Midweek Gathering' },
    ],
    liveStreamUrl: '',
    currentSeries: {
      title: 'Walking in Faith',
      part: 'Part 3',
      speaker: 'Pastor James Wilson',
    },
  },
  graceFacts: FAITHFUL_CHURCH_GRACE_FACTS,
  timezone: FAITHFUL_CHURCH_TIMEZONE,
  integrations: {},
  notifications: {
    newVisitorAlerts: true,
    taskReminders: true,
    prayerNotifications: false,
    birthdayReminders: true,
  },
  branding: {
    primaryColor: '#449eca',
    logoUrl: '/previews/assets/faithful-church-logo.png',
  },
  onboarding: {
    wizardCompleted: false,
    wizardDismissed: false,
    completedSteps: [],
    checklistDismissed: false,
    graceIntroDismissed: false,
  },
};
