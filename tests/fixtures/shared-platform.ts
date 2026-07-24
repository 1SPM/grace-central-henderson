/**
 * Synthetic fixtures for shared-platform tests. No real personal data —
 * every name, email, and ID here is fabricated for this test suite.
 */

export const FIXTURE_CHURCH_ID = '11111111-1111-4111-8111-111111111111';
export const FIXTURE_OTHER_CHURCH_ID = '22222222-2222-4222-8222-222222222222';

export const FIXTURE_STAFF_USER = {
  id: '33333333-3333-4333-8333-333333333333',
  clerk_id: 'user_test_staff_0001',
  church_id: FIXTURE_CHURCH_ID,
  email: 'test.staffmember@example.invalid',
  first_name: 'Taylor',
  last_name: 'Testworthy',
  role: 'staff',
  account_status: 'active' as const,
};

export const FIXTURE_SUSPENDED_USER = {
  id: '44444444-4444-4444-8444-444444444444',
  clerk_id: 'user_test_suspended_0001',
  church_id: FIXTURE_CHURCH_ID,
  email: 'test.suspended@example.invalid',
  first_name: 'Sam',
  last_name: 'Suspended',
  role: 'staff',
  account_status: 'suspended' as const,
};

export const FIXTURE_PERSON = {
  id: '55555555-5555-4555-8555-555555555555',
  church_id: FIXTURE_CHURCH_ID,
  clerk_user_id: 'user_test_member_0001',
  first_name: 'Morgan',
  last_name: 'Memberfield',
  status: 'member' as const,
  portal_enabled: true,
};

export const FIXTURE_PERSON_NO_PORTAL = {
  id: '66666666-6666-4666-8666-666666666666',
  church_id: FIXTURE_CHURCH_ID,
  clerk_user_id: 'user_test_noportal_0001',
  first_name: 'Casey',
  last_name: 'Noaccess',
  status: 'visitor' as const,
  portal_enabled: false,
};

/** A representative slice of the migration 032 seed grants, duplicated
 * here deliberately (not imported from the migration) so a test failure
 * signals "the seed changed — go look" rather than silently tautologically
 * passing against whatever the seed currently says. */
export const FIXTURE_ROLE_PERMISSIONS: Record<string, string[]> = {
  system_administrator: ['*'], // shorthand understood only by test helpers below
  senior_pastor: [
    'people.view', 'people.manage', 'care.view', 'care.manage',
    'work_orders.view', 'work_orders.manage', 'work_orders.approve',
    'approvals.view', 'approvals.decide', 'consent.view',
  ],
  pastoral_care: ['people.view', 'care.view', 'care.manage', 'work_orders.view', 'consent.view'],
  finance: ['giving_financial.view', 'giving_financial.manage', 'giving_financial.export', 'people.view', 'work_orders.view'],
  communications: ['communications.view', 'communications.manage', 'communications.send', 'people.view', 'groups.view', 'events.view', 'work_orders.view'],
  auditor: ['audit.view', 'work_orders.view', 'approvals.view', 'analytics.view', 'consent.view'],
  member_portal_user: ['consent.manage_own', 'portal.self_service'],
};

export function permissionSetFor(roleKey: keyof typeof FIXTURE_ROLE_PERMISSIONS): Set<string> {
  const keys = FIXTURE_ROLE_PERMISSIONS[roleKey];
  return new Set(keys);
}
