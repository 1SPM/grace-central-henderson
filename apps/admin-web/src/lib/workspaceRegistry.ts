import type { View } from '../types';
import type { SundayTab } from './sundayNav';

/**
 * The single registry of workspace names a person can say or search for.
 *
 * WHY THIS EXISTS
 *
 * There were three lists of "what the workspaces are called": VIEW_TO_PATH
 * (useHashRouter — path spellings), NAV_ITEMS (GlobalSearch — the Cmd+K
 * palette's labels, subtitles and icons), and WORKSPACE_ROUTES (the chat
 * navigation resolver). The third was added last and covered 12 of the
 * palette's 23 destinations, so "Open Sermon Archive" worked in the palette
 * and failed in chat — the exact parity gap the conversational work exists to
 * close, reintroduced by duplicating the list.
 *
 * This module owns view + label + subtitle + aliases. GlobalSearch attaches
 * icons by `id`; the chat resolver matches `aliases`. Adding a workspace in one
 * place now adds it to both doors.
 *
 * Icons deliberately stay in GlobalSearch: they are React nodes, and this
 * module is imported by the chat path, which must not pull in React.
 */
export interface WorkspaceEntry {
  /** Stable key. Icons and tests reference this, never the label text. */
  id: string;
  view: View;
  label: string;
  subtitle: string;
  /**
   * Lower-case spoken forms. The label itself is matched automatically, with
   * `&` normalized to `and`, so only genuine synonyms belong here.
   */
  aliases: string[];
  sundayTab?: SundayTab;
}

export const WORKSPACES: readonly WorkspaceEntry[] = [
  { id: 'home', view: 'dashboard', label: 'Home', subtitle: 'Today, KPIs & next actions', aliases: ['dashboard'] },
  { id: 'leadership', view: 'leadership', label: 'Leadership', subtitle: 'Pastors, clergy & AI companions', aliases: ['ai clergy', 'leadership ai clergy'] },
  { id: 'action-center', view: 'feed', label: 'Action Center', subtitle: 'Tasks, follow-ups, mail & birthdays', aliases: ['actions'] },
  { id: 'congregation', view: 'people', label: 'Congregation', subtitle: 'Directory, groups, skills & families', aliases: ['people', 'directory'] },
  { id: 'sunday-tools', view: 'sunday-prep', label: 'Sunday Service Tools', subtitle: 'Prep, archive, attendance & announcements', aliases: ['sunday tools', 'sunday service', 'sunday prep'] },
  { id: 'sermon-archive', view: 'sunday-prep', label: 'Sermon Archive', subtitle: 'Sunday Service Tools · Past messages', aliases: ['sermons', 'past messages'], sundayTab: 'archive' },
  { id: 'impact-card', view: 'wallets', label: 'Impact Card Accounts', subtitle: 'GRACE Banking card program & member usage', aliases: ['impact card account', 'impact cards', 'wallets'] },
  { id: 'workos', view: 'workos', label: 'GRACE WorkOS', subtitle: 'Work orders, approvals, agents & audit trail', aliases: ['workos', 'work os'] },
  { id: 'campaigns', view: 'giving', label: 'Impact Campaigns', subtitle: 'Giving, pledges & campaigns', aliases: ['impact campaign', 'giving', 'campaigns'] },
  { id: 'pastoral-care', view: 'pastoral-care', label: 'Pastoral Care', subtitle: 'Crisis dispatch, weddings, funerals & legacy planning', aliases: ['care'] },
  { id: 'growth', view: 'discipleship-engagement', label: 'Growth & Engagement', subtitle: 'Pathways, portal signals & spiritual growth', aliases: ['discipleship', 'engagement'] },
  { id: 'analytics', view: 'analytics', label: 'Analytics', subtitle: 'Settings · Trends, health score & growth', aliases: [] },
  { id: 'reports', view: 'reports', label: 'Reports', subtitle: 'Settings · Printable church reports', aliases: [] },
  { id: 'prayer', view: 'prayer', label: 'Prayer', subtitle: 'Prayer requests & answered prayers', aliases: ['prayer requests'] },
  { id: 'tasks', view: 'tasks', label: 'Task List', subtitle: 'Advanced task management', aliases: ['tasks'] },
  { id: 'families', view: 'families', label: 'Families', subtitle: 'Congregation · Households', aliases: ['households'] },
  { id: 'attendance', view: 'attendance', label: 'Attendance', subtitle: 'Sunday Service Tools · Check-in & counts', aliases: ['check-in', 'check in'] },
  { id: 'announcements', view: 'announcements', label: 'Announcements', subtitle: 'Sunday Service Tools · Announcement board', aliases: [] },
  { id: 'grace-mobile', view: 'grace-mobile', label: 'GRACE Mobile', subtitle: 'Mobile CRM for staff · Home, Actions, People, Sunday & Giving', aliases: ['mobile'] },
  { id: 'email-templates', view: 'email-templates', label: 'Email Templates', subtitle: 'Settings · Reusable outreach messages', aliases: ['templates'] },
  { id: 'tags', view: 'tags', label: 'Tags', subtitle: 'Settings · Segments and member labels', aliases: ['segments'] },
  { id: 'settings', view: 'settings', label: 'Settings', subtitle: 'Church profile, tools, integrations & billing', aliases: [] },
];

/** `&` is how the sidebar spells it; `and` is how people say it. */
export function normalizeWorkspaceName(value: string): string {
  return value.trim().toLowerCase().replace(/&/g, 'and').replace(/\s+/g, ' ').trim();
}

/** Exact match on the label or a declared alias. Never fuzzy — a wrong workspace is worse than none. */
export function findWorkspace(requested: string): WorkspaceEntry | undefined {
  const needle = normalizeWorkspaceName(requested);
  return WORKSPACES.find(w =>
    normalizeWorkspaceName(w.label) === needle || w.aliases.some(a => normalizeWorkspaceName(a) === needle));
}
