import { describe, it, expect } from 'vitest';
import { checkRelatedParty } from './relatedPartyCheck.js';

describe('checkRelatedParty', () => {
  it('flags when a counterparty word matches a leadership last name', () => {
    const result = checkRelatedParty('God Behind Bars, Inc. — Smith Family Fund', ['Smith', 'Reyes']);
    expect(result.flagged).toBe(true);
    expect(result.matchedName).toBe('smith');
  });

  it('is case-insensitive', () => {
    const result = checkRelatedParty('SMITH Consulting LLC', ['smith']);
    expect(result.flagged).toBe(true);
  });

  it('does not flag an unrelated counterparty', () => {
    const result = checkRelatedParty('Springfield Food Pantry', ['Reyes', 'Diallo']);
    expect(result.flagged).toBe(false);
    expect(result.matchedName).toBeUndefined();
  });

  it('ignores single-letter tokens and initials to reduce false positives', () => {
    const result = checkRelatedParty('J. R. Consulting', ['j', 'r']);
    expect(result.flagged).toBe(false);
  });

  it('never flags when no leadership names are provided', () => {
    const result = checkRelatedParty('Reyes Family Trust', []);
    expect(result.flagged).toBe(false);
  });

  it('handles empty/whitespace-only counterparty names without throwing', () => {
    expect(checkRelatedParty('', ['Reyes']).flagged).toBe(false);
    expect(checkRelatedParty('   ', ['Reyes']).flagged).toBe(false);
  });
});
