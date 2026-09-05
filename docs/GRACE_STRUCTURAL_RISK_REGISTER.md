# GRACE Structural Risk Register

**Date:** 2026-08-31 · **Branch:** `feat/ai-work-cards` @ `981d8e8`

Severity is about **what breaks and how badly**, not about how incomplete
something is. Missing future capability is not a risk. Every entry cites
repository or live-database evidence.

| Sev | Count |
|---|---|
| CRITICAL | 0 |
| HIGH | 5 |
| MEDIUM | 7 |
| LOW | 4 |

---

## R-01 · Second Ask GRACE surface bypasses the entire intelligence stack
- **Layer:** model boundary / actions / memory · **Severity: HIGH** · **Likelihood: MEDIUM**
- **Description.** `src/components/redesign/RedesignAskGrace.tsx`, mounted at
  `#/redesign` (`App.tsx:601`, `View 'home'` → path `redesign`), is a live,
  authenticated, real-church-data assistant that predates ADR-014. It posts to
  `/api/ai/generate` (budget only, no moderation), keeps "memory" as a
  model-written rolling summary in `localStorage['grace-ai-memory-v1']` with no
  church or user scope and no provenance, defines its own action protocol
  (`add_event`, `log_interaction`, `add_prayer`, `check_in` — the last two of
  which are **not in `ACTION_CATALOG` at all**), and resolves people with a
  silent first-match-wins `resolvePerson` and **no ambiguity check whatsoever**.
- **Evidence.** `RedesignAskGrace.tsx:24-95` (own parser + executor + resolver),
  `:99-117` (localStorage memory), `:112,:164` (`/api/ai/generate`);
  `src/App.tsx:239,601`; `src/hooks/useHashRouter.ts` (`home: 'redesign'`).
- **Workshop impact:** low if nobody navigates there. **Pilot: HIGH** — every
  ADR-014→018 guarantee is void on this surface, including the Prompt 10A
  ambiguity closure, on a roster with 2 Sarahs and 3 Marcuses.
  **Production: HIGH.** **Security/privacy: MEDIUM** (wrong-person prayer/note
  attachment; unscoped local memory of pastoral content).
- **Timing:** decide before pilot — retire the surface, or bring it under the
  catalog. Do not leave two assistants with opposite rules.
- **To close:** either delete the route, or a fixture proving this surface
  refuses an ambiguous target and dispatches only catalog actions.

## R-02 · The epistemic decision layer never executes
- **Layer:** epistemics · **Severity: HIGH** · **Likelihood: HIGH (certain)**
- **Description.** ADR-018 names `resolveActionReadiness` "the single function
  that decides whether ACT is reachable at all." It has **zero production call
  sites**. So do `resolvePrecedence`, `modeForEvidenceState`,
  `safeExplanationFor`, and (transitively) `resolveActionCapability`. The only
  epistemic code in the request path is `buildEpistemicContext`, which emits
  instructions, and `detectNameCollisions`, which feeds them. The precedence
  order — including *"PROHIBITED outranks every other evidence state"* — exists
  as a tested pure function that nothing calls.
- **Evidence.** Exhaustive grep across `api/`, `src/`, `tools/`: every hit is a
  `.test.ts` or an eval-harness case. `api/grace/_chat.ts:33` imports only
  `fetchPeopleForCollisionCheck`, `detectNameCollisions`, `buildEpistemicContext`.
- **Impact.** Workshop: **MEDIUM** — the demo depends on model compliance, which
  is high but not guaranteed; a single non-compliant reply undoes the story.
  Pilot: **HIGH.** Production: **HIGH.** Security: **MEDIUM** — this is the
  clearest paper-safety finding in the system.
- **Timing:** before pilot. **To close:** one production call site that can
  actually refuse — most naturally in the action path, where a readiness result
  gates whether an `<action>` block is offered at all.

