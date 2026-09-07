# Pilot Critical Path — Task Breakdown

**Status:** plan only; no code changed by this document. Track A is the blocker for everything else.
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

## Track A — Make `/portal` the real front door

**New: TD-073.** On 2026-09-03, during the member-portal audit, the decision was made that
`/portal` (the real React app — Clerk auth, KYC, Stripe, the server-composed member
assistant) is the pilot surface, and the static pages (`members-card.html`, the two
`tenants/*/member-portal.html` forks) demote to design spec and sales demo. **That decision
was never written into a tracked document, and the routing was never changed.** Verified
today: `vercel.json`'s redirect from the live domain's root still points at
`members-card.html`; nothing in `apps/member-web` links to `/portal`. Every feature built for
`/portal` — including the entire member-memory gate — currently ships to a surface no member
can reach.

1. Point the live-domain redirect at `/portal` instead of `members-card.html` in
   `apps/member-web/vercel.json`. Stage behind a specific test account or a header-gated
   flag first — this is a production cutover for the live Central Henderson tenant, not a
   demo tenant, so it does not get a cold switch.
2. Re-verify `/portal`'s auth, KYC, giving, and assistant flows under the traffic pattern a
   real cutover implies, not just the isolated QA passes already run against it.
3. Relabel `members-card.html` and both `tenants/*/member-portal.html` pages explicitly as
   design previews wherever a link to them survives the cutover, so nobody — staff, a new
   hire, a future audit — mistakes them for the live product once they're no longer the
   front door.
4. Update `docs/DEPLOY.md`, `docs/LINKS.md`, and `PILOT_READINESS.md` to point at `/portal`
   as the member-facing surface; both currently describe the redirect-to-`members-card.html`
   behavior as if it were permanent.
5. Once live, retire the `ma-safety-baseline-non-persistence-today` framing implicitly tied
   to "the assistant nobody reaches" — no code change, just an awareness check that the
   member-memory gate's cases are now exercised by real traffic, not just the harness.

**Blocks:** every other track. A wallet, a memory feature, or an AI-access fix on `/portal`
has no effect on what a member actually sees until this ships.

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
