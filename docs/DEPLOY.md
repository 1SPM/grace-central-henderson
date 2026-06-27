# Production deploy — grace-crm-two.vercel.app

Production is served from the Vercel project **`spmmusicbiz-gmailcoms-projects/grace-crm`**, aliased to `https://grace-crm-two.vercel.app` and `https://gracecrm-centralhenderson.org`.

**Canonical git remote:** `origin` → `https://github.com/1SPM/grace-central-henderson.git` (branch `main`).

Legacy remotes (`legacy-camgitt`, `legacy-grace-member-portal`) are kept for reference only — do not deploy from them.

GitHub pushes do **not** automatically update the Vercel alias unless the project is linked to this repo. After merging to `main`, deploy from the repo root:

```bash
npx vercel deploy --prod --yes
```

Do **not** run `vercel deploy --prod` with uncommitted changes to root `index.html` — a local prototype hub overwrite will replace the React CRM at `/`.

## Required production environment variables

Set these in Vercel → Project → Settings → Environment Variables (Production):

| Variable | Purpose |
|---|---|
| `VITE_SUPABASE_URL` | Frontend Supabase URL |
| `VITE_SUPABASE_ANON_KEY` | Frontend Supabase anon key |
| `SUPABASE_URL` | Same URL for API routes (or rely on `VITE_SUPABASE_URL`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase (neobank, billing, agents) |
| `VITE_DEFAULT_CHURCH_ID` | Demo / single-tenant church UUID |
| `VITE_ENABLE_DEMO_MODE` | `true` for sandbox admin without Clerk (optional) |
| `VITE_CLERK_PUBLISHABLE_KEY` | Staff sign-in (required when demo mode off) |
| `CLERK_SECRET_KEY` | API JWT verification |

Impact Card Accounts (`#/wallets`) calls `GET /api/neobank?resource=admin`. Without `SUPABASE_SERVICE_ROLE_KEY`, the page shows a configuration error instead of the monitoring dashboard.

## PWA cache

After deploy, staff may need a hard refresh (Cmd+Shift+R) once. The app auto-reloads when `grace-build` meta changes.