## R-03 · The whole stack is branch-only; production has no Ask GRACE
- **Layer:** deployment · **Severity: HIGH** · **Likelihood: HIGH (certain)**
- **Evidence.** `git cat-file -e main:api/grace/_chat.ts` → absent; `'grace/chat'`
  not in `main`'s `api/[...path].ts`; `api/_lib/grace-{memory,knowledge,capability,epistemic}.ts`,
  `capability-manifest.ts`, `src/lib/actionCatalog.ts`, and migrations 075/076
  all absent from `main`. Migrations 075/076 **are** applied to the live
  Supabase project, so the database is ahead of `main` while the code is behind
  the branch.
- **Impact.** Workshop: **MEDIUM** — demonstrable from a Preview, but that must
  be stated plainly rather than shown as "the product." Pilot: **HIGH.**
  Production: **HIGH.** Security: low.
- **Timing:** before pilot, as an explicit release decision (ADR-017's
  `runtimeAvailable` flag is the hook and currently reads `true` for all 8
  entries — which is false of production).
- **To close:** a merge + deploy, then re-run the exam against the deployed build.

## R-04 · `dataContext` is the entire system prompt, composed by the client
- **Layer:** model boundary · **Severity: HIGH** · **Likelihood: LOW**
- **Description.** TD-062 describes this as "the church-data context." It is
  more: `buildDataContext` composes the persona (`buildAdminPersonaHeader`),
  the tone rules, the `ACTIONS —` instruction block, **the rendered action
  catalog** (`buildChatActionPrompt()`), and the church data — and the server
  appends it *first*, ahead of every server-composed block, up to 40 000
  characters, with no validation beyond a length cap.
- **Evidence.** `GraceChatContext.tsx:63-200`; `api/grace/_chat.ts:53-56, 196`.
- **Impact.** Workshop: none. Pilot: **MEDIUM.** Production: **HIGH.**
  Security: **HIGH in principle, MEDIUM in practice** — an attacker needs an
  authenticated staff session; RLS + `requirePermission` still bound every real
  read and write. But a poisoned `dataContext` can rewrite the persona, suppress
  the guardrail footer's effect by contradiction, and drive the extraction pass
  into writing chosen memories.
- **Timing:** see TD-062 classification in the checkpoint — **ACCEPTABLE FOR
  WORKSHOP, MUST FIX BEFORE PILOT**.
- **To close:** port `buildDataContext` server-side per
  `api/_lib/ai/assistant-runtime.ts`'s pattern; at minimum move the persona and
  the action-catalog prompt server-side, which is a much smaller diff than
  porting the data aggregation.

## R-05 · Ask GRACE has no moderation at all
- **Layer:** model boundary · **Severity: HIGH** · **Likelihood: MEDIUM**
- **Description.** `api/grace/_chat.ts:214` calls `generateStreamed` with neither
  `moderateInput` nor `moderateOutput`. ADR-014 states the route "finally goes
  through the gateway (budget, moderation, usage)". Budget and usage: yes.
  Moderation: never invoked — not even the post-hoc log-only output pass the ADR
  describes as a "known, accepted gap."
- **Evidence.** `gateway.ts:216` (`if (req.moderateInput)`), `:250`
  (`if (req.moderateOutput …)`); `_chat.ts:214-218` passes neither.
- **Impact.** Workshop: LOW. Pilot: **HIGH** — this is a pastoral-care product;
  crisis/self-harm language in a staff chat has no gateway path at all.
  Production: HIGH. Security/privacy: MEDIUM.
- **Timing:** before pilot. **To close:** pass `moderateInput: message` (and
  `moderateOutput: true` for the log-only pass), plus a test.

## R-06 · Nine of fourteen chat actions never reach a server permission check
- **Layer:** actions · **Severity: MEDIUM** · **Likelihood: HIGH**
- **Description.** `add_person`, `add_task`, `add_prayer`, `add_note`,
  `add_event`, `mark_task_done`, `update_task`, `update_person_status`,
  `mark_prayer_answered` dispatch through React callbacks to the browser
  Supabase client. No catalog permission check, no `audit_logs` row. This is
  TD-061's honest residual, pinned by `actionCatalogBinding.test.ts` and the
  catalog's own `audited: false`.
