export type PortalTab = 'home' | 'church' | 'journey' | 'community' | 'care' | 'giving' | 'assistant' | 'profile';

const VALID_TABS: PortalTab[] = ['home', 'church', 'journey', 'community', 'care', 'giving', 'assistant', 'profile'];

export function parsePortalTab(): PortalTab {
  const hash = typeof window !== 'undefined' ? window.location.hash : '';
  const match = hash.match(/^#\/portal\/([a-z]+)/);
  const tab = match?.[1];
  return (VALID_TABS as string[]).includes(tab ?? '') ? (tab as PortalTab) : 'home';
}

export function portalHash(tab: PortalTab): string {
  return `#/portal/${tab}`;
}

export function navigatePortalTab(tab: PortalTab): void {
  window.history.pushState(null, '', portalHash(tab));
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}
