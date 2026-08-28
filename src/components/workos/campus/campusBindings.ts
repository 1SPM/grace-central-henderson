/**
 * Campus bindings — what each building on the Virtual Campus corresponds to
 * in the CRM.
 *
 * A "department" is the church-office function a room houses. Each one lists
 * the live CRM surfaces that belong to it (deep links into existing hubs) and
 * which registered agents sit there by default. Nothing here invents a new
 * capability: every route already exists, every agent key is in
 * api/_lib/agentRegistry.ts, and every permission key is in migration 032/039.
 *
 * Default agent seating lives in campusAssignments.ts and is meant to be
 * edited — the office is the model; the seating chart is the config.
 */
import type { View } from '../../../types';

export interface CampusRoute {
  label: string;
  /** The View the hash route belongs to (drives setView). */
  view: View;
  /** Full hash, e.g. '#/pastoral-care?tab=requests'. */
  hash: string;
  /** Permission the server gates this surface on, shown as a hint. */
  permission?: string;
}

export interface CampusDepartment {
  id: string;
  /** Department name as it appears in the side panel. */
  name: string;
  /** One line: what happens at this desk, written from the church's side. */
  blurb: string;
  routes: CampusRoute[];
  /** Confidential-tier room: the campus shows presence and counts only. */
  confidential?: boolean;
  /** Non-registry cron agents that report here (shown as a crew, not pips). */
  nightCrew?: string[];
}

