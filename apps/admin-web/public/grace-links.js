/** Shared GRACE product URLs — imported by hub pages. See docs/LINKS.md
 *
 * `desktopPortal` / `memberPortal` point at the REAL member portal: the
 * grace-members Vercel project's `/portal` (Clerk auth, then a
 * server-side handoff to the right tenant's static page based on the
 * member's own church_id — see apps/member-web/src/portal/PortalRoot.tsx
 * and api/people/_preview-portal-token.ts's MEMBER_PORTAL_URL, which
 * this mirrors). One URL correctly serves both tenants; do not point
 * this at a `/previews/...` path — those don't exist in this monorepo
 * (TD-073). If a custom domain is ever attached to grace-members,
 * update both entries here and MEMBER_PORTAL_URL together.
 */
window.GRACE_LINKS = {
  demo: {
    hub: 'https://gracecrm-centralhenderson.org/members-card.html',
    crm: 'https://gracecrm-centralhenderson.org/app#/dashboard',
    desktopPortal: 'https://grace-members.vercel.app/portal',
    mobileApp: '/grace_central_henderson_members_card_ios_app.html',
  },
  whitelabel: {
    hub: 'https://grace-crm-two.vercel.app/whitelabel-hub.html',
    crm: 'https://grace-crm-two.vercel.app/#/dashboard',
    memberPortal: 'https://grace-members.vercel.app/portal',
    mobileApp: '/grace_faithful_church_members_card_ios_app.html',
  },
};