- **Impact.** Workshop: LOW (do not demo these as governed). Pilot: **MEDIUM** —
  the accountability claim GRACE is positioned on is true of 4 actions, not 14.
  Production: MEDIUM. Security: LOW (RLS still scopes the writes).
- **Timing:** post-workshop; a product decision per action type.

## R-07 · `send_email`'s enforced permission is weaker than its advertised one
- **Layer:** actions / capability · **Severity: MEDIUM** · **Likelihood: MEDIUM**
- **Description.** Catalog and manifest say `communications.send`;
  `api/agentmail/_send.ts:13,27` and `_reply.ts:27` check
  `allowedRoles: ['admin','pastor','staff']`. A staff member without
  `communications.send` is told by the capability block that they are not
  authorized — and can send anyway.
- **Impact.** Workshop: LOW (avoid demoing email). Pilot: **MEDIUM/HIGH** — an
  external, unrecallable action whose gate is not the gate GRACE describes.
  Production: MEDIUM. Security: MEDIUM.
- **Timing:** before pilot. **To close:** switch both routes to
  `requirePermission(findAction('send_email').permission)`, after confirming
  the RBAC key is actually granted to the roles that need it — which is exactly
  why this was **not** changed during this audit.

## R-08 · Memory has no correction or supersede mechanism
- **Layer:** memory · **Severity: MEDIUM** · **Likelihood: HIGH**
- **Description.** `grace_memories.status` is written `'active'` and never
  transitions. `saveMemory` dedupes only on exact normalized text, so
  "meeting is Wednesday now" becomes a *second* row alongside "meeting is
  Monday"; both are injected and the model is asked, in prose, to prefer the
  newer date. ADR-018 defines a `MEMORY_SUPERSEDED` reason code with no producer.
- **Evidence.** `grace-memory.ts:99-127, 214-232`; `grace-epistemic.ts:44,212`.
- **Impact.** Workshop: **MEDIUM** — a correction during a live demo is a
  plausible, ordinary thing for a pastor to do, and it degrades to
  "two conflicting notes, model picks." Pilot: MEDIUM. Production: MEDIUM.
- **Timing:** before pilot, or accept and script around it at the workshop.

## R-09 · Both live-model demo legs are the only live evidence; the other two have none
- **Layer:** qualification · **Severity: MEDIUM** · **Likelihood: HIGH (certain)**
- **Evidence (live DB).** `grace_memories`: **0 rows**. `agent_actions`: no
  chat-originated row of any type. `audit_logs`: no `delete/task`,
  `delete/prayer_request`, `delete/person`, or chat-origin send. Against 48
  `ask-grace` and 5 `grace-memory-extract` `token_usage` rows.
- **Impact.** Workshop: **HIGH** — demo legs 3 (memory) and 4 (authority) have
  never been performed end to end on real data, and leg 3 currently has no
  prior-session fact to recall. Pilot: MEDIUM. Production: LOW.
- **Timing:** **before the workshop.** This is a rehearsal task, not an
  engineering task.

## R-10 · Two ambiguity detectors, over two rosters, and only the weaker enforces
- **Layer:** epistemics → actions seam · **Severity: MEDIUM** · **Likelihood: LOW**
- **Description.** `detectNameCollisions` runs server-side over the **full**
  `people` table and produces the prompt's collision list.
  `countPersonMatches` runs client-side over `data.people` — whatever the tab
  has loaded — and produces the `personAmbiguous` flag that `blockOnAmbiguity`
  actually enforces. Different inputs, and only the client-side one blocks.
  A collision the server warns about can be missed by the client, and vice
  versa. ADR-018 explicitly rejected a client-composed ambiguity signal for
  exactly this reason — then the enforcement half stayed on the client anyway.
- **Impact.** Workshop: LOW. Pilot: MEDIUM. Production: MEDIUM. Security: MEDIUM.
- **To close:** either resolve the target server-side, or prove the client
  roster is always complete for the church.