export const DEPARTMENTS: Record<string, CampusDepartment> = {
  entrance: {
    id: 'entrance',
    name: 'Entrance & Canopy',
    blurb: 'Where Sunday starts: QR check-in at the door and the public Connect Card.',
    routes: [
      { label: 'QR Check-In', view: 'qr-checkin', hash: '#/qr-checkin' },
      { label: 'Connect Card (public form)', view: 'connect-card', hash: '#/connect-card' },
    ],
  },
  welcome: {
    id: 'welcome',
    name: 'Welcome Center',
    blurb: 'First visits, newcomer follow-up, the visitor pipeline, and member invitations.',
    routes: [
      { label: 'Congregation · Directory', view: 'people', hash: '#/people', permission: 'people.view' },
      { label: 'Follow-ups (Action Center)', view: 'feed', hash: '#/actions' },
      { label: 'Birthdays this week', view: 'feed', hash: '#/actions?tab=birthdays' },
    ],
  },
  facilities: {
    id: 'facilities',
    name: 'Facilities',
    blurb: 'Restrooms. No CRM surface lives here — the campus is honest about empty rooms.',
    routes: [],
  },
  communications: {
    id: 'communications',
    name: 'Communications Office',
    blurb: 'Mail, announcements, scheduled and pending outbound messages. Everything stays draft until a person sends it.',
    routes: [
      { label: 'Mail', view: 'feed', hash: '#/actions?tab=mail', permission: 'communications.view' },
      { label: 'Announcements', view: 'sunday-prep', hash: '#/sunday-prep?tab=announcements' },
      { label: 'Email templates', view: 'settings', hash: '#/settings?tab=email-templates' },
    ],
  },
  sanctuary: {
    id: 'sanctuary',
    name: 'Sanctuary',
    blurb: 'Sunday service tools: order of service, attendance, live service, the church calendar.',
    routes: [
      { label: 'Sunday Service Tools', view: 'sunday-prep', hash: '#/sunday-prep' },
      { label: 'Attendance', view: 'sunday-prep', hash: '#/sunday-prep?tab=attendance', permission: 'events.view' },
      { label: 'Live Service', view: 'feed', hash: '#/actions?tab=live' },
      { label: 'Calendar', view: 'sunday-prep', hash: '#/sunday-prep?tab=calendar' },
    ],
  },
  worship: {
    id: 'worship',
    name: 'Music Room',
    blurb: 'Worship and music: service planning, and the skills & talents register for musicians and tech volunteers.',
    routes: [
      { label: 'Service planning', view: 'sunday-prep', hash: '#/sunday-prep' },
      { label: 'Skills & Talents', view: 'people', hash: '#/people?tab=skills' },
    ],
  },
  platform_back: {
    id: 'platform_back',
    name: 'Baptistry & Sound Booth',
    blurb: 'Baptisms and milestones land in Growth & Engagement; the live-service console runs from here.',
    routes: [
      { label: 'Growth & Engagement', view: 'discipleship-engagement', hash: '#/discipleship-engagement' },
      { label: 'Live Service console', view: 'feed', hash: '#/actions?tab=live' },
    ],
  },
  annex: {
    id: 'annex',
    name: 'Platform Annex (VWS)',
    blurb: 'A borrowed storage room. Steve, Charles, and Marco are VWS platform agents registered in this tenant — not church staff.',
    routes: [
      { label: 'Agent Command Centre', view: 'workos', hash: '#/workos?tab=agents', permission: 'agents.view' },
    ],
  },
  leadership: {
    id: 'leadership',
    name: 'Conference Room',
    blurb: 'Leadership and the work itself: leader roster, AI Clergy deployments, Work Orders, and the Task Board.',
    routes: [
      { label: 'Leadership · AI Clergy', view: 'leadership', hash: '#/leadership' },
      { label: 'Work Orders', view: 'workos', hash: '#/workos?tab=work-orders', permission: 'work_orders.view' },
      { label: 'Task Board', view: 'workos', hash: '#/workos?tab=tasks', permission: 'work_orders.view' },
      { label: 'Ministry settings', view: 'settings', hash: '#/settings', permission: 'admin.manage_settings' },
    ],
  },
  children: {
    id: 'children',
    name: "Children's Ministry",
    blurb: 'Nurseries: child check-in and family records.',
    routes: [
      { label: 'Child Check-In', view: 'child-checkin', hash: '#/child-checkin' },
      { label: 'Families', view: 'people', hash: '#/people?tab=families', permission: 'households.view' },
    ],
  },
  hallway: {
    id: 'hallway',
    name: 'Hallway · Bulletin Board',
    blurb: 'Agent findings and the audit trail are pinned here. The Night Crew — the nightly cron agents — sweep at 07:00 UTC and leave tasks and findings on the board.',
    routes: [
      { label: 'Agent Findings', view: 'workos', hash: '#/workos?tab=agents', permission: 'agents.view' },
      { label: 'Audit timeline', view: 'workos', hash: '#/workos?tab=audit', permission: 'audit.view' },
      { label: 'Automation settings (cron agents)', view: 'settings', hash: '#/settings?tab=automation', permission: 'admin.manage_settings' },
    ],
    nightCrew: ['member-care', 'stewardship', 'operations', 'portal-engagement', 'card-ops', 'crisis-escalation'],
  },
  volunteers: {
    id: 'volunteers',
    name: 'Volunteer Hub',
    blurb: 'Serving roles, volunteer interest submissions, and who is placed where.',
    routes: [
      { label: 'Volunteers', view: 'feed', hash: '#/actions?tab=volunteers', permission: 'volunteer.view' },
      { label: 'Skills & Talents', view: 'people', hash: '#/people?tab=skills' },
      { label: 'Small groups', view: 'people', hash: '#/people?tab=groups', permission: 'groups.view' },
    ],
  },
  data: {
    id: 'data',
    name: 'Data Room',
    blurb: 'Analytics, reports, and impact measurement.',
    routes: [
      { label: 'Analytics', view: 'settings', hash: '#/settings?tab=analytics', permission: 'analytics.view' },
      { label: 'Reports', view: 'settings', hash: '#/settings?tab=reports' },
      { label: 'Executive Overview', view: 'workos', hash: '#/workos' },
    ],
  },
  fellowship: {
    id: 'fellowship',
    name: 'Fellowship Hall',
    blurb: 'The staff meeting: the Monday brief, the Action Center, events, and the WorkOS overview.',
    routes: [
      { label: 'Executive Overview', view: 'workos', hash: '#/workos' },
      { label: 'Action Center', view: 'feed', hash: '#/actions' },
      { label: 'Event registration', view: 'event-registration', hash: '#/event-registration', permission: 'events.view' },
    ],
  },
  records: {
    id: 'records',
    name: 'Front Office · Records',
    blurb: 'Membership records, households, consent and privacy, data quality. The front desk of the church office.',
    routes: [
      { label: 'Congregation', view: 'people', hash: '#/people', permission: 'people.view' },
      { label: 'Families & households', view: 'people', hash: '#/people?tab=families', permission: 'households.view' },
      { label: 'Forms', view: 'settings', hash: '#/settings?tab=forms' },
      { label: 'Tags', view: 'settings', hash: '#/settings?tab=tags' },
    ],
  },
  finance: {
    id: 'finance',
    name: 'Finance & Impact Card',
    blurb: 'Impact Campaigns, the giving ledger and reconciliation, Impact Card accounts, KYC, and transfers.',
    routes: [
      { label: 'Impact Campaigns', view: 'giving', hash: '#/giving', permission: 'giving_financial.view' },
      { label: 'Impact Card Accounts', view: 'wallets', hash: '#/wallets', permission: 'impact_card.view' },
      { label: 'Giving statements', view: 'statements', hash: '#/statements', permission: 'giving_financial.view' },
      { label: 'Charity baskets', view: 'charity-baskets', hash: '#/charity-baskets' },
    ],
  },
  study: {
    id: 'study',
    name: "Pastor's Study · The Desk",
    blurb: 'The envelope on the desk: the Decision Queue, approvals awaiting a decision, and the calendar. Agents flag; the pastor decides.',
    routes: [
      { label: 'Decision Queue (Overview)', view: 'workos', hash: '#/workos' },
      { label: 'Approvals', view: 'workos', hash: '#/workos?tab=approvals', permission: 'approvals.view' },
      { label: 'Calendar', view: 'sunday-prep', hash: '#/sunday-prep?tab=calendar' },
      { label: 'Ask Grace · Monday brief', view: 'dashboard', hash: '#/dashboard' },
    ],
  },
  care: {
    id: 'care',
    name: 'Care Wing',
    blurb: 'Pastoral care. Confidential-tier: the campus shows that requests are waiting — category, priority, and age — never who or what.',
    routes: [
      { label: 'Pastoral Care · Dispatch', view: 'pastoral-care', hash: '#/pastoral-care', permission: 'care.view' },
      { label: 'Care requests', view: 'pastoral-care', hash: '#/pastoral-care?tab=requests', permission: 'care.view' },
      { label: 'Life Services', view: 'pastoral-care', hash: '#/pastoral-care?tab=life-services' },
      { label: 'Prayer', view: 'prayer', hash: '#/prayer' },
    ],
    confidential: true,
  },
};

export function getDepartment(id: string): CampusDepartment | undefined {
  return DEPARTMENTS[id];
}
