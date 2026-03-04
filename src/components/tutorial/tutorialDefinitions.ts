import type { View } from '../../types';

export interface TutorialStep {
  view: View;
  target: string; // data-tutorial attribute value
  title: string;
  description: string;
}

export interface TutorialDefinition {
  id: string;
  title: string;
  description: string;
  icon: string; // lucide icon name
  estimatedMinutes: number;
  steps: TutorialStep[];
}

export const TUTORIALS: TutorialDefinition[] = [
  {
    id: 'sunday-game-day',
    title: 'Sunday Game Day',
    description: 'Walk through a typical Sunday morning workflow',
    icon: 'Church',
    estimatedMinutes: 3,
    steps: [
      {
        view: 'dashboard',
        target: 'dashboard-sunday-prep',
        title: 'Sunday Prep',
        description: 'Start your morning here — sermon notes, worship plan, and announcements all in one place.',
      },
      {
        view: 'attendance',
        target: 'attendance-checkin',
        title: 'Check In Attendees',
        description: 'Mark walk-ins, regulars, and first-time visitors as they arrive.',
      },
      {
        view: 'connect-card',
        target: 'connect-card-share',
        title: 'Connect Cards',
        description: 'Share this link or QR code so visitors can fill out their info.',
      },
      {
        view: 'people',
        target: 'add-person-btn',
        title: 'Log New Visitors',
        description: 'After service, add anyone who didn\'t use the connect card.',
      },
      {
        view: 'prayer',
        target: 'prayer-add',
        title: 'Note Prayer Requests',
        description: 'Capture prayer requests from the congregation.',
      },
      {
        view: 'dashboard',
        target: 'dashboard-stats',
        title: 'Check Your Numbers',
        description: 'See today\'s attendance and visitor count at a glance.',
      },
      {
        view: 'dashboard',
        target: 'dashboard-visitors',
        title: 'Review Visitors',
        description: 'Your new visitors appear here — ready for Monday follow-up.',
      },
    ],
  },
  {
    id: 'monday-follow-up',
    title: 'Monday Follow-Up Day',
    description: 'Turn Sunday visitors into connected members',
    icon: 'Users',
    estimatedMinutes: 3,
    steps: [
      {
        view: 'pipeline',
        target: 'pipeline-visitors',
        title: 'Visitor Pipeline',
        description: 'See all your new visitors organized by follow-up stage.',
      },
      {
        view: 'people',
        target: 'people-filter-visitor',
        title: 'Filter Visitors',
        description: 'Quick-filter to see only visitors needing follow-up.',
      },
      {
        view: 'feed',
        target: 'action-feed',
        title: 'Action Center',
        description: 'Your prioritized to-do list — visitors to contact, tasks due today.',
      },
      {
        view: 'tasks',
        target: 'tasks-add',
        title: 'Assign Follow-Up Tasks',
        description: 'Create tasks for yourself or team: "Call Sarah about women\'s group"',
      },
      {
        view: 'people',
        target: 'people-interaction',
        title: 'Log Interactions',
        description: 'Record calls, emails, and visits so nothing falls through the cracks.',
      },
      {
        view: 'dashboard',
        target: 'dashboard-tasks',
        title: 'Track Progress',
        description: 'Your task board shows what\'s done and what\'s pending.',
      },
    ],
  },
  {
    id: 'mid-week-checkin',
    title: 'Mid-Week Check-In',
    description: 'Keep your community connected between Sundays',
    icon: 'Calendar',
    estimatedMinutes: 3,
    steps: [
      {
        view: 'groups',
        target: 'groups-list',
        title: 'Small Groups',
        description: 'See all your groups and their members at a glance.',
      },
      {
        view: 'groups',
        target: 'group-card',
        title: 'Group Health',
        description: 'Check attendance and engagement for each group.',
      },
      {
        view: 'prayer',
        target: 'prayer-list',
        title: 'Prayer Updates',
        description: 'Mark prayers as answered, add new ones from the week.',
      },
      {
        view: 'volunteers',
        target: 'volunteer-schedule',
        title: 'Volunteer Prep',
        description: 'Review and fill volunteer slots for Sunday.',
      },
      {
        view: 'people',
        target: 'people-filter-inactive',
        title: 'Inactive Members',
        description: 'These folks haven\'t been around lately — reach out.',
      },
      {
        view: 'dashboard',
        target: 'dashboard-care-alert',
        title: 'Care Alert',
        description: 'The dashboard flags members needing attention automatically.',
      },
    ],
  },
  {
    id: 'thursday-friday-prep',
    title: 'Thursday/Friday Prep',
    description: 'Get everything ready for Sunday',
    icon: 'BookOpen',
    estimatedMinutes: 2,
    steps: [
      {
        view: 'sunday-prep',
        target: 'sunday-prep-main',
        title: 'Sunday Prep',
        description: 'Sermon notes, worship plan, and announcements all in one place.',
      },
      {
        view: 'calendar',
        target: 'calendar-new-event',
        title: 'Plan Events',
        description: 'Create upcoming events — potlucks, baptisms, special services.',
      },
      {
        view: 'calendar',
        target: 'calendar-grid',
        title: 'Your Calendar',
        description: 'See everything at a glance — events, birthdays, anniversaries.',
      },
      {
        view: 'giving',
        target: 'giving-stats',
        title: 'Giving Overview',
        description: 'Quick check on this week\'s giving before Sunday.',
      },
      {
        view: 'settings',
        target: 'settings-email',
        title: 'Send Reminders',
        description: 'Set up automated email reminders for Sunday events.',
      },
    ],
  },
  {
    id: 'monthly-review',
    title: 'Monthly Review',
    description: 'Big-picture health check for your church',
    icon: 'BarChart',
    estimatedMinutes: 2,
    steps: [
      {
        view: 'analytics',
        target: 'analytics-overview',
        title: 'Analytics',
        description: 'Growth trends, attendance patterns, and engagement metrics.',
      },
      {
        view: 'statements',
        target: 'giving-statements',
        title: 'Giving Statements',
        description: 'Generate and send giving statements to members.',
      },
      {
        view: 'people',
        target: 'people-directory',
        title: 'Member Directory',
        description: 'Keep your directory up to date — review and clean up.',
      },
      {
        view: 'life-services',
        target: 'life-services-list',
        title: 'Life Services',
        description: 'Weddings, funerals, and estate planning conversations.',
      },
      {
        view: 'reports',
        target: 'reports-export',
        title: 'Run Reports',
        description: 'Export printable reports for board meetings and records.',
      },
    ],
  },
];

export function getTutorialById(id: string): TutorialDefinition | undefined {
  return TUTORIALS.find(t => t.id === id);
}
