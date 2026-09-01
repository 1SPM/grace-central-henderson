# GRACE — Pilot Readiness Assessment & Roadmap

**Prepared:** 2026-07-31 (v3 — complete)
**Audience:** Sean McKay, David Stein, Marco (GRACE's AI engineering agent)
**Purpose:** Establish where GRACE actually is today, close out the open
decisions from v1/v2, and hand over a complete, executable punch list.

> **What changed since v2, in one paragraph.** Four decisions are now resolved:
> the pilot church is US-based (closes the residency question), AWS hosting was
> never compliance-driven — it was a preference under review, not a
> requirement (this reshapes Phase 3 substantially), Stripe runs the pilot with
> i2c as the later graduation target, and Marco is GRACE's AI engineering
> agent with working code context, not an unfamiliar human hire. Section 9
> records exactly what changed and why, so nothing here overwrites v1/v2
> silently.

---

## 1. Where GRACE is today

### 1.1 Scale (measured, not estimated)

| Dimension | Count |
|---|---|
| Frontend source files (`src/**.ts,.tsx`) | 441 |
| API function files (`api/**.ts`) | 288 |
| Test files | 121 |
| Database migrations | 65 |
| Environment keys (`.env.example`) | 57 |
| Architectural decision records | 12 (ADR-001 … ADR-012) |
| Tracked tech-debt items | 38+ (TD-001 … TD-053, non-contiguous) |
| Runbook incident entries | 17 (RB-001 … RB-017) |
| Open GitHub issues | 13 — 4×P0, 3×P1, 4×P2, 2×P3 (all privacy/security, #22–#35) |
| Open dependency PRs | 11 |
| Prod-dependency vulnerabilities (`npm audit --omit=dev`) | 20 moderate, 0 high/critical |

This is a **substantial, real product**, not a prototype. The engineering
discipline is above average: a genuine ADR record, a maintained debt ledger
with honest status notes, and a documented CI security gate.

### 1.2 What is live right now

- **Two tenants** on one Supabase project (`asphekfvpiancyltzdxp`, `us-east-1`):
  - **Central Henderson** `1111…` — a **live client** with real congregation data
  - **Faithful** `2222…` — the demo/sales tenant
- **Hosting:** Vercel (frontend + ~100 serverless functions via a catch-all route)
- **Auth:** Clerk, with fail-closed production behaviour
- **CI:** 12-check security gate; **green on `main`** as of this assessment
- **Payments:** Stripe wired end-to-end but **dormant** — no live keys set, so
  every payment route fail-closes to 503 today (see §4)
- **Impact Card / i2c:** every card/KYC/interchange row in the database is
  **mock-adapter data**; the live adapter is an unimplemented stub (see §5)

### 1.3 What is genuinely done

Based on the debt ledger's own evidence notes, these are resolved with tests:

- Audit logging on every 2xx mutation (append-only, 13 tests) — TD-003
- Unified append-only `ledger_entries` + webhook idempotency + DLQ — TD-009, TD-004
- AI token-usage ledger with per-tenant budget caps and a synthetic burn test — TD-007
- Error monitoring (Sentry, PII-scrubbed both ends) — TD-006
- IDOR server-side checks, full 28-route audit — TD-014
- Load-test baseline (k6, SLO thresholds asserted) — TD-021
- Runbook coverage for the top incidents — TD-022
- RBAC table model (13 roles, permission-scoped) — ADR-011
- Payment/entitlement negative-test suite + dispute→ledger handler + i2c
  simulated-events auth gating (fail-closed on a forgotten secret) — PRs #43/#45
- Secret scanning, SAST, dependency audit, RLS lint in CI

---

## 2. Data residency — resolved

**Decided:** the pilot church is US-based. `us-east-1` (where the live project
already sits) is an acceptable region. This closes what v1/v2 flagged as the
most expensive-to-defer open question.

**What v1 got wrong, for the record:** it called this "ADR-004 violated."
ADR-004's own status line was **"Proposed (pending Supabase project
provisioning)"** — never accepted — so nothing was formally broken. What was
real: a live client's data had already landed in a region a proposed-but-never-
enacted decision said shouldn't hold production data. That's now moot given the
US-church answer, but the paperwork gap is still worth one action:

- **Action R1 — Write the supersession.** Add a new ADR entry (`DECISIONS.md`
  is append-only by its own convention) recording: *"ADR-004 (Canada Central)
  is superseded — the pilot and near-term customers are US churches;
  `us-east-1` is accepted."* Five minutes of writing, and it closes the gap
  between what the decision log says and what's actually true. Skipping this
  is exactly how the next engineer inherits a contradiction.
- **Watch item, not a blocker:** if a Canadian church is ever onboarded, this
  decision gets revisited then — with real migration cost, same as before.
  Nothing about today's answer forecloses that; it just isn't today's problem.

---

## 3. AWS hosting — reframed, not just descoped

You said it plainly: *"no compliance on the AWS, this step is just a preference
we THINK we need."* That sentence is worth taking at face value and pushing on,
because the original punch list sized real engineering weeks against a
requirement that turns out not to exist yet.

**What AWS was actually buying, itemized:**

| AWS component | What it's for | Compliance-driven? | Still worth doing? |
|---|---|---|---|
| Secrets Manager (ADR-008) | Rotation, audit trail, centralized secrets vs. scattered Vercel env vars | No — general hygiene | **Yes, cheap, already decided.** Do this regardless. |
| Webhook ingestion on Lambda (TD-017) | Handles webhook volume/timeout beyond Vercel's serverless limits | No — a *scale* trigger (>100 req/min sustained, or timeouts) | **No — trigger hasn't fired.** Nothing in this pilot approaches that volume. |
| Workers on Fargate (TD-018) | Long-running agent jobs beyond Vercel Cron's ceiling | No — a *scale* trigger (>10s agent runs) | **No — Inngest first per the existing recorded path, and even that only when something actually needs it.** |
| Per-tenant isolated hosting (the "hub" framing, TD-028) | A stronger isolation *story* — each church's own boundary | No — a positioning/architecture preference | **Maybe, but not for the pilot.** See below. |

**Direct recommendation: shrink Phase 3 to Secrets Manager only for the pilot.**
Nothing else in the original AWS scope has a live trigger. Building webhook
Lambda, ECS Fargate, or a per-tenant AWS isolation layer now would be solving a
capacity and positioning problem that doesn't exist yet, on a timeline (the
pilot) where the actual work is standing up staging and closing privacy issues.

