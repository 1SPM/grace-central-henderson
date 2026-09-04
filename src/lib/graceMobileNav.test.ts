import { describe, it, expect, afterEach } from 'vitest';
import { parseMobileTab, graceMobileUrl, BAR_TABS, STACK_SCREENS, MOBILE_TAB_TO_VIEW } from './graceMobileNav';

function setUrl(path: string) {
  window.history.replaceState(null, '', path);
}

describe('graceMobileNav', () => {
  afterEach(() => setUrl('/'));

  it('defaults to home with no tab param', () => {
    setUrl('/mobile');
    expect(parseMobileTab()).toBe('home');
  });

  it('parses a bar tab from the query string', () => {
    setUrl('/mobile?tab=work');
    expect(parseMobileTab()).toBe('work');
  });

  it('parses a stack screen (brief) from the query string — old links keep working', () => {
    setUrl('/mobile?tab=brief');
    expect(parseMobileTab()).toBe('brief');
  });

  it('parses the grace screen', () => {
    setUrl('/mobile?tab=grace');
    expect(parseMobileTab()).toBe('grace');
  });

  it('parses a tab from a hash-style URL (#mobile?tab=people)', () => {
    setUrl('/#mobile?tab=people');
    expect(parseMobileTab()).toBe('people');
  });

  it('falls back to home for an unknown tab value', () => {
    setUrl('/mobile?tab=nonsense');
    expect(parseMobileTab()).toBe('home');
  });

  it('builds shareable URLs, omitting the param for home', () => {
    setUrl('/mobile');
    expect(graceMobileUrl()).toMatch(/\/mobile$/);
    expect(graceMobileUrl('home')).toMatch(/\/mobile$/);
    expect(graceMobileUrl('sunday')).toMatch(/\/mobile\?tab=sunday$/);
    expect(graceMobileUrl('grace')).toMatch(/\/mobile\?tab=grace$/);
  });

  it('keeps the nav model consistent: bar tabs and stack screens cover every mapped view', () => {
    expect(BAR_TABS).toEqual(['home', 'people', 'sunday', 'work']);
    expect(STACK_SCREENS.has('brief')).toBe(true);
    expect(STACK_SCREENS.has('grace')).toBe(true);
    // Every non-home screen maps to a real admin view.
    for (const tab of [...BAR_TABS.filter((t) => t !== 'home'), 'brief', 'grace'] as const) {
      expect(MOBILE_TAB_TO_VIEW[tab]).toBeTruthy();
    }
  });
});
