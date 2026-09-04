import { describe, expect, it } from 'vitest';
import { requestedEntityMemoryName } from './entityMemory';

describe('requestedEntityMemoryName', () => {
  it('only recognizes an explicit request for a named record', () => {
    expect(requestedEntityMemoryName('What do you remember about Martha Reyes?')).toBe('Martha Reyes');
    expect(requestedEntityMemoryName('Remember Martha Reyes')).toBeNull();
  });
});
