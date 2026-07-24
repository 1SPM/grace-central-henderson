# Security Gate — PR & Production Deployment

Every pull request to `main` runs the checks below; `main` is protected so a
red required-check cannot merge, and (because Vercel deploys from `main`) cannot
reach production. Constraints: the gate never auto-upgrades major dependencies
and never reformats code.

## Checks

| Check | Workflow / job | Tooling |
|---|---|---|
| Secret scanning | `gitleaks` | gitleaks-action |
| Dependency vulnerabilities | `audit` | `npm audit --omit=dev --audit-level=high` |
| Static analysis (SAST) | `codeql.yml` | GitHub CodeQL `security-extended` |
| Type checking | `lint-and-typecheck` | `tsc --noEmit` |
| Linting | `lint-and-typecheck` | `npm run lint` |
| Unit tests (incl. authorization tests) | `test` | vitest (`test:run`) |
| RLS policy tests | `rls-policy-tests` | cross-tenant / escalation / read-restriction / entitlement smokes |
| RLS lint (migrations enable RLS) | `rls-lint` | `tools/lint-rls.ts` |
| Build validation | `build` | `npm run build` |
| Service-role usage in frontend | `frontend-safety` | `tools/check-frontend-safety.ts` |
| Public-prefix secret exposure | `frontend-safety` | `tools/check-frontend-safety.ts` |

## Finding policy

**🔴 Blocks the PR and production deploy**
- Any gitleaks hit
- Type error, lint error, failing unit/authorization test, build failure
- RLS-lint failure (a new table without RLS enabled)
- `frontend-safety` finding — a service-role key read in `src/`, or a
  `VITE_`/`NEXT_PUBLIC_`-prefixed name that looks secret
- CodeQL **high/critical**
- Dependency vulnerability **high/critical** (prod deps)

**⚠️ Warning (does not block)**
- CodeQL medium/low
- Dependency vulnerability **moderate** (tracked in `TECH_DEBT.md`)
- RLS policy tests **skipped** because `SUPABASE_TEST_*` secrets are not set —
  they pass green while unconfigured and become a hard 🔴 gate once the staging
  test-user tokens are added (closes TD-001 / TD-002)

**📝 Requires documented acceptance**
- A dependency vulnerability with no fix available → add to an allowlist with a
  reason and a review date (time-boxed); revisit at expiry
- A CodeQL finding triaged as a false positive → dismiss it in the Security tab
  **with a written justification**; the dismissal is the record
- Any exception is time-boxed and recorded — never silent

## Enabling the RLS policy gate
Add repository secrets `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`,
`SUPABASE_TEST_TENANT_A_ID`, `SUPABASE_TEST_TENANT_A_TOKEN`,
`SUPABASE_TEST_TENANT_A_MEMBER_TOKEN`, `SUPABASE_TEST_TENANT_B_ID`,
`SUPABASE_TEST_TENANT_B_TOKEN` (Clerk-issued JWTs for **staging** test users).
The `rls-policy-tests` job then runs the suites for real on every PR.
