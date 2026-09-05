import { describe, it, expect, beforeEach } from 'vitest';
import { loadStoredMessages, persistMessages, pickReturnGreeting, messagesStorageKey } from './persistence';
import type { GraceMessage } from './types';

describe('re-greetings are spoken, not transcribed', () => {
  beforeEach(() => localStorage.clear());

  it('pickReturnGreeting still yields something short to say', () => {
    const ack = pickReturnGreeting();
    expect(ack.role).toBe('assistant');
    expect(ack.source).toBe('regreet');
    expect(ack.content.length).toBeLessThan(60);
  });

  it('drops re-greeting bubbles a previous build stored in the transcript', () => {
    const real: GraceMessage = { id: 'a1', role: 'assistant', content: 'Which Sarah — Mitchell or Chen?' };
    persistMessages([{ id: 'u1', role: 'user', content: 'Delete Sarah' }, real, pickReturnGreeting()], 'user-1');
    const loaded = loadStoredMessages('user-1');
    expect(loaded?.map(m => m.id)).toEqual(['u1', 'a1']);
    expect(localStorage.getItem(messagesStorageKey('user-1'))).toContain('regreet'); // raw store untouched until next persist
  });

  it('returns null when only re-greetings were stored', () => {
    persistMessages([pickReturnGreeting()], 'user-1');
    expect(loadStoredMessages('user-1')).toBeNull();
  });
});
