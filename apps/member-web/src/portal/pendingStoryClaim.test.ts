/**
 * The pending-claim handle is user-writable storage that decides which story
 * gets attached to a brand-new account, so every read re-validates it.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { savePendingStoryClaim, readPendingStoryClaim, clearPendingStoryClaim } from './pendingStoryClaim';

const KEY = 'grace.portal.pending-story-claim';
const DRAFT = '11111111-2222-3333-4444-555555555555';
const NONCE = 'n'.repeat(43);

beforeEach(() => { window.sessionStorage.clear(); });

describe('pendingStoryClaim', () => {
  it('round-trips a valid claim', () => {
    savePendingStoryClaim({ draftId: DRAFT, attachNonce: NONCE, preferredName: 'Maya' });
    expect(readPendingStoryClaim()).toMatchObject({ draftId: DRAFT, attachNonce: NONCE, preferredName: 'Maya' });
  });

  it('rejects a tampered draft id', () => {
    window.sessionStorage.setItem(KEY, JSON.stringify({ draftId: '../../etc', attachNonce: NONCE }));
    expect(readPendingStoryClaim()).toBeNull();
  });

  it('rejects a malformed nonce', () => {
    window.sessionStorage.setItem(KEY, JSON.stringify({ draftId: DRAFT, attachNonce: 'short' }));
    expect(readPendingStoryClaim()).toBeNull();
  });

  it('rejects an expired handle without a network round trip', () => {
    savePendingStoryClaim({
      draftId: DRAFT, attachNonce: NONCE,
      attachExpiresAt: new Date(Date.now() - 1000).toISOString(),
    });
    expect(readPendingStoryClaim()).toBeNull();
  });

  it('survives garbage in storage', () => {
    window.sessionStorage.setItem(KEY, 'not json');
    expect(readPendingStoryClaim()).toBeNull();
  });

  it('clears on request, because the nonce is single-use', () => {
    savePendingStoryClaim({ draftId: DRAFT, attachNonce: NONCE });
    clearPendingStoryClaim();
    expect(readPendingStoryClaim()).toBeNull();
  });
});