## R-11 · The epistemic block publishes the roster's colliding names every turn
- **Layer:** epistemics · **Severity: MEDIUM** · **Likelihood: HIGH (certain)**
- **Description.** `buildEpistemicContext` lists every colliding first name and
  the **full names of all its matches**, unconditionally, regardless of what was
  asked. On Central Henderson that is 9 groups / ~19 full names in every prompt.
  It also issues an unbounded `SELECT id, first_name, last_name FROM people` per
  turn (60 rows today; unbounded by design).
- **Impact.** Privacy: LOW-MEDIUM (names only, to an already-authorized staff
  actor, but sent to the model on every turn including turns with no person in
  them). Performance: MEDIUM at scale.
- **Timing:** post-workshop.

## R-12 · Domain 3's group-activity data is hardcoded demo content, in production
- **Layer:** church truth · **Severity: MEDIUM** · **Likelihood: HIGH (certain)**
- **Evidence.** `GraceChatContext.tsx:128` calls `getDemoCommunityDataForCRM()`
  with zero arguments; the function takes none, so it cannot vary by church. A
  real per-church path (`fetchCommunityPosts(churchId, …)`) exists and is unused.
  Proven as `min-know-group-activity-is-demo-data` (architectural finding).
- **Impact.** Workshop: **MEDIUM — do not ask GRACE about group activity in
  front of Central.** Pilot: MEDIUM. Production: MEDIUM (it is fabricated
  content presented as church data).
- **Timing:** before pilot; trivially fixable but out of this checkpoint's scope.

## R-13 · `hydrateAction` honours a model-supplied entity id without an ambiguity check
- **Layer:** actions · **Severity: LOW** · **Likelihood: LOW**
- **Description.** `validateAction` accepts `personId`/`taskId`/`prayerId` as
  plain strings. `hydrateAction` only runs `countTaskMatches`/`countPrayerMatches`
  when the id is absent, and falls back to `action.personId` when no name
  matched. A model that emits an id skips ambiguity resolution entirely.
- **Mitigations.** Ids must exist and be church-visible for any write to
  succeed; `delete_person`/`send_sms` still require approval. The model has no
  source of valid ids other than the prompt.
- **Timing:** note only.

## R-14 · Extraction prompt is string-interpolated with user text
- **Layer:** memory · **Severity: LOW** · **Likelihood: LOW**
- **Description.** `EXTRACTION_PROMPT.replace('%USER%', …)` escapes only double
  quotes. A staff user can steer their **own** memory writes. Scope is
  `church_id + user_id`; no cross-user or cross-tenant reach.
- **Timing:** note only.

## R-15 · `isCapabilityMetaQuestion` is documented as live and is not called
- **Layer:** capability · **Severity: LOW** · **Likelihood: HIGH (certain)**
- **Description.** ADR-017 states the classifier "only adds emphasis" to the
  prompt. No production call site exists, so no emphasis is ever added. The
  safety argument (the block is unconditional) still holds — this is doc drift,
  not a hole.
- **Timing:** documentation fix.

## R-16 · Fixture #003's stated proof boundary rests on a fact that is no longer true
- **Layer:** test architecture · **Severity: LOW** · **Likelihood: HIGH (certain)**
- **Description.** `fixture-003-people-households.cases.ts:12,63,72` says
  `buildDataContext` "is not exported" and therefore unverifiable. It **has been
  exported** since TD-066, and four other fixtures import it directly. The
  fixture understates its own achievable boundary and records a false reason.
- **Timing:** housekeeping; correct when Fixture #003 is next touched.

---

## Findings added by the live-tenant rehearsal (2026-08-31)

