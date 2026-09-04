# GRACE Evidence Package — Pre-Workshop (Internal)

**What VWS can credibly claim before the Central Henderson workshop**, from
the Capability Baseline and the Central Henderson Qualification Exam as of
2026-08-31 (exam: 22 PASS / 0 FAIL / 8 NOT_RUN; smoke suite 129/129; zero
safety-critical failures). Nothing below is inflated because a demo worked
once — every claim cites its qualification mechanism. Live-judgment
results remain advisory and never upgrade a claim.

## Proven today

**What GRACE knows** (deterministic, exam-backed):
- Central Henderson identity, mission, vision, four-part strategy,
  ownership path — from the approved seed, source-attributed.
- Live operational data: people counts/status, giving MTD + rolling-30d
  totals (correctly distinguished), top donors, open tasks, upcoming
  events (privacy-excluded), active non-private prayer content (full text).
- The scope boundaries themselves, injected unconditionally.

**What GRACE remembers** (Memory V1, ADR-014, acceptance-tested):
- Staff-told facts across sessions, per-user, church-scoped, labeled as
  staff notes, always subordinate to live records.

**What GRACE safely refuses** (safety-critical cases, all passing):
- Henderson-specific financial/attendance figures (no authorized source —
  no substitution from consolidated data or general knowledge).
- Campaign/pledge/fund specifics (no data exists to leak).
- Staffing-capacity claims; private prayers and private events never reach
  the model at all.
- Prompt-injection phrasing and cross-tenant probes (retrieval is
  server-resolved, message text cannot steer it).
- Since 2026-08-31: inactivity/engagement claims without real attendance
  data behind them (regression-tested).

**Authority/action behavior** (Fixture #002 + exam ACT cases):
- Unauthenticated refusal; client-supplied identity/permission claims
  ignored; unknown actions rejected; natural-language pressure cannot
  bypass gates; `delete_person`/`send_sms` always route to approval;
  provenance recorded on every action; tenant scope server-resolved.

## Partial today (visible but incomplete)

- Pastoral care KNOW: prayer content reaches the prompt, but without
  dates — staleness invisible (pilot-critical wiring candidate).
- Staff work KNOW: task titles + a deterministic overdue path, but no
  assignee/priority in the general prompt; zero Decision Queue visibility.
- Giving KNOW: real totals, but the persona's campaign/pledge vocabulary
  exceeds available data (pilot-critical persona-narrowing candidate).
- Sunday/worship KNOW: static service times only.
- Governance KNOW: policy text and app-layer checks proven; live-DB RLS
  enforcement is explicitly outside the harness's proof boundary.

## Not yet proven (what the workshop helps resolve)

- Everything gated on a Central decision or source: Henderson-specific
  financials/attendance, campaign/fund data existence, group-activity
  tracking, consent-visibility wiring priority, care/giving authority
  boundaries, household exposure appetite.
- All CONNECT cells: sampled advisory-only (live-judgment tier); no
  CONNECT claim is made to Central.

## Future (explicitly outside pilot scope)

- ANTICIPATE (any domain) — no mechanism exists.
- General certainty/hedging and clarifying-question contracts.
- WorkOS/Decision Queue chat visibility; households in chat;
  Sunday/worship data pipelines; member-facing GRACE; autonomous agents.

## One known deployment caveat (internal)

Production does not yet carry Memory V1/church-knowledge (branch not
promoted; production chat route 404s). All claims above hold on the branch
Preview — the workshop environment. Promotion timing is a Decision Log
item, not an evidence gap.
