import { describe, it, expect, afterEach } from 'vitest';
import { parseWorkOsTab, parseWorkOsId, workosHash } from './workosNav';

function setHash(hash: string) {
  window.history.replaceState(null, '', hash);
}

describe('workosNav (route test)', () => {
  afterEach(() => setHash('#/'));

  it('defaults to the agents tab when no tab is in the hash', () => {
    setHash('#/workos');
    expect(parseWorkOsTab()).toBe('agents');
  });

  it('parses a valid tab from the hash', () => {
    setHash('#/workos?tab=approvals');
    expect(parseWorkOsTab()).toBe('approvals');
  });

  it('falls back to agents for an unrecognized tab value (no crash, no silent wrong tab)', () => {
    setHash('#/workos?tab=not-a-real-tab');
    expect(parseWorkOsTab()).toBe('agents');
  });

  it('parses a Work Order id from the hash', () => {
    setHash('#/workos?tab=work-orders&id=abc-123');
    expect(parseWorkOsId()).toBe('abc-123');
  });

  it('returns null when no id is present', () => {
    setHash('#/workos?tab=work-orders');
    expect(parseWorkOsId()).toBeNull();
  });

  it('workosHash round-trips tab and id', () => {
    const hash = workosHash('work-orders', 'wo-9');
    expect(hash).toBe('#/workos?tab=work-orders&id=wo-9');
    setHash(hash);
    expect(parseWorkOsTab()).toBe('work-orders');
    expect(parseWorkOsId()).toBe('wo-9');
  });

  it('workosHash omits the tab param for the default agents tab', () => {
    expect(workosHash('agents')).toBe('#/workos');
  });
});

describe('workosNav campus tab', () => {
  afterEach(() => setHash('#/'));
  it('parses the campus tab and round-trips through workosHash', () => {
    setHash('#/workos?tab=campus');
    expect(parseWorkOsTab()).toBe('campus');
    expect(workosHash('campus')).toBe('#/workos?tab=campus');
  });
});
