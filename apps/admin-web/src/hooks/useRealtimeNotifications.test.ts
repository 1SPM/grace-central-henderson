import { describe, it, expect } from 'vitest';
import { attentionForNotification } from './useRealtimeNotifications';

describe('attentionForNotification', () => {
  it('classifies crisis as urgent', () => {
    expect(attentionForNotification('crisis')).toBe('urgent');
  });

  it('classifies inbox, portal, and agent as informational — routine observations, not decisions awaiting a human', () => {
    expect(attentionForNotification('inbox')).toBe('informational');
    expect(attentionForNotification('portal')).toBe('informational');
    expect(attentionForNotification('agent')).toBe('informational');
  });
});
