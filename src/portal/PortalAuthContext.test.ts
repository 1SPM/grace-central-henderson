import { describe, expect, it } from 'vitest';
import { PORTAL_DEMO_HOSTS } from './PortalAuthContext';
import { DEMO_HOSTS, HOST_CHURCH_IDS } from '../../api/_lib/authz';

// Regression test for the members-portal audit finding (Phase 0): this
// client-side list once contained gracecrm-centralhenderson.org — Central
// Henderson's own live domain — on the mistaken belief that it mirrored
// the server's demo-host allowlist. The server actually excludes that
// host from DEMO_HOSTS (that exclusion is what api/_lib/authz.demo.test.ts
// guards), so the client was granting a signed-out visitor the full
// portal shell on a real tenant's domain while every API call behind it
// 401'd. See PortalAuthContext.tsx's PORTAL_DEMO_HOSTS comment.
describe('PORTAL_DEMO_HOSTS — client/server demo-host invariant', () => {
  it('never contains a real tenant host', () => {
    const realTenantHosts = Object.keys(HOST_CHURCH_IDS).filter(
      (host) => !DEMO_HOSTS.has(host),
    );
    expect(realTenantHosts.length).toBeGreaterThan(0); // sanity: the fixture isn't empty
    for (const host of realTenantHosts) {
      expect(PORTAL_DEMO_HOSTS.has(host)).toBe(false);
    }
  });

  it('is a subset of the server-side DEMO_HOSTS allowlist', () => {
    for (const host of PORTAL_DEMO_HOSTS) {
      expect(DEMO_HOSTS.has(host)).toBe(true);
    }
  });

  it('is empty today — no host needs it, since isDemoModeEnabled already covers every real demo host before this check ever runs', () => {
    expect(PORTAL_DEMO_HOSTS.size).toBe(0);
  });
});
