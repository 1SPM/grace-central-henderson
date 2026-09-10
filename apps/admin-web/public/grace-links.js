/** Shared GRACE product URLs — imported by hub pages. See docs/LINKS.md
 *
 * `desktopPortal` (Central Henderson) points at the REAL member portal:
 * the grace-members Vercel project's `/portal` (Clerk auth, then a
 * server-side handoff to the right tenant's static page based on the
 * member's own church_id — see apps/member-web/src/portal/PortalRoot.tsx
 * and api/people/_preview-portal-token.ts's MEMBER_PORTAL_URL, which this
 * mirrors). Do not point this at a `/previews/...` path — those don't
 * exist in this monorepo (TD-073).
 *
 * `memberPortal` (Faithful/whitelabel) deliberately points at the static
 * tenant page directly (`/tenants/faithful/member-portal.html`), NOT the
 * auth-gated `/portal` entry — Faithful is a sales/demo tenant with no
 * real Clerk membership base, so the direct link lets anyone browse it
 * without an account. Owner decision, 2026-09-08.
 *
 * `mobileApp` (both tenants) points at the iOS design-preview page,
 * which lives ONLY on the grace-members project, at
 * /tenants/<tenant>/grace_<tenant>_..._ios_app.html — same relative
 * folder depth as that tenant's member-portal.html, so its ../../shared
 * and ../../assets paths resolve against files already there. This file
 * is admin-web's own domain, so these must be full absolute URLs, not
 * same-origin paths. Source of truth for the page content is
 * marketing/tenants/<tenant>/members-card.html (renamed from this exact
 * filename during the Phase 1 monorepo split, commit 6b4a6dc) — copy
 * from there again if the page is ever redesigned.
 *
 * If a custom domain is ever attached to grace-members, update
 * desktopPortal/mobileApp here and MEMBER_PORTAL_URL together.
 */
window.GRACE_LINKS = {
  demo: {
    hub: 'https://gracecrm-centralhenderson.org/members-card.html',
    crm: 'https://gracecrm-centralhenderson.org/app#/dashboard',
    desktopPortal: 'https://grace-members.vercel.app/portal',
    mobileApp: 'https://grace-members.vercel.app/tenants/central-henderson/grace_central_henderson_members_card_ios_app.html',
  },
  whitelabel: {
    hub: 'https://grace-crm-two.vercel.app/whitelabel-hub.html',
    crm: 'https://grace-crm-two.vercel.app/#/dashboard',
    memberPortal: 'https://grace-members.vercel.app/tenants/faithful/member-portal.html',
    mobileApp: 'https://grace-members.vercel.app/tenants/faithful/grace_faithful_church_members_card_ios_app.html',
  },
};
