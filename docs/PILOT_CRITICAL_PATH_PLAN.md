# Pilot Critical Path — Task Breakdown

**Status:** Track A resolved (2026-09-07, `grace-links.js` dead-link fix — see its correction
note below); Tracks B and C still plan-only.
**Date:** 2026-09-07

## Why this exists

The member-memory qualification gate (`docs/MEMBER_MEMORY_QUALIFICATION_PLAN.md`) is good
infrastructure work, but it is not on the critical path to an actual pilot: it's built for
`/portal`, and `/portal` has no inbound link from production today. This plan tracks the
three things that are closer to the pilot than memory is, in the order they actually block
each other.

**Explicitly excluded, by owner instruction (2026-09-07):** the Faithful demo tenant's
companion showing "Pastor James Wilson" as its AI persona is **not a leak** — it is an
intentional shared placeholder identity used in both tenants until further notice. No task,
no TD entry, and no doc correction is created for it here. If this changes, it gets a fresh
finding at that time, not a retroactive edit of this line.

## Track A — The demo hub's portal link was dead; the real portal was already live

**⚠️ Correction to this track's original write-up (same day, 2026-09-07).** This track
originally described a risky production redirect cutover — claiming `/portal` had no inbound
link anywhere and that `apps/member-web/vercel.json` redirected the live domain's root to
`members-card.html`. That was wrong on both counts, discovered while starting the work:
there is no `apps/member-web/vercel.json` (the redirect belongs to the **admin-web** project,
a different Vercel project, and `members-card.html` is its own legitimate hub page, not a
competing fake portal). More importantly, **another session had already fixed the real "Two
Front Doors" problem the day before** (commits `ed2e7bd`, `678f1ca`, 2026-09-06): the React
member-portal pages were removed, and `PortalRoot.tsx` now authenticates via Clerk and hands
off to the real static tenant page. `/portal` on the `grace-members` project was confirmed
live and working (HTTP 200) before any change here today.

**What was actually broken, and is now fixed:** `apps/admin-web/public/grace-links.js` — the
shared config both hub pages read their "Open Member Portal" link from — still pointed at
`/previews/grace_member_portal_central.html` and `/previews/grace_member_portal_generic.html`,
neither of which exists in this monorepo. A member (or a salesperson demoing the product)
clicking that button hit a dead link. Fixed: both entries now point at
`https://grace-members.vercel.app/portal`, matching the server-side `MEMBER_PORTAL_URL`
default already used by `api/people/_preview-portal-token.ts`. Tracked as TD-073, marked
resolved.

**Remaining, smaller follow-ups — not blockers:**
1. Verify the fix live once this deploys: click "Open Member Portal" from
   `gracecrm-centralhenderson.org/members-card.html` and confirm it lands on a working Clerk
   sign-in at `grace-members.vercel.app/portal`, not a 404.
2. Consider a real custom domain for the `grace-members` project instead of the raw
   `.vercel.app` URL — cosmetic and trust-building, not a functional blocker.
3. Update `docs/DEPLOY.md` / `docs/LINKS.md` if either still describes the old previews-based
   portal path as current.

**No longer applicable:** the original tasks 1–3 (staged redirect cutover, re-verifying
`/portal`'s flows "under a real cutover," relabeling the static pages as previews) assumed an
architecture that isn't the current one. `/portal` already is the real, working front door;
nothing here needed a production cutover.

**Depends on nothing further; unblocks:** the member-memory gate and any other `/portal`
work are now exercised by a surface members can actually reach, once this deploys.

## Track B — Wallet: stage for the real API, keep demo state on both platforms

**Amends TD-052's resolution path** (see `TECH_DEBT.md`) — owner decision 2026-09-07 changes
what "resolution" means here. TD-052 already tracks that `api/_lib/i2c/live-adapter.ts`
throws on every call and every Impact Card number today is mock-adapter data. What's new:
**the demo wallet UI on both static tenant pages (account/routing numbers, the click-to-reveal
CVV) stays exactly as it is, indefinitely, until told otherwise** — this is a deliberate
reversal of the member-portal audit's earlier recommendation that those details "come out
until real rails exist." The owner's call is to build the real path in parallel, not to gate
the demo behind it.

Also confirmed while planning this: the real `/portal` React app (`apps/member-web/src/portal/`)
has **no wallet page at all** yet — only `PortalRoot.tsx` and `PortalAuthContext.tsx` exist.
"Stage for the real API" is a build task, not a fix to something broken.

1. Implement `api/_lib/i2c/live-adapter.ts` against i2c's real API (`I2C_API_BASE`, KYC
   submit, card issue/freeze/unfreeze/cancel, balance, deposit instructions, transfer),
   behind the existing `I2cAdapter` interface — the mock/live switch in
   `api/_lib/i2c/index.ts` (`I2C_LIVE` + `I2C_API_KEY`) stays the toggle; no other route
   changes.
2. Add provider-sandbox tests against i2c's real test environment once credentials exist
   (TD-052's existing re-entry trigger).
3. Build the real `/portal` wallet page in React, reading through `api/portal` routes,
   defaulting to the mock adapter until `I2C_LIVE=true` is flipped per-tenant.
4. Leave both static tenant pages' wallet UI untouched — no DEMO-badge removal, no CVV
   lockdown, no routing-number change. It is the demo state, on purpose, on both platforms,
   until further notice.
5. Flip `I2C_LIVE=true` per-tenant only after a pilot review, per TD-052's existing gate —
   this plan does not change that condition, only what happens to the demo UI in the
   meantime.

**Depends on:** nothing upstream; can proceed in parallel with Track A. The real wallet page
only matters once Track A ships, since it lives on `/portal`.

## Track C — Anonymous AI access

**Amends TD-043's "still open (operational, not code)" item.** `docs/DEPLOY.md:46` documents
`DEMO_AI_ACCESS` as `true` in Production — the repo's own deploy doc, not an inference.
Verified today: the variable is set (encrypted) in both `grace-crm` and `grace-members`
production environments on Vercel, unchanged for 63 days — meaning it predates the
2026-09-01 audit that found the anonymous `/api/ai/generate` lane live and flagged it. Its
actual current value can't be read from here; the doc's own claim is the strongest evidence
available without opening the Vercel dashboard.

1. **Owner action, not engineering:** check the real value in the Vercel dashboard for both
   projects — five minutes, needs dashboard access this session doesn't have.
2. If `true`: decide deliberately whether the public demo lane should stay open (it already
   has per-IP throttling and capped output — `api/ai/_generate.ts`'s `DEMO_RATE_LIMIT`) or
   close. This is a product/risk decision, not something to flip unilaterally.
3. Whatever the decision, record it — a one-line update to `docs/DEPLOY.md`'s table or a TD
   note — so a future audit finds a decision, not a rediscovery.

**Depends on:** nothing. Independent of Track A and B; can happen today.

## Verification

- Track A: confirm live with an unauthenticated request to the production root — expect the
  `/portal` shell, not `members-card.html`; confirm `/portal`'s existing test suites still
  pass post-cutover.
- Track B: `TECH_DEBT.md` TD-052 stays open until `I2C_LIVE=true` is flipped for a real
  tenant; the demo pages' own existing tests (if any) are unaffected since nothing in them
  changes.
- Track C: no test to write — this is a dashboard check and a documentation update.
