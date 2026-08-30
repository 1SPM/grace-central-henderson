import { describe, it, expect } from 'vitest';
import { attentionRank, moreUrgent, attentionBadgeVariant, type AttentionState } from './attentionPolicy';

describe('attentionRank', () => {
  it('ranks urgent as most attention-worthy and informational as least', () => {
    expect(attentionRank('urgent')).toBeLessThan(attentionRank('blocked'));
    expect(attentionRank('blocked')).toBeLessThan(attentionRank('needs_review'));
    expect(attentionRank('needs_review')).toBeLessThan(attentionRank('informational'));
  });
});

describe('moreUrgent', () => {
  it('returns the more attention-worthy of two states, either order', () => {
    expect(moreUrgent('informational', 'urgent')).toBe('urgent');
    expect(moreUrgent('urgent', 'informational')).toBe('urgent');
    expect(moreUrgent('blocked', 'needs_review')).toBe('blocked');
  });

  it('is stable when both states are equal', () => {
    expect(moreUrgent('needs_review', 'needs_review')).toBe('needs_review');
  });
});

describe('attentionBadgeVariant', () => {
  it('maps every attention state to a StatusBadge variant, urgent reserved for urgent', () => {
    const cases: [AttentionState, string][] = [
      ['urgent', 'urgent'],
      ['blocked', 'warning'],
      ['needs_review', 'normal'],
      ['informational', 'low'],
    ];
    for (const [attention, variant] of cases) {
      expect(attentionBadgeVariant(attention)).toBe(variant);
    }
  });
});
