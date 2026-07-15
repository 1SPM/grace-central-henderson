import { describe, it, expect, afterEach } from 'vitest';
import { parsePortalTab, portalHash } from './portalNav';

function setHash(hash: string) {
  window.history.replaceState(null, '', hash);
}

describe('portalNav (route test)', () => {
  afterEach(() => setHash('#/'));

  it('defaults to the home tab when no hash is present', () => {
    setHash('#/');
    expect(parsePortalTab()).toBe('home');
  });

  it('parses a valid tab from the hash', () => {
    setHash('#/portal/journey');
    expect(parsePortalTab()).toBe('journey');
  });

  it('falls back to home for an unrecognized tab (no crash, no silent wrong tab)', () => {
    setHash('#/portal/not-a-real-tab');
    expect(parsePortalTab()).toBe('home');
  });

  it('portalHash produces a addressable, shareable URL per tab', () => {
    expect(portalHash('community')).toBe('#/portal/community');
    setHash(portalHash('community'));
    expect(parsePortalTab()).toBe('community');
  });
});
