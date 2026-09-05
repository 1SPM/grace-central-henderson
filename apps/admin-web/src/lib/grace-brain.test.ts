import { describe, it, expect } from 'vitest';
import { deserializeBrainEntries } from './grace-brain';

describe('grace-brain — legacy localStorage read path (ADR-014 migration)', () => {
  it('deserializes well-formed entries', () => {
    const raw = JSON.stringify([{ id: '2026-04-01-maria', text: 'Maria prefers texts', createdAt: '2026-04-01T00:00:00.000Z' }]);
    expect(deserializeBrainEntries(raw)).toEqual([
      { id: '2026-04-01-maria', text: 'Maria prefers texts', createdAt: '2026-04-01T00:00:00.000Z' },
    ]);
  });

  it('returns an empty array for missing, malformed, or non-array data', () => {
    expect(deserializeBrainEntries(null)).toEqual([]);
    expect(deserializeBrainEntries(undefined)).toEqual([]);
    expect(deserializeBrainEntries('not json')).toEqual([]);
    expect(deserializeBrainEntries(JSON.stringify({ not: 'an array' }))).toEqual([]);
    expect(deserializeBrainEntries(JSON.stringify([{ text: 'missing id and createdAt' }]))).toEqual([]);
  });
});
