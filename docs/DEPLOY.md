# Production deploy

Two Vercel projects build from the same repo (`1SPM/grace-central-henderson`, branch `main`). See [LINKS.md](./LINKS.md) for the full URL tree.

## Vercel projects

| Project | Domains | Hub root `/` | Role |
|---------|---------|--------------|------|
| **grace-crm** | `grace-crm-two.vercel.app`, `gracecrm-centralhenderson.org`, `grace-crm.dev` | White-label hub or demo hub (host-based) | White-label CRM + static member assets |
| **grace-central-henderson** | `grace-central-henderson.vercel.app` | React CRM SPA | Central Henderson demo CRM |

Both projects have Git auto-deploy on **`main`**.

### Host-based entry points (grace-crm project)

| Host | `/` redirects to |
|------|------------------|
| `gracecrm-centralhenderson.org` | `/members-card.html` (Central Henderson demo hub) |
| `grace-crm-two.vercel.app` | `/whitelabel-hub.html` |
| `grace-crm.dev` | `/whitelabel-hub.html` |

**Canonical git remote:** `origin` → `https://github.com/1SPM/grace-central-henderson.git`

Legacy remotes (`legacy-camgitt`, `legacy-grace-member-portal`) are kept for reference only. `1SPM/GraceMemberPortal` is archived.

Manual deploy (fallback):

```bash
npx vercel deploy --prod --yes
```

Do **not** run `vercel deploy --prod` with uncommitted changes to root `index.html` — a local prototype hub overwrite will replace the React CRM at `/`.

## Environment variables by project

### grace-crm (white-label lane)

Generic-oriented production settings on `grace-crm-two.vercel.app`:

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Frontend Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend Supabase anon key |
| `SUPABASE_URL` | Same URL for API routes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase |
| `VITE_DEFAULT_CHURCH_ID` | Default tenant church UUID |
| `VITE_ENABLE_DEMO_MODE` | Usually `false` for white-label |
| `VITE_CLERK_PUBLISHABLE_KEY` | Staff sign-in |
| `CLERK_SECRET_KEY` | API JWT verification |

### grace-central-henderson (demo lane)

Central Henderson demo CRM on `grace-central-henderson.vercel.app`:

| Variable | Purpose |
|---|---|
| Same Supabase / Clerk vars as above | Shared backend |
| `VITE_ENABLE_DEMO_MODE` | `true` for sandbox admin without Clerk |
| `VITE_DEFAULT_CHURCH_ID` | Central Henderson church UUID |

Impact Card Accounts (`#/wallets`) calls `GET /api/neobank?resource=admin`. Without `SUPABASE_SERVICE_ROLE_KEY`, the page shows a configuration error instead of the monitoring dashboard.

## PWA cache

After deploy, staff may need a hard refresh (Cmd+Shift+R) once. The app auto-reloads when `grace-build` meta changes.
