import { describe, it, expect } from 'vitest';
import { shouldSkipFinding, type ExistingFindingForDedup } from './agentFindingsDedup.js';

const NOW = new Date('2026-07-18T00:00:00.000Z');

describe('shouldSkipFinding', () => {
  it('allows a fresh finding when no existing rows match the dedup key', () => {
    expect(shouldSkipFinding([], NOW)).toBe(false);
  });

  it('blocks when an existing row is open', () => {
    const existing: ExistingFindingForDedup[] = [
      { status: 'open', suppress_until: null, created_at: '2026-07-17T00:00:00.000Z' },
    ];
    expect(shouldSkipFinding(existing, NOW)).toBe(true);
  });

  it('blocks when an existing row is triaged', () => {
    const existing: ExistingFindingForDedup[] = [
      { status: 'triaged', suppress_until: null, created_at: '2026-07-17T00:00:00.000Z' },
    ];
    expect(shouldSkipFinding(existing, NOW)).toBe(true);
  });

  it('blocks when an existing row is actioned', () => {
    const existing: ExistingFindingForDedup[] = [
      { status: 'actioned', suppress_until: null, created_at: '2026-07-17T00:00:00.000Z' },
    ];
    expect(shouldSkipFinding(existing, NOW)).toBe(true);
  });

  it('allows when the only existing row is resolved', () => {
    const existing: ExistingFindingForDedup[] = [
      { status: 'resolved', suppress_until: null, created_at: '2026-07-17T00:00:00.000Z' },
    ];
    expect(shouldSkipFinding(existing, NOW)).toBe(false);
  });

  it('blocks when the most recent dismissed row has an active suppression window', () => {
    const existing: ExistingFindingForDedup[] = [
      { status: 'dismissed', suppress_until: '2026-07-20T00:00:00.000Z', created_at: '2026-07-17T00:00:00.000Z' },
    ];
    expect(shouldSkipFinding(existing, NOW)).toBe(true);
  });

  it('allows when the most recent dismissed row has an expired suppression window', () => {
    const existing: ExistingFindingForDedup[] = [
      { status: 'dismissed', suppress_until: '2026-07-10T00:00:00.000Z', created_at: '2026-07-09T00:00:00.000Z' },
    ];
    expect(shouldSkipFinding(existing, NOW)).toBe(false);
  });

  it('allows when the most recent dismissed row has no suppression window at all', () => {
    const existing: ExistingFindingForDedup[] = [
      { status: 'dismissed', suppress_until: null, created_at: '2026-07-17T00:00:00.000Z' },
    ];
    expect(shouldSkipFinding(existing, NOW)).toBe(false);
  });

  it('uses only the most recent dismissed row, not an older active suppression', () => {
    const existing: ExistingFindingForDedup[] = [
      // Older dismissal still technically has a future suppress_until in
      // absolute terms, but a newer dismissal superseded it — only the
      // newest row's suppression should matter.
      { status: 'dismissed', suppress_until: '2026-08-01T00:00:00.000Z', created_at: '2026-07-01T00:00:00.000Z' },
      { status: 'dismissed', suppress_until: '2026-07-10T00:00:00.000Z', created_at: '2026-07-15T00:00:00.000Z' },
    ];
    expect(shouldSkipFinding(existing, NOW)).toBe(false);
  });

  it('blocks on an active status even if an older dismissed+suppressed row also exists', () => {
    const existing: ExistingFindingForDedup[] = [
      { status: 'dismissed', suppress_until: '2026-08-01T00:00:00.000Z', created_at: '2026-07-01T00:00:00.000Z' },
      { status: 'open', suppress_until: null, created_at: '2026-07-17T00:00:00.000Z' },
    ];
    expect(shouldSkipFinding(existing, NOW)).toBe(true);
  });
});
