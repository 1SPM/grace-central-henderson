/**
 * Unit tests for the named Work Order template catalog required by the
 * giving/Impact Card phase brief, and its integration with the approval
 * policy overlay (workOrderPolicy.ts).
 */
import { describe, it, expect } from 'vitest';
import { WORK_ORDER_TEMPLATES, getWorkOrderTemplate } from './workOrderTemplates.js';
import { requiresApprovalBeforeExecution } from './workOrderPolicy.js';

const EXPECTED_KEYS = [
  'onboarding_campaign',
  'support_escalation',
  'reconciliation_exception',
  'impact_card_communications',
  'monthly_leadership_reporting',
];

describe('WORK_ORDER_TEMPLATES', () => {
  it('has exactly the five templated named Work Order types', () => {
    expect(Object.keys(WORK_ORDER_TEMPLATES).sort()).toEqual(EXPECTED_KEYS.sort());
  });

  it('every template has a non-empty title, description, and at least one task', () => {
    for (const template of Object.values(WORK_ORDER_TEMPLATES)) {
      expect(template.title.length).toBeGreaterThan(0);
      expect(template.description.length).toBeGreaterThan(0);
      expect(template.tasks.length).toBeGreaterThan(0);
      for (const task of template.tasks) {
        expect(task.title.length).toBeGreaterThan(0);
        expect(task.description.length).toBeGreaterThan(0);
      }
    }
  });

  it('does not claim live financial-provider connection in any template or task description', () => {
    const bannedPhrases = ['connected to stripe', 'connected to i2c', 'live connection to'];
    for (const template of Object.values(WORK_ORDER_TEMPLATES)) {
      const texts = [template.description, ...template.tasks.map(t => t.description)];
      for (const text of texts) {
        const lower = text.toLowerCase();
        for (const phrase of bannedPhrases) {
          expect(lower).not.toContain(phrase);
        }
      }
    }
  });

  it('flags the Impact Card communications template as requiring approval, consistent with workOrderPolicy', () => {
    const template = WORK_ORDER_TEMPLATES.impact_card_communications;
    expect(requiresApprovalBeforeExecution({ ministry: template.ministry, metadata: template.metadata })).toBe(true);
  });

  it('does not flag the other four templates as requiring approval', () => {
    for (const key of EXPECTED_KEYS.filter(k => k !== 'impact_card_communications')) {
      const template = WORK_ORDER_TEMPLATES[key as keyof typeof WORK_ORDER_TEMPLATES];
      expect(requiresApprovalBeforeExecution({ ministry: template.ministry, metadata: template.metadata })).toBe(false);
    }
  });
});

describe('getWorkOrderTemplate', () => {
  it('returns the matching template for a known key', () => {
    expect(getWorkOrderTemplate('support_escalation')?.title).toBe('Impact Card Support Escalation');
  });

  it('returns null for an unknown key', () => {
    expect(getWorkOrderTemplate('not_a_real_template')).toBeNull();
  });
});