## R-17 · GRACE turns a memory's *creation date* into the event's date, and states it as fact — **FIXED & RE-VERIFIED 2026-08-31**
- **Layer:** memory → model · **Severity: HIGH (was)** · **Likelihood: was HIGH (reproduced 2/2 live runs); now 0/4**
- **Description.** `buildMemoryBlock` prefixes every memory with its `created_at`
  (`- [Aug 31, you said] my check-in with Bill is Thursday at 2pm`). Asked
  *"When is my check-in with Bill?"* in a **new conversation**, GRACE replied —
  twice, verbatim in structure:
  > *"Thursday at 2pm — you told me that's scheduled for today (Aug 31), so that's coming up in a few hours."*
  **2026-08-31 is a Monday.** The next Thursday is 2026-09-03. GRACE recalled the
  memory correctly and attributed it correctly, then **fabricated a concrete date
  and a time-until claim** from the label that records when the note was *taken*.
- **Evidence.** Both replies were persisted to `grace_messages` on the live
  tenant and read back before cleanup. Root cause: the prompt gives the model no
  way to distinguish "when this was said" from "when this happens", and nothing
  in the stack resolves a weekday word to a date.
- **Why it matters most.** This is precisely the failure ADR-018 and
  `docs/AI_BOUNDARIES.md` say cannot happen — *"an inference or guess must be
  labeled as such… never phrased as a settled fact."* It is the first live test
  of that contract, and the contract lost. It is empirical proof of **R-02**
  (the epistemic layer is prompt-only) and **C-10**.
- **Workshop impact: HIGH — this is demo leg 3.** A pastor watching GRACE
  confidently misdate their own meeting is the single worst thing that could
  happen in that leg. **Pilot: HIGH. Production: HIGH. Safety: HIGH** (a
  pastoral-care product asserting wrong dates about commitments).
- **Timing: before the workshop.** Two bounded options: (a) relabel the memory
  block so the date reads as provenance, not content
  (`[noted Aug 31]` / `you told me on Aug 31`), and/or (b) state today's weekday
  in the prompt (`Today: Monday, Aug 31 2026`) — `buildDataContext` currently
  emits `Today: 8/31/2026` with no weekday, so the model cannot check itself.
  Option (b) is a one-line change in `buildDataContext`.
- **RESOLVED.** Two bounded changes, no new capability, no baseline change:
  1. `src/contexts/GraceChatContext.tsx` — the `Today:` anchor now carries the
     weekday (`Monday, August 31, 2026`, was `8/31/2026`), so the model has a
     true reference point instead of none.
  2. `api/_lib/grace-memory.ts` — `buildMemoryBlock` renders each note as
     `- [you said on Mon Aug 31] …` instead of `- [Aug 31, you said] …`, so the
     date can only read as provenance, and the block header now states
     explicitly that the bracket date is when the note was taken, never the
     date of anything inside it, and that a weekday with no derivable calendar
     date must be given as the weekday alone. The substrings `you said` and
     `noted from chat` are preserved verbatim — the qualification suite and the
     Pilot Capability Manifest both assert them.
- **Re-verified live, 4 samples, 0 recurrences:**
  *"Thursday at 2pm — you told me that's coming up."* /
  *"…that was set for this week."* / *"…that's scheduled for this week."*
  Correct weekday, correct attribution, **no invented calendar date, never
  "today"**. Full suite 1590 passed / 0 failed; eval harness 35 PASS / 0 FAIL;
  Central Henderson exam 22 PASS / 0 FAIL; no baseline or manifest drift.
- **Residual (LOW, accepted):** GRACE still volunteers a mild relative-time
  claim ("this week"). On these runs it was *correct* — the note was taken
  Monday and Thursday fell in the same week — but it is an unhedged inference,
  not a stated fact from the note. Ideal would be a bare "Thursday at 2pm".
  Watch it; do not chase it before the workshop.

## R-18 · An approved deletion is written to the audit trail as an `update`
- **Layer:** actions → audit · **Severity: MEDIUM** · **Likelihood: HIGH (certain)**
- **Description.** `api/approvals/_index.ts:331` hardcodes `action: 'update'` on
  the mutation audit row for every approved agent action. That was correct when
  `assign_work_order_owner` was the only executor. Now `delete_person` routes
  through the same path, so an approved person deletion is filed as an `update`.
  `api/actions/execute` gets this right (`action: 'delete'`).
