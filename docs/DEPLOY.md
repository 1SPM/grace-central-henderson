# Production deploy

**One repo → one Vercel project.** `1SPM/grace-central-henderson` (branch `main`) deploys to the single Vercel project **`grace-crm`**. See [LINKS.md](./LINKS.md) for the full URL tree.

> History note (2026-07-06): a duplicate Vercel project (`grace-central-henderson`) used to build from this same repo with divergent env vars, serving a broken copy of the app at grace-central-henderson.vercel.app. It was deleted during infrastructure consolidation. Do not re-create a second project against this repo.

## The Vercel project

| Project | Domains | Hub root `/` | Role |
|---------|---------|--------------|------|
| **grace-crm** | `gracecrm-centralhenderson.org`, `grace-crm-two.vercel.app`, `grace-crm.dev` | Host-based (below) | Demo lane + white-label lane + static member assets + all API functions |

Git auto-deploy on **`main`** = production. Every PR gets a preview URL.

### Host-based entry points

| Host | `/` behavior |
|------|------------------|
| `gracecrm-centralhenderson.org` | Redirects to `/members-card.html` (Central Henderson demo hub); CRM SPA at `/app` |
| `grace-crm-two.vercel.app` | Serves React CRM SPA; hub at `/whitelabel-hub.html` |
| `grace-crm.dev` | Serves React CRM SPA; hub at `/whitelabel-hub.html` |

**Canonical git remote:** `origin` → `https://github.com/1SPM/grace-central-henderson.git`

Legacy remotes (`legacy-camgitt`, `legacy-grace-member-portal`) are kept for reference only. `1SPM/GraceMemberPortal` is deprecated/archived.

Manual deploy (fallback):

```bash
npx vercel deploy --prod --yes
```

Do **not** run `vercel deploy --prod` with uncommitted changes to root `index.html` — a local prototype hub overwrite will replace the React CRM at `/`.

## Environment variables (single project, per-environment)

All env vars live on the **grace-crm** project. Use Vercel's Production/Preview split rather than separate projects.

| Variable | Purpose | Production | Preview |
|---|---|---|---|
| `VITE_SUPABASE_URL` / `SUPABASE_URL` | Supabase URL (frontend / API) | prod project | prod project |
| `VITE_SUPABASE_ANON_KEY` | Frontend Supabase anon key | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase | ✓ | ✓ |
| `VITE_DEFAULT_CHURCH_ID` | Default tenant church UUID | Central Henderson | Central Henderson |
| `VITE_ENABLE_DEMO_MODE` | Sandbox admin without Clerk | `true` while demoing; revisit at Beta | `true` |
| `DEMO_AI_ACCESS` | Unauthenticated demo lane on `/api/ai/generate` (rate-limited, token-capped) | `true` while demoing | `true` |
| `VITE_CLERK_PUBLISHABLE_KEY` | Staff sign-in | prod instance (Beta Phase 2) | dev instance |
| `CLERK_SECRET_KEY` | API JWT verification | prod instance (Beta Phase 2) | dev instance |
| `GEMINI_API_KEY` | Ask Grace / companion AI | ✓ | ✓ |
| `ELEVENLABS_API_KEY` / `GRACE_TTS_UPSTREAM_URL` | GRACE voice | ✓ | ✓ |

`VITE_TENANT` (optional) selects the tenant config from `src/config/tenant.ts`; unset = Central Henderson.

Impact Card Accounts (`#/wallets`) calls `GET /api/neobank?resource=admin`. Without `SUPABASE_SERVICE_ROLE_KEY`, the page shows a configuration error instead of the monitoring dashboard.

## PWA cache

After deploy, staff may need a hard refresh (Cmd+Shift+R) once. The app auto-reloads when `grace-build` meta changes.

## Verifying git ↔ Vercel sync

Vercel builds from source (`vercel.json` `buildCommand`), not committed `dist/`. After pushing to `main`:

1. GitHub **main** commit SHA should match your local `git rev-parse HEAD`.
2. Vercel **Deployments** → Production should show the same short SHA (refresh if the overview lags).
3. Live check: `curl -sL https://grace-crm-two.vercel.app/ | grep grace-build` — build id updates on each deploy.

GitHub Actions **CI** and **Deploy Central Henderson Pages** are separate from Vercel auto-deploy; fix those for green checks, not for Vercel propagation.
