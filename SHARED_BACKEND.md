# SHARED_BACKEND.md — GRACE WorkOS shared platform foundation

> Companion to `ARCHITECTURE.md` (which describes the pre-existing CRM) and
> `TECH_DEBT.md`/`DECISIONS.md` (updated alongside this document). This file
> describes the identity, authorization, consent, Work Order, approval,
> audit, and platform-event layer added in migrations `031`–`038` and
> `api/_lib/authz.ts`, `api/_lib/platformEvents.ts`, `api/_lib/workosAudit.ts`,
> `api/work-orders/*`, `api/approvals/*`, and `api/consents/*`.
>
> Scope discipline: this phase built the shared foundation both the Admin
> Dashboard and a future real Members Portal will stand on. It did **not**
> build a Work Order UI, a care-request API, or a real Members Portal — see
> "Known gaps" below for what is schema-only vs. API-and-schema.

---

## 1. Why this exists

The GRACE current-state assessment found the Admin Dashboard is a real
React/Supabase app while the "Members Portal" is a set of static HTML
prototypes with no real accounts, and that WorkOS-style agent workflows
(Work Orders, approvals, audit) had no backend model at all. Building
either the real Members Portal or WorkOS agents directly on top of the
existing schema would have meant inventing tenant-isolation, RBAC, and
audit conventions twice, in two different files, at two different times —
exactly the "triple fix" drift pattern the assessment already found once
(`GraceMemberPortal` vs. `grace-crm`).

This phase instead builds **one** shared foundation, reusing the existing
`churches`/`people`/`users` identity model (per `DECISIONS.md` ADR-002) and
extending it — never forking it — with the entities both frontends and the
agent layer need.

---

## 2. Entities added (migrations 031–038)

| Migration | Entities |
|---|---|
| `031_households_staff_identity.sql` | `households`, `household_members`, `staff_profiles`, `users.account_status`, `people.household_id` |
| `032_rbac_roles_permissions.sql` | `roles`, `permissions`, `role_permissions`, `user_roles`, `public.user_has_permission()`. Seeds all 13 roles + a ~33-row permission catalog + default grants. |
| `033_consent_communication_preferences.sql` | `consents`, `communication_preferences`, `data_subject_requests`, `public.get_person_id()` |
| `034_work_orders.sql` | `work_orders`, `work_order_tasks`, `work_order_dependencies`, `work_order_evidence` |
| `035_approvals_agent_platform.sql` | `approvals`, `agent_runs`, `agent_actions`, `validations` |
| `036_platform_events_notifications.sql` | `platform_events`, `notifications`; extends `audit_logs` with `source_app`, `reason`, `correlation_id` |
| `037_care_volunteer_artifacts_metrics.sql` | `care_requests`, `care_assignments`, `volunteer_interests`, `artifacts`, `metric_definitions` |
| `038_shared_foundation_rls_hardening.sql` | `public.get_app_user_id()`; permission-aware RLS on `work_orders` and `approvals` |

