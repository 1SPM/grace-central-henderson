# GRACE Link Tree

Single reference for product URLs, hubs, and Vercel project ownership.

## Product lanes

### Central Henderson demo (SaaS demo tenant)

| Surface | URL |
|---------|-----|
| **Demo hub** | https://gracecrm-centralhenderson.org/members-card.html |
| **Demo CRM** | https://grace-central-henderson.vercel.app/#/dashboard |
| **Desktop member portal** | https://gracecrm-centralhenderson.org/previews/grace_member_portal_central.html |
| **Mobile iOS app** | https://gracecrm-centralhenderson.org/grace_central_henderson_members_card_ios_app.html |

Root on `gracecrm-centralhenderson.org` redirects to `/members-card.html`.

### White-label SaaS (pre-branded generic)

| Surface | URL |
|---------|-----|
| **White-label hub** | https://grace-crm-two.vercel.app/whitelabel-hub.html |
| **White-label CRM** | https://grace-crm-two.vercel.app/#/dashboard |
| **Generic member portal** | Coming soon (placeholder on white-label hub) |

Root on `grace-crm-two.vercel.app` and `grace-crm.dev` redirects to `/whitelabel-hub.html`.

## Vercel projects

| Project | Domains | Git auto-deploy | Role |
|---------|---------|-----------------|------|
| **grace-crm** | `grace-crm-two.vercel.app`, `gracecrm-centralhenderson.org`, `grace-crm.dev` | Yes (`main`) | White-label deploy + static hubs/member assets |
| **grace-central-henderson** | `grace-central-henderson.vercel.app` | Yes (`main`) | Central Henderson demo CRM |

Both projects build from `1SPM/grace-central-henderson`. Environment variables differ per project (see [DEPLOY.md](./DEPLOY.md)).

## Shared config

Hub pages load [`public/grace-links.js`](../public/grace-links.js) so button targets stay in sync with this document.

## GitHub Pages (static preview)

https://1spm.github.io/grace-central-henderson/ — legacy static preview; production uses Vercel URLs above.
