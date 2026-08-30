<!--
This template exists because PILOT_READINESS.md calls out that GRACE has
no general release checklist. It doesn't replace the Security Gate
(SECURITY_GATE.md) or the Shipping Principle (AGENTS.md) — it's the place
those land per-PR: a migration summary and verification checklist, and an
explicit release-owner sign-off, so a passing build is never mistaken for
"reviewed and ready."
-->

## Summary

<!-- What changed and why. -->

## Migrations

<!-- Delete this section if this PR has no supabase/migrations/ changes. -->

- [ ] Every new migration numbered above the rollback-lint baseline documents its rollback (enforced by CI's `rollback-lint` job — see `tools/lint-rollback.ts`).
- [ ] Applied to the live Supabase project and verified (per RUNBOOK.md — there is no staging; see PILOT_READINESS.md F1). Note how you verified it (dry-run, direct query, etc.):

## Verification

<!-- What you actually ran, not just "tests pass" — the Security Gate already
     enforces the automated checks. This is for anything a green CI run
     can't tell a reviewer: manual QA, which tenant you tested against,
     what a live deploy looked like. -->

- [ ] `npm run typecheck && npm run lint && npx vitest run && npm run build` all pass locally
- [ ] Manually verified (describe what, and against which tenant — never a live client's data for anything exploratory):

## Rollback

<!-- Beyond the migration's own inverse SQL: what does reverting THIS PR
     look like — revert the commit, roll back the Vercel deployment, both? -->

## Release owner

<!-- Who is accountable for this shipping and for watching it after merge.
     AGENTS.md: do not merge, deploy, delete, reset, or force-push without
     explicit approval. -->
