import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TUTORIALS,
  PASTOR_CRM_TOUR_ID,
  getTutorialById,
} from './tutorialDefinitions';

const VALID_VIEWS = new Set([
  'home', 'dashboard', 'feed', 'people', 'person', 'tasks', 'calendar', 'groups', 'prayer',
  'giving', 'settings', 'pipeline', 'attendance', 'volunteers', 'tags', 'reports', 'birthdays',
  'online-giving', 'batch-entry', 'pledges', 'campaigns', 'statements', 'charity-baskets',
  'donation-tracker', 'member-stats', 'agents', 'connect-card', 'directory', 'child-checkin',
  'forms', 'grace-mobile', 'sunday-prep', 'live-service', 'families', 'skills', 'email-templates',
  'event-registration', 'reminders', 'planning-center-import', 'qr-checkin', 'follow-up-automation',
  'pastoral-care', 'life-services', 'wedding-services', 'funeral-services', 'estate-planning',
  'leader-management', 'analytics', 'announcements', 'discipleship-engagement', 'leadership',
  'grace', 'mail', 'financial-hub', 'wallets',
]);

const ANCHOR_SOURCES = [
  'src/components/dashboard/DashboardCommandBar.tsx',
  'src/components/Layout.tsx',
  'src/components/ActionFeed.tsx',
  'src/components/PeopleList.tsx',
  'src/components/leadership/LeadershipPage.tsx',
  'src/components/care/CareHub.tsx',
  'src/components/SundayPrep.tsx',
  'src/components/GivingDashboard.tsx',
  'src/components/Settings.tsx',
];

describe('tutorialDefinitions', () => {
  it('defines the pastor CRM overview tour first', () => {
    expect(TUTORIALS[0]?.id).toBe(PASTOR_CRM_TOUR_ID);
    expect(getTutorialById(PASTOR_CRM_TOUR_ID)).toBeDefined();
  });

  it('uses valid View types for every step', () => {
    for (const tutorial of TUTORIALS) {
      for (const step of tutorial.steps) {
        expect(VALID_VIEWS.has(step.view), `${tutorial.id} step "${step.title}"`).toBe(true);
      }
    }
  });

  it('registers pastor tour anchor targets in UI source', () => {
    const pastorTour = getTutorialById(PASTOR_CRM_TOUR_ID);
    expect(pastorTour).toBeDefined();
    const combined = ANCHOR_SOURCES.map(f =>
      readFileSync(join(process.cwd(), f), 'utf8'),
    ).join('\n');

    for (const step of pastorTour!.steps) {
      expect(
        combined.includes(`data-tutorial="${step.target}"`),
        `missing anchor ${step.target}`,
      ).toBe(true);
    }
  });
});