- **Evidence (live).** The rehearsal's approved `delete_person` produced
  `audit_logs` row `c77c71ff…`: `action='update'`, `entity_type='person'`,
  `reason='Agent proposal approved'`, with a correct `before` snapshot and
  `after: null`.
- **Impact.** The information is recoverable (`after` is null), but an auditor
  querying `audit_logs where action='delete'` **will not find approved
  deletions** — and that query is the whole point of the trail. Workshop: LOW.
  Pilot: **MEDIUM.** Production: MEDIUM. Security/privacy: MEDIUM (SOC 2
  evidence-gathering, "who deleted this record?").
- **Status: CLOSED 2026-09-04.** `auditActionFor(mutation)` in
  `api/_lib/agentActionExecutors.ts` derives the verb from the mutation's own
  snapshots (`after === null` → delete, `before === null` → create, else
  update) and BOTH routes use it — the approvals path had hardcoded `'update'`
  and `/api/actions/execute` had hardcoded `'delete'`, each right for the one
  executor it was written around. Unit-tested on the helper, route-tested on
  an approved `delete_person` (`action='delete'`, `entity_type='person'`,
  `after: null`), and re-rehearsed live: the approved deletion now files as a
  `delete` under the approver's id.

## R-19 · Extraction duplicates a fact the deterministic path already stored — **still open, no longer carries a wrong date**
- **Layer:** memory · **Severity: LOW** · **Likelihood: HIGH (observed live)**
- **Description.** After the explicit `remember that…` write, the *next* turn's
  `runExtraction` pass extracted the same fact again from GRACE's own reply and
  wrote a second row: `user_stated: "my check-in with Bill Hoffman is Thursday
  at 2pm"` and `ai_extracted: "check-in with Bill scheduled for Thursday at 2pm
  (Aug 31)"`. The extraction prompt says *"Do NOT extract… questions the user
  asked"*; the user only asked a question, and the fact was lifted from `%REPLY%`.
- **Impact.** Both rows are injected on every later turn. With no supersede
  mechanism (**R-08**) duplicates accumulate without any correction being made —
  and the AI-extracted copy carried the wrong date into its own content, baking
  R-17's error into storage.
- **Post-fix (2026-08-31):** the duplicate still appears intermittently — 2 of
  4 sampled runs — but it no longer carries a fabricated date; the extracted
  copy now reads *"…Thursday at 2pm this week"* rather than *"(Aug 31)"*. So
  R-17's fix removed the harmful half and left the tidiness half.
- **Timing:** post-workshop. Harmless for the demo; it compounds R-08 over time.

## R-20 · Fixture #003 breaks on a pure refactor — a false negative, and it gates CI — **RESOLVED BY ANOTHER SESSION**
- **Layer:** test architecture · **Severity: was MEDIUM (CI-blocking)** · **Likelihood: was HIGH**
- **Update (2026-08-31, same day):** fixed concurrently by whoever owns the
  mobile-shell refactor — the case now matches the `const graceChatProps = {…}`
  literal plus `<GraceChatProvider {...graceChatProps}>`. CI is green again.
  **The underlying weakness stands:** the case still asserts a source-code
  spelling rather than the contract, and still records the stale reason
  *"buildDataContext is not exported"* (**C-12**). The next refactor of that
  wiring will break it again.
- **Description.** `ph-know-datacontext-wiring`
  (`fixture-003-people-households.cases.ts:67-75`) regex-matches the literal JSX
  string `<GraceChatProvider …>` and requires the substrings `people={people}`,
  `tasks={tasks}`, `prayers={prayers}`, `attendance=`. An in-flight refactor in
  the working tree (uncommitted, part of the GRACE Mobile shell work) hoisted
  those into a shared `graceChatProps` object spread into both mount sites
  (`src/App.tsx:546, 610, 696`). **The data path is unchanged — arguably
  improved** (desktop and mobile now provably mount identical props) — but the
  case now reports FAIL.
- **Evidence.** `npx vitest run tools/eval-harness/fixtures/fixture-003-people-households.cases.test.ts`
  → `GraceChatProvider wiring missing expected prop(s): people={people}; …`,
  while `graceChatProps` demonstrably contains all four.
