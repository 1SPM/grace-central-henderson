import { describe, it, expect } from 'vitest';
import { buildDemoPersonaSeed, type DemoPersonaInput } from './demoPersona.js';

const NOW = new Date('2026-07-18T12:00:00.000Z');

function baseInput(overrides: Partial<DemoPersonaInput> = {}): DemoPersonaInput {
  return {
    churchId: 'church-1',
    personId: 'person-1',
    kycId: 'kyc-1',
    cardId: 'card-1',
    cardAccountId: 'acct-1',
    firstName: 'Test',
    lastName: 'Persona',
    now: NOW,
    ...overrides,
  };
}

describe('buildDemoPersonaSeed — demo tagging', () => {
  it('tags the person row with demo-persona and a notes marker', () => {
    const seed = buildDemoPersonaSeed(baseInput());
    expect(seed.person.tags).toEqual(['demo-persona']);
    expect(seed.person.notes).toContain('[Demo persona]');
  });

  it('sets metadata: { demo: true } on every row type that has a metadata column', () => {
    const seed = buildDemoPersonaSeed(baseInput());
    expect(seed.kyc.metadata).toEqual({ demo: true });
    expect(seed.card.metadata).toEqual({ demo: true });
    expect(seed.cardAccount.metadata).toEqual({ demo: true });
    for (const event of seed.interchangeEvents) {
      expect(event.metadata).toEqual({ demo: true });
    }
  });

  it('links every child row back to the same person_id', () => {
    const seed = buildDemoPersonaSeed(baseInput({ personId: 'p-xyz' }));
    for (const m of seed.discipleshipMilestones) expect(m.person_id).toBe('p-xyz');
    for (const j of seed.journeyItems) expect(j.person_id).toBe('p-xyz');
    for (const g of seed.oneTimeGifts) expect(g.person_id).toBe('p-xyz');
    expect(seed.prayerPost.person_id).toBe('p-xyz');
    expect(seed.recurringGift.person_id).toBe('p-xyz');
    expect(seed.kyc.person_id).toBe('p-xyz');
    expect(seed.cardAccount.person_id).toBe('p-xyz');
  });

  it('cross-references kyc/card/cardAccount by their pre-generated ids', () => {
    const seed = buildDemoPersonaSeed(baseInput({ kycId: 'kyc-abc', cardId: 'card-abc', cardAccountId: 'acct-abc' }));
    expect(seed.kyc.id).toBe('kyc-abc');
    expect(seed.card.id).toBe('card-abc');
    expect(seed.card.kyc_verification_id).toBe('kyc-abc');
    expect(seed.cardAccount.id).toBe('acct-abc');
    for (const event of seed.interchangeEvents) expect(event.card_id).toBe('card-abc');
  });
});

describe('buildDemoPersonaSeed — giving tier qualification math', () => {
  it('sizes the recurring gift to the highest configured weekly tier threshold', () => {
    const seed = buildDemoPersonaSeed(baseInput({
      givingTiers: [
        { label: 'Friend', weeklyThreshold: 10 },
        { label: 'Partner', weeklyThreshold: 40 },
        { label: 'Champion', weeklyThreshold: 100 },
      ],
    }));
    expect(seed.recurringGift.frequency).toBe('weekly');
    expect(seed.recurringGift.amount).toBe(100);
    expect(seed.givingTierNote).toBeNull();
  });

  it('picks the highest tier regardless of input order', () => {
    const seed = buildDemoPersonaSeed(baseInput({
      givingTiers: [
        { label: 'Champion', weeklyThreshold: 100 },
        { label: 'Friend', weeklyThreshold: 10 },
      ],
    }));
    expect(seed.recurringGift.amount).toBe(100);
  });

  it('seeds a default $25/week gift and a "no tiers configured" note when no tiers exist', () => {
    const seed = buildDemoPersonaSeed(baseInput({ givingTiers: undefined }));
    expect(seed.recurringGift.amount).toBe(25);
    expect(seed.givingTierNote).toContain('No giving tiers configured');
  });

  it('seeds the default gift and note when givingTiers is an empty array', () => {
    const seed = buildDemoPersonaSeed(baseInput({ givingTiers: [] }));
    expect(seed.recurringGift.amount).toBe(25);
    expect(seed.givingTierNote).toContain('No giving tiers configured');
  });
});

describe('buildDemoPersonaSeed — skip paths (never fabricate)', () => {
  it('returns groupMembership: null when no active group exists, instead of inventing one', () => {
    const seed = buildDemoPersonaSeed(baseInput({ firstActiveGroupId: null }));
    expect(seed.groupMembership).toBeNull();
  });

  it('builds a real group membership row when a group id is provided', () => {
    const seed = buildDemoPersonaSeed(baseInput({ firstActiveGroupId: 'group-1', personId: 'p-1' }));
    expect(seed.groupMembership).toEqual(expect.objectContaining({ group_id: 'group-1', person_id: 'p-1', status: 'active' }));
  });

  it('returns eventRsvp: null when no upcoming event exists, instead of inventing one', () => {
    const seed = buildDemoPersonaSeed(baseInput({ nextUpcomingEventId: null }));
    expect(seed.eventRsvp).toBeNull();
  });

  it('builds a real RSVP row when an event id is provided', () => {
    const seed = buildDemoPersonaSeed(baseInput({ nextUpcomingEventId: 'evt-1' }));
    expect(seed.eventRsvp).toEqual(expect.objectContaining({ event_id: 'evt-1', status: 'yes', source: 'admin' }));
  });
});

describe('buildDemoPersonaSeed — schema-valid enum values', () => {
  it('uses only valid discipleship milestone_type values, each unique per person', () => {
    const seed = buildDemoPersonaSeed(baseInput());
    const VALID = new Set(['first_visit', 'attended_class', 'baptized', 'joined_group', 'serving', 'leading']);
    const types = seed.discipleshipMilestones.map(m => m.milestone_type as string);
    for (const t of types) expect(VALID.has(t)).toBe(true);
    expect(new Set(types).size).toBe(types.length);
  });

  it('uses a valid kyc status of approved', () => {
    const seed = buildDemoPersonaSeed(baseInput());
    expect(seed.kyc.status).toBe('approved');
  });

  it('uses a valid card status of active', () => {
    const seed = buildDemoPersonaSeed(baseInput());
    expect(seed.card.status).toBe('active');
  });
});
