/**
 * Unit test for the Impact Card Pilot Readiness demonstration task list
 * (Work Order test — the "required Work Order demonstration").
 */
import { describe, it, expect } from 'vitest';
import { PILOT_TASKS } from './_pilot-readiness.js';

const REQUIRED_TOPICS = [
  'document inventory',
  'product readiness',
  'financial assumptions',
  'member onboarding',
  'communication planning',
  'privacy review',
  'risk review',
  'kpi definition',
  'launch checklist',
  'independent validation',
];

describe('PILOT_TASKS — Impact Card Pilot Readiness demonstration', () => {
  it('has exactly the ten required task topics from the WorkOS spec', () => {
    expect(PILOT_TASKS).toHaveLength(10);
    const titles = PILOT_TASKS.map(t => t.title.toLowerCase());
    for (const topic of REQUIRED_TOPICS) {
      expect(titles).toContain(topic);
    }
  });

  it('every task has a non-empty description', () => {
    for (const task of PILOT_TASKS) {
      expect(task.description.length).toBeGreaterThan(10);
    }
  });

  it('does not claim a live financial-provider connection in any task description', () => {
    for (const task of PILOT_TASKS) {
      const text = task.description.toLowerCase();
      expect(text).not.toContain('connected to stripe');
      expect(text).not.toContain('connected to i2c');
      expect(text.includes('does not') || !text.includes('financial provider')).toBe(true);
    }
  });

  it('the final task is independent validation, distinct from the task owner\'s own work', () => {
    const last = PILOT_TASKS[PILOT_TASKS.length - 1];
    expect(last.title.toLowerCase()).toBe('independent validation');
    expect(last.description.toLowerCase()).toMatch(/independent reviewer/);
  });
});
