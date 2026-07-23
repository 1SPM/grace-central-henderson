import { describe, it, expect, afterEach } from 'vitest';
import { hasImpactCardStaffAccess, IMPACT_CARD_STAFF_PERMISSIONS } from './authz.js';

const OPERATE = new Set(['impact_card.operate']);
const MANAGE = new Set(['impact_card.manage']);
const OTHER_GRANTS = new Set(['people.view', 'giving_financial.view']); // has grants, but not card
const NONE = new Set<string>();

afterEach(() => { delete process.env.IMPACT_CARD_STRICT_RBAC; });

describe('hasImpactCardStaffAccess (F2 gate)', () => {
  it('grants on impact_card.operate regardless of coarse role', () => {
    expect(hasImpactCardStaffAccess(OPERATE, false)).toBe(true);
    expect(hasImpactCardStaffAccess(OPERATE, true)).toBe(true);
  });

  it('grants on impact_card.manage', () => {
    expect(hasImpactCardStaffAccess(MANAGE, false)).toBe(true);
  });

  it('DENIES a caller who has other grants but no card permission (monotonic tightening)', () => {
    // This is the security win: a coarse-"staff" receptionist who has been
    // onboarded to RBAC (some grant) but not given card perms loses access.
    expect(hasImpactCardStaffAccess(OTHER_GRANTS, true)).toBe(false);
  });

  it('transition fallback: un-migrated staff (no grants) keep coarse access', () => {
    expect(hasImpactCardStaffAccess(NONE, true)).toBe(true);
  });

  it('denies a non-staff caller with no grants (plain member)', () => {
    expect(hasImpactCardStaffAccess(NONE, false)).toBe(false);
  });

  it('strict mode drops the fallback: no card perm → denied even for coarse staff with no grants', () => {
    process.env.IMPACT_CARD_STRICT_RBAC = 'true';
    expect(hasImpactCardStaffAccess(NONE, true)).toBe(false);
    expect(hasImpactCardStaffAccess(OTHER_GRANTS, true)).toBe(false);
    // explicit card permission still works under strict mode
    expect(hasImpactCardStaffAccess(OPERATE, false)).toBe(true);
  });

  it('permission list is the two expected keys', () => {
    expect([...IMPACT_CARD_STAFF_PERMISSIONS]).toEqual(['impact_card.operate', 'impact_card.manage']);
  });
});
