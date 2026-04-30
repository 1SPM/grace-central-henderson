import { describe, it, expect } from 'vitest';
import {
  addBrainEntry,
  buildBrainContext,
  parseBrainDirective,
  serializeBrainEntries,
  deserializeBrainEntries,
} from './grace-brain';

describe('grace brain memory helpers', () => {
  it('parses remember directives without calling an AI provider', () => {
    expect(parseBrainDirective('remember that Maria prefers texts')).toBe('Maria prefers texts');
    expect(parseBrainDirective('Remember Christopher Hall is a first-time giver')).toBe('Christopher Hall is a first-time giver');
    expect(parseBrainDirective('what tasks are due?')).toBeNull();
  });

  it('adds deduped persistent memory entries newest first', () => {
    const existing = addBrainEntry([], 'Maria prefers texts', 10, '2026-04-01T00:00:00.000Z');
    const updated = addBrainEntry(existing, 'Christopher is in young adults', 10, '2026-04-02T00:00:00.000Z');
    const deduped = addBrainEntry(updated, 'maria prefers texts', 10, '2026-04-03T00:00:00.000Z');

    expect(deduped).toHaveLength(2);
    expect(deduped[0].text).toBe('Christopher is in young adults');
    expect(deduped[1].text).toBe('Maria prefers texts');
  });

  it('caps memories to the configured limit', () => {
    const entries = ['one', 'two', 'three'].reduce(
      (acc, text, idx) => addBrainEntry(acc, text, 2, `2026-04-0${idx + 1}T00:00:00.000Z`),
      [] as ReturnType<typeof addBrainEntry>,
    );
    expect(entries.map(e => e.text)).toEqual(['three', 'two']);
  });

  it('builds a compact brain context for prompts', () => {
    const entries = addBrainEntry([], 'Maria prefers texts', 10, '2026-04-01T00:00:00.000Z');
    expect(buildBrainContext(entries)).toContain('Grace memory');
    expect(buildBrainContext(entries)).toContain('- Maria prefers texts');
    expect(buildBrainContext([])).toBe('');
  });

  it('serializes and safely deserializes local brain entries', () => {
    const entries = addBrainEntry([], 'Maria prefers texts', 10, '2026-04-01T00:00:00.000Z');
    expect(deserializeBrainEntries(serializeBrainEntries(entries))).toEqual(entries);
    expect(deserializeBrainEntries('not json')).toEqual([]);
    expect(deserializeBrainEntries(JSON.stringify([{ text: 'missing id' }]))).toEqual([]);
  });
});
