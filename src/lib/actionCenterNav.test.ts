import { describe, it, expect, afterEach } from 'vitest';
import { parseActionCenterTab, actionCenterHash } from './actionCenterNav';

function setHash(hash: string) {
  window.history.replaceState(null, '', hash);
}

describe('actionCenterNav — My Work reads first', () => {
  afterEach(() => setHash('#/'));

  it('defaults to the mywork tab when no tab is in the hash', () => {
    setHash('#/actions');
    expect(parseActionCenterTab()).toBe('mywork');
  });

  it('parses an explicit followups tab from the hash', () => {
    setHash('#/actions?tab=followups');
    expect(parseActionCenterTab()).toBe('followups');
  });

  it('falls back to mywork for an unrecognized tab value', () => {
    setHash('#/actions?tab=not-a-real-tab');
    expect(parseActionCenterTab()).toBe('mywork');
  });

  it('actionCenterHash omits the tab param for the default mywork tab', () => {
    expect(actionCenterHash('mywork')).toBe('#/actions');
    expect(actionCenterHash()).toBe('#/actions');
  });

  it('actionCenterHash includes an explicit param for every other tab', () => {
    expect(actionCenterHash('followups')).toBe('#/actions?tab=followups');
    expect(actionCenterHash('mail')).toBe('#/actions?tab=mail');
  });
});
