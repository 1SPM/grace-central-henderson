# GRACE Link Tree

Single reference for product URLs, hubs, and Vercel project ownership.

## Product lanes

### Central Henderson demo (SaaS demo tenant)

| Surface | URL |
|---------|-----|
| **Demo hub** | https://gracecrm-centralhenderson.org/members-card.html |
| **Demo CRM** | https://gracecrm-centralhenderson.org/app#/dashboard |
| **Desktop member portal** | https://gracecrm-centralhenderson.org/previews/grace_member_portal_central.html |
| **Mobile iOS app** | https://gracecrm-centralhenderson.org/grace_central_henderson_members_card_ios_app.html |

Root on `gracecrm-centralhenderson.org` redirects to `/members-card.html`; the CRM SPA is served at any non-reserved path (canonically `/app`).

### White-label SaaS (pre-branded generic)

| Surface | URL |
|---------|-----|
| **White-label hub** | https://grace-crm-two.vercel.app/whitelabel-hub.html |
| **White-label CRM** | https://grace-crm-two.vercel.app/#/dashboard |
| **Generic member portal** | https://grace-crm-two.vercel.app/previews/grace_member_portal_generic.html |

Root on `grace-crm-two.vercel.app` and `grace-crm.dev` serves the white-label CRM; hub is at `/whitelabel-hub.html`.

## Vercel projects

| Project | Domains | Git auto-deploy | Role |
|---------|---------|-----------------|------|
| **grace-crm** | `gracecrm-centralhenderson.org`, `grace-crm-two.vercel.app`, `grace-crm.dev` | Yes (`main`) | **The single project of record** — demo lane, white-label lane, static hubs, member assets, all API functions |

> ⚠️ **One repo → one Vercel project.** A duplicate project (`grace-central-henderson`, serving grace-central-henderson.vercel.app) previously auto-deployed from this same repo with divergent env vars — it served a broken copy of the app and caused the Ask Grace "Not found" confusion (see UX review 2026-07-06). It was removed on consolidation. Never attach a second Vercel project to this repo.

## Shared config

Hub pages load [`public/grace-links.js`](../public/grace-links.js) so button targets stay in sync with this document.

## GitHub Pages (static preview)

https://1spm.github.io/grace-central-henderson/ — legacy static preview; production uses Vercel URLs above.