- **Impact.** The eval-harness job gates `build` in `.github/workflows/ci.yml`,
  so **this will fail CI on push**. More importantly it is a live instance of
  test-architecture weakness #7 (*coupled to implementation details rather than
  contracts*): the case asserts a JSX spelling, not a behaviour, and its own
  recorded reason for that boundary — *"buildDataContext is not exported"* — has
  been false since TD-066 (**C-12**).
- **To close:** resolve the props object before matching, or — better, and now
  possible — assert the contract directly by calling the exported
  `buildDataContext` with known data and checking the composed string, which is
  what four other fixtures already do.
- **Not fixed here:** it belongs to whoever owns the in-flight mobile refactor,
  and the right fix is a proof-boundary decision, not a regex tweak.
## R-21 · A weekday-only memory gets a wrong calendar date pinned to it — **FIXED & RE-VERIFIED 2026-09-05 (15 live samples, 0 wrong dates)**
- **Layer:** memory → model · **Severity: MEDIUM** · **Likelihood: HIGH for
  weekday-only notes (observed 2/2 on 2026-09-05)**
- **Description.** R-17 fixed the note-date confusion (the bracketed date is
  named as provenance now). What remains: a memory that names only a weekday —
  *"check-in with Bill is Thursday at 2pm"* — is recalled with a calendar date
  the model invents. Recorded on Friday 2026-09-04 (local), asked in a fresh
  conversation: *"Thursday at 2pm — that's today, September 4th."* The prompt
  said `Today: Friday, September 4, 2026`; September 4 is a Friday. Reproduced
  on the next run.
- **Evidence (live).** `tools/eval-harness/.output/live-rehearsal.json`, leg
  3b, 2026-09-05 02:xx UTC, both runs.
- **Why the harness had not caught it.** The 3b assertion checked for the word
  "thursday" and nothing else. It now checks every calendar date the reply
  pins against the memory's weekday and refuses "today" on a non-Thursday
  (`live-rehearsal/dateClaims.ts`, provenance dates excluded by design), so
  **leg 3b is red until this is fixed** — correctly.
- **Impact.** Workshop: **LOW** — the seeded workshop memory carries an
  explicit date ("Thursday, September 10th") and recalls exactly; the rule for
  the day is that any "remember that…" said live must include the date.
  Pilot: MEDIUM — staff say "Thursday" far more often than "September 10th".
- **Fix (same day).** Telling the model not to compute a date was already in
  the header and was not enough, so the server computes it.
  `weekdayOnlyHint` (`api/_lib/grace-memory.ts`) appends to any weekday-only
  memory line the next occurrence of that weekday after the note was taken —
  *"(weekday only — the next Thursday after this note is Thu, Sep 10; if you
  give a date, give exactly that one)"* — or, when the note was written on
  that very weekday, both candidates with an instruction to say it is
  unclear. The header now says to use exactly that date and never call it
  "today" unless today's date is literally that date. The client sends its
  IANA zone with each turn (`timeZone`, shape-checked in the route) so the
  weekday is read on the church's calendar, not UTC's — a note taken at 6pm
  Pacific on a Thursday is already Friday in UTC and would otherwise be
  pushed a week out. Stored content is untouched; the anchor lives only in
  the prompt.
- **Verification (live, local handler with the fix, real Claude, demo
  account, all artefacts removed afterwards).** 15 fresh-conversation recalls
  of *"…check-in with Bill Hoffman is Thursday at 2pm"* noted on Friday
  2026-09-04: 14 × *"Thursday at 2pm — that's September 10th"* (a Thursday),
  1 × *"Thursday at 2pm. You told me that on Friday (today)"* (weekday plus
  provenance, no date pinned). **0 wrong dates.** Harness leg 3b, red since
  #208, is green again on the same rule — nothing in the assertion was
  loosened; the judge learned only that a provenance "today" inside a
  telling-clause is not an event claim.