**One question back to you, not answered by the code:** is the "AWS = your own
hub" language something you want to keep for **sales positioning** even without
a technical or compliance driver — i.e., is there a story you want to tell
churches about isolation that's worth building toward regardless? If yes, that
is a legitimate reason to still do the work — it just isn't a security
requirement, and should be scoped and timed as a positioning investment, not
folded into "secure hosting" as if a customer or auditor is asking for it.

If the answer is "no, park it," Phase 3 in §7 collapses from six items to one.

---

## 4. Stripe — reactivating for Phase 1

**Decided:** Stripe runs giving/subscriptions for the pilot; i2c is the later
graduation target (§5).

**Current state, precisely:** Stripe is fully wired in code (payment intents,
subscriptions, Connect groundwork, webhook dispatch, dispute→ledger handling,
a test/live key-mixing guard) but **dormant** — no `STRIPE_SECRET_KEY` is set
anywhere, so every payment route returns 503 `service_not_configured` today.
This was a deliberate, recorded pause (`.github/dependabot.yml`'s ignore block
says so explicitly), not a defect — it's why reactivating is mostly
configuration, not new engineering.

**What reactivation actually requires:**

| # | Item | Notes |
|---|---|---|
| ST1 | Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `VITE_STRIPE_PUBLISHABLE_KEY` | Use **test-mode** keys (`sk_test_…`) through the pilot. `stripeMode.ts`'s guard will hard-fail if a live key ever lands in a non-production deploy — that protection is already built. |
| ST2 | Point the webhook endpoint at the real domain, verify signature | Existing webhook dispatcher (`api/webhooks/stripe.ts`) already has idempotency + DLQ (TD-004/TD-009, resolved) |
| ST3 | Re-test `activate-trial` now that a real key exists | `POST /api/billing/activate-trial` already returns 501 whenever `STRIPE_SECRET_KEY` IS set — this is the correct fail-safe (it exists specifically to stop trial-bypass once real billing is live). Confirm it still behaves once keys land; no code change expected. |
| ST4 | Remove the Dependabot Stripe-major ignore block | One YAML edit — the block's own comment says *"Remove this block when the Stripe work is picked back up."* |
| ST5 | **Do not** merge the closed major-version Stripe SDK PRs (#73, #80, #82) during pilot ramp | 5–8 breaking versions of a payment SDK, unvalidated. Let Dependabot reopen them fresh once ST4 lands, and evaluate each individually — not during the same window as a pilot launch. |

None of this is new engineering. It's turning on what's already built, in test
mode, and being deliberate about not compounding it with an unrelated major
SDK upgrade during the same window.

---

## 5. i2c — what "apply the sandbox" actually requires

You said the i2c sandbox is *"ready to apply."* Before advising a next step, I
checked exactly what "applying" it would touch — because the honest answer
changes what happens next.

**Finding: the live adapter does not exist. It's a stub that throws on every
call.**

```
api/_lib/i2c/live-adapter.ts

export const liveI2cAdapter: I2cAdapter = {
  mode: 'live',
  submitKyc:  () => Promise.reject(notImplemented('submitKyc')),
  issueCard:  () => Promise.reject(notImplemented('issueCard')),
  freezeCard: () => Promise.reject(notImplemented('freezeCard')),
  ... // every method: throw "not yet implemented"
};
```

Today, `api/_lib/i2c/index.ts` returns this live adapter only when
**`I2C_LIVE=true`** *and* `I2C_API_KEY` is set — otherwise it returns a
deterministic mock adapter, which is what every existing Impact Card number
(KYC, cards, interchange, allocations) is built on right now.

**This means: simply setting `I2C_API_KEY` to your sandbox key and flipping
`I2C_LIVE=true` would not connect to i2c's sandbox.** It would make every card
operation throw in production. This is by design, not an oversight — the
comment in the code says so directly: *"fails loudly rather than silently
using mock data that pretends to be real."* The tracked item is **TD-052**
(P1), which states plainly: *"do not flip `I2C_LIVE=true` without implementing
`live-adapter.ts` against real i2c sandbox/production endpoints first."*

*(One small correction while I was in this code: both `live-adapter.ts` and
`index.ts` cite this as "TD-036" in their comments — that's the wrong number.
TD-036 is the unrelated Stripe sign-up item. The real entry is TD-052. Worth a
one-line fix in those two comments so the next reader isn't sent to the wrong
place, the same way I nearly was.)*

**What "applying the sandbox" genuinely requires, in order:**

| # | Item | Size |
|---|---|---|
| I1 | Get i2c's sandbox API docs (endpoints, auth scheme, request/response shapes) — you may already have these if credentials are in hand | — |
| I2 | Implement all 8 methods in `live-adapter.ts` against i2c's real sandbox endpoints (`submitKyc`, `issueCard`, `freezeCard`, `unfreezeCard`, `cancelCard`, `getBalance`, `getDepositInstructions`, `initiateTransfer`) | 5–10d, depends entirely on how well-documented i2c's sandbox API is |
| I3 | Add provider-sandbox tests that hit i2c's real test environment (not the internal mock) | 2–3d |
| I4 | Flip `I2C_LIVE=true` **per-tenant**, not globally — TD-052's own resolution path says so | 0.5d, but gated on I2 + I3 |
| I5 | Run the pilot review before I4 | see below |

**There is already a governance gate built for exactly this transition** — a
real Work Order type, "GRACE Impact Card Pilot Readiness"
(`api/work-orders/_pilot-readiness.ts`), with 10 concrete tasks: document
inventory, product readiness, financial assumptions, member onboarding,
communications, privacy review, risk review, KPI definition, launch checklist,
and — notably — **independent validation, where someone other than the task
owner signs off**. This doesn't do the i2c integration work itself, but it's
the checklist that should gate flipping `I2C_LIVE=true`, and it already exists
in the product. Use it rather than inventing a parallel checklist.

**Sequencing relative to Stripe (§4):** run Stripe for the pilot now, and treat
i2c's live-adapter implementation (I1–I3) as background work in parallel — it
does not block the pilot and does not touch anything Stripe-related. Only I4
(flipping the tenant live) is a real go/no-go moment, and it should wait for
the Work Order's independent-validation step regardless of engineering
readiness.

---

## 6. Marco — reframing the punch list around an AI agent, not a new hire

v2 flagged that git history showed no human contributor named Marco, and
recommended budgeting onboarding time. That concern is resolved: **Marco is
GRACE's AI engineering agent, and already has working context on this
codebase.** That changes two things about the punch list, and does not change
a third:

- **No ramp-up cost.** The original day-sizing assumed a human reading 441
  files and 12 ADRs cold. That line item is gone.
- **Execution can parallelize further than one-engineer-at-a-time sizing
  assumed.** Independent items (e.g., Phase 2's S1–S8) don't need to run
  sequentially the way a single human's calendar would force.
- **What does NOT compress: human decision points and review gates.** D1–D4
  needed Sean/David's judgment, not engineering time, and that's exactly why
  they took a conversation to resolve rather than a sprint. The same is true
  going forward for anything touching live production data, secrets, payment
  configuration, or migrations — those need a human to review and approve
  before they land, regardless of how fast the agent can produce them. The
  actual pilot bottleneck is now **your and David's review/approval cadence**,
  not implementation throughput.

**Practical effect on §7:** sizes below are left as engineer-days for judging
relative weight, but read them as *"how much is here,"* not *"how many
calendar days this takes."* The calendar depends on your review cadence, which
only you can set.

---

## 7. Complete punch list

### Phase 0 — Decisions (now mostly closed)

| # | Item | Status |
|---|---|---|
| D1 | Data residency | ✅ **Resolved** — US church, `us-east-1` accepted (§2). Action R1 (write the supersession) remains. |
| D2 | AWS hosting scope | ✅ **Reframed** — no compliance driver; recommend Secrets-Manager-only for pilot (§3). One open question back to you: keep it for sales positioning or park it? |
| D3 | Pilot scope — which church, how many users, what data | ⬜ **Still open** — not answerable from the repository |
| D4 | Stripe vs. i2c sequencing | ✅ **Resolved** — Stripe for Phase 1, i2c graduation later (§4, §5) |

**Only D3 remains before Phase 1 can be scoped precisely** (staging needs to
know what it's rehearsing for).

### Phase 1 — Foundation (the keystone; unchanged priority)

| # | Item | Refs | Size |
|---|---|---|---|
| F1 | Stand up a **staging** Supabase project + environment | new (no staging exists today) | 3–5d |
| F2 | Migration workflow: apply via CI to staging → promote to prod | same | 2–3d |
| F3 | Create staging test users; add the 7 `SUPABASE_TEST_*` secrets | TD-001/002 | 1d |
| F4 | **Turn the RLS gate red-capable** — confirm it actually fails on a seeded cross-tenant violation | TD-002 | 1–2d |
| F5 | Reconcile the security status docs into one authoritative source (`SECURITY_FINDINGS_STATUS.md` vs. `TECH_DEBT.md` disagree; `TD-032`'s npm-audit numbers are also stale) | — | 1d |

**F4 remains the single highest-value item in this document.** The cross-tenant
isolation suite for a multi-tenant giving platform does not run today; CI is
green because the check is skipped, not because it passed.

### Phase 2 — Security & privacy close-out (unchanged)

| # | Item | Refs | Size |
|---|---|---|---|
| S1 | Close P0 privacy issues: LLM handling of pastoral content, retention policy + purge job | #22, #23 | 5–8d |
| S2 | Verify erasure/export pipeline end-to-end against staging | #24 | 2d |
| S3 | Audit **reads** of pastoral/financial tiers, not just writes | #26 | 3d |
| S4 | Extend Sentry scrubber from credentials to full PII | #25 | 1–2d |
| S5 | Review the 23 RLS-no-policy tables; record intent per table (largely by design per ADR-003/012 — confirm, don't mass-add policies) | — | 2d |
| S6 | Review anon-executable `SECURITY DEFINER` functions | — | 0.5d |
| S7 | Finish server-side validation across all write endpoints | TD-011 | 3–5d |
| S8 | Session timeout + complete rate-limit coverage | TD-012, TD-013 | 2–3d |

### Phase 3 — Hosting (now much smaller — see §3)

| # | Item | Refs | Size |
|---|---|---|---|
| H1 | AWS Secrets Manager + sync into deploy | ADR-008, TD-005 | 3–4d |
| H2 | Write the ADR supersession note for D2, recording "descoped to secrets only for pilot; broader hosting revisited if X" | — | 0.5d |

Everything else from the original AWS scope (webhook Lambda, Fargate workers,
per-tenant isolated hosting) is **removed from the pilot punch list** per §3.
It re-enters only if its own named trigger fires (TD-017/018), or if you
confirm the sales-positioning reason in §3's open question.

### Phase 4 — Payments (new section, replaces the old ambiguity)

| # | Item | Refs | Size |
|---|---|---|---|
| PM1 | Stripe reactivation (ST1–ST5) | §4 | 1–2d, mostly config |
| PM2 | i2c live-adapter implementation (I1–I3) | §5, TD-052 | 7–13d, background/parallel, does not block pilot |
| PM3 | Fix the TD-036→TD-052 mislabel in `live-adapter.ts` / `index.ts` comments | §5 | trivial |
| PM4 | Run the existing Impact Card Pilot Readiness Work Order before flipping any tenant to `I2C_LIVE=true` | §5 | governance, not engineering time |

### Phase 5 — Pilot enablement

| # | Item | Size |
|---|---|---|
| P1 | Onboard David Stein as a platform user (§8) | 0.5d |
| P2 | Dependency drift: remaining open PRs, several majors (TypeScript 7, Vite 8, React, Sentry 10) — evaluate individually, not batched | 3–5d |
| ~~P3~~ | ~~Commit/verify `054_append_only_fk_cascade_fix.sql`~~ — **done.** Verified applied to prod (ledger `20260720220000 append_only_fk_cascade_fix`, 2026-07-20); all four `*_block_mutation()` functions carry the fix and match the file. Now committed, with a regression test (`tools/append-only-cascade-smoke.test.ts`). | — |
| P4 | Pilot runbook + support escalation path | 2d |
| P5 | Backup/restore rehearsal — *actually restore*, don't just enable backups | 1–2d |

---

## 8. Onboarding David Stein

David (`dzstein911@gmail.com`) should come in as a **real user on the live
platform**, not a shared login.

Recommended: invite to the **Faithful demo tenant** first, not Central
Henderson. Faithful has 181 people and 18 months of seeded activity, so he
sees a fully populated product; Central Henderson is a live client and its
data should not be a sandbox.

Role: `admin` or `pastor` gives full surface area. The RBAC model (ADR-011)
supports 13 finer roles if narrower access is wanted.

> **I have not sent this invite.** It emails a real person and creates an
> account on a live system — that is yours to trigger, not mine to do
> unilaterally. Confirm tenant + role and I will prepare it, or walk you
> through the team-invite screen.

---

## 9. Changelog — what this version resolved, corrected, or added

This is v3. Rather than silently overwrite v1/v2, here's exactly what moved:

**Resolved by your answers this turn:**
- Data residency (§2) — US church confirmed; `us-east-1` accepted
- AWS scope (§3) — no compliance driver; reframed from "build it" to "here's
  what it was actually buying, pick what's still worth it"
- Payments sequencing (§4, §5) — Stripe for Phase 1, i2c graduation scoped
  precisely, including the one finding that changes the advice: the i2c live
  adapter is a stub, so "flip a flag" is not what applying the sandbox means
- Marco's identity (§6) — AI agent with context, not a cold-start human hire;
  onboarding-time padding removed from Phase 1 sizing

**New findings from this pass, not in v1/v2:**
- The live i2c adapter (`api/_lib/i2c/live-adapter.ts`) throws on every method
  — TD-052, correctly cited (both source files mislabel it as TD-036)
- A real governance Work Order already exists for the i2c pilot transition
  ("GRACE Impact Card Pilot Readiness," `api/work-orders/_pilot-readiness.ts`)
  — use it rather than inventing a new checklist
- The Dependabot ignore block for Stripe majors is time-boxed and
  self-documenting; reactivation is mostly configuration, not new code
- Recommendation against merging the closed major Stripe SDK PRs during pilot
  ramp — real breaking-change risk on payment code, no reason to take it now

**Carried forward unchanged from v2** (still true, not re-litigated here):
- No staging environment exists (§7 Phase 1) — still the keystone blocker
- The RLS cross-tenant gate passes green while switched off (§7, F4) — still
  the single highest-value fix
- Security status docs disagree and drift (§7, F5)
- The 23 RLS-no-policy tables are largely by design, worth a one-pass intent
  review, not a mass policy-add
- VWS = Virtual Worship Solutions Inc. (the operating company), not a
  third-party client — see v2 for the full trace if this comes up again

**Still open, not answerable from the repository:**
- D3 — which church, how many users, what data, for the actual pilot
- Whether AWS-as-hub is worth keeping for sales positioning even without a
  compliance driver (§3)
- Your and David's review/approval cadence — the real constraint on how fast
  §7 actually moves, now that Marco's throughput isn't the bottleneck (§6)

---

*Every claim about code state — the i2c stub, the Stripe dormancy, the
Dependabot ignore reasoning, the Work Order contents, the TD-052/TD-036
mislabel, the git contributor list — was read directly from the repository on
2026-07-31, not recalled. Effort sizes remain judgement calls, and are the
least reliable numbers in this document.*
