/**
 * The origin-tenant hint must survive Clerk's redirect and must never be
 * trusted blindly — sessionStorage is user-writable, and the value decides
 * which church a sign-up is attributed to on the server.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { captureOriginTenant, readOriginTenant, clearOriginTenant } from './originTenant';

beforeEach(() => { window.sessionStorage.clear(); });

describe('captureOriginTenant', () => {
  it('captures a known tenant slug', () => {
    captureOriginTenant('?tenant=faithful');
    expect(readOriginTenant()).toBe('faithful');
  });

  it('ignores an unknown slug rather than storing it', () => {
    captureOriginTenant('?tenant=not-a-tenant');
    expect(readOriginTenant()).toBeNull();
  });

  it('keeps a previously captured value when Clerk returns without the param', () => {
    captureOriginTenant('?tenant=faithful');
    captureOriginTenant('');            // the post-Clerk URL
    expect(readOriginTenant()).toBe('faithful');
  });

  it('re-validates on read, so a tampered storage value is ignored', () => {
    window.sessionStorage.setItem('grace.portal.origin-tenant', 'central-henderson; DROP');
    expect(readOriginTenant()).toBeNull();
  });

  it('clears on request', () => {
    captureOriginTenant('?tenant=central-henderson');
    clearOriginTenant();
    expect(readOriginTenant()).toBeNull();
  });
});