**Entities reused, not duplicated** (per the assessment's data-model map):

| Spec entity | Existing table |
|---|---|
| `organizations` | `churches` (ADR-002: keep `church_id`, don't rename) |
| `groups` | `small_groups` / `group_memberships` |
| `events` | `calendar_events` |
| `event_registrations` | `event_rsvps` |
| `campaigns` | `campaigns` |
| `audit_events` | `audit_logs` (extended, not replaced) |

`care_requests` is **new** and deliberately distinct from the pre-existing
`anchor_conversations` (AI leader-avatar chat, migrations 006/019) — one is
a structured intake/assignment record for WorkOS, the other is a
conversational thread. Both can reference the same person/category without
being merged.

---

## 3. Authorization model

**13 system roles** (church_id NULL = template, seeded once, available to
every tenant): System Administrator, Executive Leadership, Senior Pastor,
Ministry Leader, Pastoral Care, Member Services, Communications, Volunteer
Coordinator, Finance, Impact Card Operations, Analyst, Auditor, Member
Portal User.

**~33 permissions**, keyed `<module>.<action>` (e.g. `care.manage`,
`giving_financial.view`), each tagged with a `sensitivity` level (public /
internal / restricted / confidential). Default grants per role are seeded
in migration 032 — e.g. Finance holds `giving_financial.*` but not
`care.*`; Pastoral Care holds `care.*` but not `giving_financial.*`;
Auditor holds only `*.view` permissions, never a `manage`/`decide` grant;
Member Portal User holds only `consent.manage_own` and
`portal.self_service` — nothing else.

**Enforcement — two layers, primary + defense-in-depth:**

1. **Primary: `api/_lib/authz.ts`, every request.** `resolveStaffActor()`
   verifies the Clerk JWT, loads the matching `users` row, rejects a
   non-`active` `account_status` (403, even with a structurally valid
   token), then loads the caller's permission set from
   `user_roles → role_permissions → permissions` via the service-role
   client — so it doesn't depend on the Clerk↔Supabase RLS JWT wiring
   being complete (see TECH_DEBT.md TD-001). `requirePermission()` wraps
   this and 403s if the specific permission is missing. This is the
   control that matters — **never a hidden UI element.**
2. **Defense-in-depth: RLS (migration 038).** `work_orders` and
   `approvals` — the two highest-consequence new tables — also carry
   permission-aware RLS policies (`public.user_has_permission()`) so a bug
   in the API layer alone can't leak them to a caller with a valid
   `church_id` claim but no grant. This mirrors the existing app's own
   "RLS as second layer, not sole control" posture (`DECISIONS.md`
   ADR-003) and is **not** yet extended to every new table — see gaps.

Ministry-scoped and record-field-level scoping (`user_roles.ministry`,
`role_permissions.scope`) are modeled in the schema but only partially
enforced by application code today — see gaps.

---

## 4. Data boundaries — how each rule is actually enforced

| Rule | Mechanism |
|---|---|
| Members Portal accesses only its own member's data | `resolveMemberActor()` resolves `people.id` server-side from `people.clerk_user_id`; a client can never pass a different `person_id` for its own record. Confirmed by `api/_lib/authz.test.ts`. |
| Admin Dashboard accesses only what staff role allows | `requirePermission()` on every new route; RBAC seed grants in migration 032. Confirmed by `api/_lib/authz.test.ts`. |
| Pastoral notes not exposed to unrelated staff | `care.view`/`care.manage` granted only to Pastoral Care, Senior Pastor, System Administrator (migration 032). **API route for `care_requests` is not built in this phase** — schema + RLS (tenant + self) exist; the permission gate is proven at the `requirePermission()` mechanism level, not yet wired to a live care route. See gaps. |
| Financial data not exposed to care/communications users | Same mechanism: `giving_financial.*` is not in the Care or Communications grant lists. Proven at the mechanism level in tests; **existing Giving API routes predate this phase and do not yet call `requirePermission`** — see gaps. |
| Portal users never access internal Work Orders or staff notes | `member_portal_user` role has no `work_orders.*` grant (migration 032) + `work_orders`/`approvals` permission-aware RLS (migration 038) + the Members Portal has no code path to `/api/work-orders/*` today. |
| Agents receive only minimum required data | Agents never get a Supabase service-role key. They read `platform_events` (append-only, no PII beyond what a route explicitly puts in `payload`) and act via `agent_actions`, which require an `approvals` decision before `status` can become `executed` for any action flagged `requires_approval`. |
| Sensitive info not placed in broad logs | `recordAudit()`/`emitPlatformEvent()` write structured rows to dedicated, RLS-protected tables, not `console.log`; existing `maskSensitiveData()` convention (TECH_DEBT.md) is unchanged. |
| Service credentials stay server-side | All new routes use `SUPABASE_SERVICE_ROLE_KEY` server-side only, same pattern as every existing `api/care/*`/`api/billing/*` route. No new client-side secret exposure introduced. |

---

## 5. Work Orders

States: `draft → planning → awaiting_approval → in_progress → blocked/under_review → completed/cancelled`
(exact transition table in `api/work-orders/_index.ts` `ALLOWED_TRANSITIONS`,
unit-tested in `api/work-orders/statusTransitions.test.ts`). A Work Order
only reaches `awaiting_approval` via `POST /api/work-orders/request-approval`,
which atomically creates an `approvals` row and moves the Work Order —
there's no path to set that status directly through `PATCH`.

Deciding the linked approval (`PATCH /api/approvals?id=`) resolves the Work
Order back to `in_progress` (favorable decisions) or `planning`
(everything else), and emits `approval.decided` + writes an audit row in
the same call.

## 6. Platform events

`api/_lib/platformEvents.ts` is the **only** writer of `platform_events`.
Every event carries a `correlation_id` (shared with the matching
`audit_logs` row when one exists) so a Work Order's whole lifecycle —
create → approval request → decision → completion — can be traced as one
thread. This is the seam WorkOS agents read through instead of getting
direct table access to `people`/`care_requests`/`giving`.

---

## 7. Known gaps (explicitly out of scope this phase)

- **No care-request or volunteer-interest API routes yet.** Schema, RLS,
  and TypeScript contracts exist; `api/care/*` (built pre-existing, for
  Anchor) is not yet extended to also serve `care_requests`.
- **Existing Giving/Payments/Email/SMS routes don't call `requirePermission`
  yet.** They predate this phase and still use the older `requireAuth`/
  `requireRole` model (`api/_middleware/auth.ts`). Migrating them is the
  natural next step once a real UI needs the finer-grained roles.
- **Ministry-scoped and field-level permission narrowing is modeled, not
  enforced.** `user_roles.ministry` and `role_permissions.scope` columns
  exist; no route currently reads them to restrict a query to "this
  Ministry Leader's ministry only" or redact specific fields. `pickFields()`
  in `api/_lib/authz.ts` establishes the redaction pattern but is unused
  today.
- **Permission-aware RLS covers only `work_orders`/`approvals`.**
  `care_requests`, `giving`/financial tables, and communications tables
  still rely on tenant-only RLS + the API-layer permission check as the
  real control. Extending defense-in-depth RLS to those is a natural
  Phase 2 item, not urgent given the API layer is the primary control
  everywhere.
- **`data_subject_requests` has no fulfillment automation.** A member can
  submit an export/deactivation request; there is no automated export
  pipeline or account-deactivation workflow yet — resolving one is a
  manual operator process today (status field exists for that).
- **No custom (per-church) roles UI.** `roles.church_id` supports it, but
  nothing creates one yet — only the 13 system templates exist.
- **`account_status` is enforced only on the new WorkOS routes'
  `resolveStaffActor` path**, not on the legacy Express `requireAuth`
  middleware (`api/_middleware/auth.ts`) used by pre-existing routes.
  Applying it there uniformly is a follow-up (tracked in `TECH_DEBT.md`).
- **The two anonymous-caller cross-tenant RPC leaks flagged in the current-
  state assessment (`get_daily_digest_data`, `get_pending_messages`)
  remain unverified/unfixed** — out of scope for this phase, but still the
  single highest-priority item in the codebase; see `TECH_DEBT.md`.
- **Staging-gated integration tests are not run in this environment.**
  `tools/shared-foundation-smoke.test.ts` (new, alongside the pre-existing
  `tools/cross-tenant-smoke.test.ts`) proves tenant isolation and member
  self-access against a real database once `SUPABASE_TEST_*` env vars are
  set on staging; they currently skip (by design) in CI/local dev.

---

## 8. Environment variables

No new required env vars for local dev — the new routes reuse
`VITE_SUPABASE_URL`/`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and
`CLERK_SECRET_KEY`, all of which already exist in `.env.example`.

New **optional, staging-only** test variables (added to `.env.example`):

```
SUPABASE_TEST_TENANT_A_MEMBER_TOKEN=       # Clerk token for a portal member (not staff)
SUPABASE_TEST_TENANT_A_MEMBER_PERSON_ID=   # that member's people.id
```

---

## 9. Testing

All new tests run today with no external dependencies (`npm run test:run`):

- `api/_lib/authz.test.ts` — authentication, account-status enforcement,
  role/permission access (including restricted-care and
  restricted-financial denial cases), member self-access resolution.
- `api/_lib/platformEvents.test.ts` — portal event creation, correlation
  ID behavior, failure handling.
- `api/_lib/workosAudit.test.ts` — audit row creation, member-self-service
  (null `actor_user_id`) case, failure handling.
- `api/_lib/consentPreferences.test.ts` — consent → communication
  preference derivation (fail-closed on withdrawn/denied).
- `api/work-orders/statusTransitions.test.ts` — Work Order state machine
  + creation validation.
- `api/approvals/decisions.test.ts` — approval decision validation +
  Work-Order-resolution logic.
- `tools/shared-foundation-smoke.test.ts` — staging-gated real-RLS proof
  of tenant isolation and member self-access (skips without credentials,
  same convention as the pre-existing `tools/cross-tenant-smoke.test.ts`).

`npm run lint:rls` passes against all 38 migrations (every new table has
RLS enabled). `npm run lint` and `npx tsc --noEmit` are clean.
