/**
 * Automation catalog — maps implemented agents to the service names
 * pastors saw in discovery (OPERATIONS/Discovery_Questions_Mapped_to_
 * AI_Agents___Services.csv), so the Settings Automation tab speaks the
 * same language the church was introduced to. Also lists services from
 * the discovery map that aren't built yet, presented as offerings.
 */

export type AgentGroup = 'care' | 'giving' | 'operations' | 'messaging';

export interface CatalogAgent {
  /** Internal agent id (server agents or messaging agents). */
  id: string;
  /** Discovery-aligned display name. */
  name: string;
  group: AgentGroup;
  /** What it watches for / does, in plain warm language. */
  description: string;
  /** True for the client messaging agents whose toggle lives in messaging_settings. */
  messaging?: boolean;
}

export const CATALOG_AGENTS: CatalogAgent[] = [
  {
    id: 'member-care',
    name: 'Pastoral Care Agent',
    group: 'care',
    description: 'Watches for recent visitors who need a follow-up, birthdays coming up, and members who have quietly gone inactive.',
  },
  {
    id: 'crisis-escalation',
    name: '24/7 Pastoral Support Escalation',
    group: 'care',
    description: 'When a care conversation shows signs of crisis, it brings a human in right away.',
  },
  {
    id: 'stewardship',
    name: 'Finance & Stewardship Monitor',
    group: 'giving',
    description: 'Notices lapsed givers, first-time gifts worth celebrating, and unusually large gifts that deserve a personal thank-you.',
  },
  {
    id: 'card-ops',
    name: 'Good Steward Card Operations',
    group: 'giving',
    description: 'Keeps an eye on Impact Card applications that stall and cards left frozen.',
  },
  {
    id: 'operations',
    name: 'Service Planning Assistant',
    group: 'operations',
    description: 'Flags upcoming events without a leader assigned and tasks that have slipped past their due date.',
  },
  {
    id: 'portal-engagement',
    name: 'Analytics & Engagement Tracker',
    group: 'operations',
    description: 'Tracks member portal activity and surfaces people who never signed in or drifted away.',
  },
  {
    id: 'life-event-agent',
    name: 'Life Event Recognition Agent',
    group: 'messaging',
    messaging: true,
    description: 'Sends warm birthday and anniversary greetings on your behalf.',
  },
  {
    id: 'new-member-agent',
    name: 'New Member Integration Agent',
    group: 'messaging',
    messaging: true,
    description: 'Walks new members through a welcome sequence in their first weeks.',
  },
  {
    id: 'donation-processing-agent',
    name: 'Donation Processing Agent',
    group: 'messaging',
    messaging: true,
    description: 'Thanks givers personally — especially first-time and large gifts.',
  },
];

export const GROUP_LABELS: Record<AgentGroup, string> = {
  care: 'Care',
  giving: 'Giving & Stewardship',
  operations: 'Operations',
  messaging: 'Messaging',
};

/** Discovery services not yet built — offered, not enabled. */
export const CATALOG_OFFERINGS: Array<{ name: string; description: string }> = [
  { name: 'Volunteer Coordination Agent', description: 'Coordinates volunteers for services, large events, and outreach projects.' },
  { name: 'Community Event Promotion Agent', description: 'Promotes community events and mission initiatives across your channels.' },
  { name: 'Media Asset Management Agent', description: 'Organizes sermon recordings and media, and helps share them after the service.' },
  { name: 'Live Service Companion Agent', description: 'Engages online viewers during live streams.' },
  { name: 'Mission Partner Update Agent', description: 'Collects and shares updates from missionaries and outreach partners.' },
  { name: 'Content Translation Agent', description: 'Translates sermons and announcements so every language in your congregation is served.' },
  { name: 'Youth Ministry Parent Updates', description: 'Keeps parents in the loop on youth ministry happenings.' },
  { name: 'Facility & Event Scheduling Agent', description: 'Schedules facilities and heads off booking conflicts.' },
  { name: 'HR & Volunteer Onboarding Agent', description: 'Onboards new staff and volunteers with less paperwork.' },
  { name: 'Virtual Worship Space', description: 'A digital community space beyond social media, moderated and welcoming.' },
];
