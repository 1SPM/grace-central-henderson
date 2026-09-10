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

## Architecture

| Surface | URL |
|---------|-----|
| **Intelligence layer** (north-star visual) | `/grace-intelligence.html` |
| **Platform landing** | `/grace-platform.html` |

Outer systems on the intelligence page are labeled live / partial / later. Do not read that visual as a claim that every capability is shipped.

## Shared config

Hub pages load [`public/grace-links.js`](../public/grace-links.js) so button targets stay in sync with this document.

## Retired: GitHub Pages static preview

`https://1spm.github.io/grace-central-henderson/` was a legacy static preview,
superseded by the Vercel URLs above. Its workflow (`.github/workflows/pages.yml`)
was **removed on 2026-09-10**: it still required `previews/*` paths the Phase-1
monorepo split deleted, so it could never pass again, and its deploy step
published the whole repository root as a website. The already-published site may
remain reachable until GitHub Pages is disabled for the repository.
