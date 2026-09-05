import { describe, expect, it } from 'vitest';
import { resolveWorkspaceNavigation } from './navigation';

describe('resolveWorkspaceNavigation', () => {
  it('routes an explicit Impact Card Accounts command to the visible workspace', () => {
    expect(resolveWorkspaceNavigation('Open Impact Card Accounts')).toEqual({ view: 'wallets', label: 'Impact Card Accounts' });
  });

  it('supports the other visible workspace names without treating ordinary questions as navigation', () => {
    expect(resolveWorkspaceNavigation('Take me to GRACE WorkOS')).toMatchObject({ view: 'workos' });
    expect(resolveWorkspaceNavigation('Show Growth & Engagement')).toMatchObject({ view: 'discipleship-engagement' });
    expect(resolveWorkspaceNavigation('What is Impact Card Accounts?')).toBeNull();
  });
});
