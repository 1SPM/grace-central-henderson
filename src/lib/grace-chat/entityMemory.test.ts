import { describe, expect, it } from 'vitest';
import { requestedEntityMemoryName } from './entityMemory';

describe('requestedEntityMemoryName', () => {
  it('recognizes the original phrasing', () => {
    expect(requestedEntityMemoryName('What do you remember about Martha Reyes?')).toBe('Martha Reyes');
  });

  it('recognizes the phrasing the parity brief itself uses (E-7)', () => {
    expect(requestedEntityMemoryName('Brief me on Pastor James Wilson')).toBe('James Wilson');
  });

  it('covers the other natural ways staff ask for a person', () => {
    expect(requestedEntityMemoryName('What do you know about Martha Reyes')).toBe('Martha Reyes');
    expect(requestedEntityMemoryName('Tell me about Martha Reyes')).toBe('Martha Reyes');
    expect(requestedEntityMemoryName('Catch me up on Martha Reyes')).toBe('Martha Reyes');
    expect(requestedEntityMemoryName('Who is Martha Reyes?')).toBe('Martha Reyes');
    expect(requestedEntityMemoryName('Give me the background on Martha Reyes')).toBe('Martha Reyes');
  });

  it('strips honorifics, including stacked ones, so they resolve the same record', () => {
    expect(requestedEntityMemoryName('Brief me on Dr. James Wilson')).toBe('James Wilson');
    expect(requestedEntityMemoryName('Who is Deacon Martha Reyes')).toBe('Martha Reyes');
    expect(requestedEntityMemoryName('Brief me on Pastor Dr. James Wilson')).toBe('James Wilson');
  });

  it('still ignores phrasings that are not a request for a record', () => {
    expect(requestedEntityMemoryName('Remember Martha Reyes')).toBeNull();
    expect(requestedEntityMemoryName('Add a task for Martha Reyes')).toBeNull();
    expect(requestedEntityMemoryName('Who is coming to the potluck')).toBe('coming to the potluck');
  });

  it('rejects a capture with no letters in it', () => {
    expect(requestedEntityMemoryName('Who is 2026')).toBeNull();
    expect(requestedEntityMemoryName('Tell me about 42')).toBeNull();
  });

  it('rejects an absurdly long capture', () => {
    expect(requestedEntityMemoryName(`Tell me about ${'a'.repeat(200)}`)).toBeNull();
  });
});
