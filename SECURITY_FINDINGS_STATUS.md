# Security Findings Status (Critical)

Last updated: 2026-02-23

This document resolves or formally waives each **critical** finding from `SECURITY_AUDIT_REPORT.md` with an owner and supporting evidence.

## 1) Client-side storage of secret API keys (CRITICAL)

- **Status:** Resolved
- **Owner:** Platform Security (App)
- **Evidence:**
  - `src/hooks/useChurchSettings.ts` stores only non-secret integration config in frontend state (`emailFromAddress`, `emailFromName`, `twilioPhoneNumber`, `stripePublishableKey`, `clerkPublishableKey`).
  - `src/contexts/IntegrationsContext.tsx` configures frontend services from non-secret values only; SMS/Email are routed via backend APIs and payments use publishable keys in frontend.
- **Notes:** Secret values (Stripe secret key, Twilio auth token, Resend API key) must remain in backend environment variables and never appear in client payloads.

## 2) XSS via printable report rendering (CRITICAL)

- **Status:** Resolved
- **Owner:** Frontend Security (UI)
- **Evidence:**
  - `src/components/printing.ts` sanitizes HTML with `sanitizeHtml` before generating printable document output.
  - `src/components/PrintableReports.tsx` uses `buildPrintableDocument(printContent.innerHTML)` in print flow.
  - `src/security/smoke.test.ts` verifies script tags and inline handlers are removed from printable output.

## 3) Demo mode authentication bypass (CRITICAL)

- **Status:** Resolved (with controlled risk waiver for non-production demo behavior)
- **Owner:** Auth Platform
- **Evidence:**
  - `src/contexts/authMode.ts` enforces fail-closed behavior in production when Clerk key is missing and demo mode is not enabled.
  - `src/contexts/AuthContext.tsx` uses resolver output and routes blocked mode to `AuthProviderSecurityBlock` (signed-out, no permissions).
  - `src/security/smoke.test.ts` covers the fail-closed production path.
- **Formal waiver:** Demo auth remains available for development and explicitly opt-in environments (`VITE_ENABLE_DEMO_MODE=true`). This is accepted for local/dev workflows only and is not allowed for production rollout.

## CI Security Smoke Coverage

- CI now runs `src/security/smoke.test.ts` to enforce baseline checks for:
  - auth fail-closed mode,
  - CSRF header inclusion for state-changing requests,
  - printable HTML sanitization.
- Workflow evidence: `.github/workflows/ci.yml` includes a Security Smoke Checks job and the build depends on it.


## High Severity Follow-up Status

### 4) CSRF protection

- **Status:** Partially resolved
- **Owner:** Backend Platform
- **Evidence:**
  - `api/_middleware/csrf.ts` now enforces double-submit cookie/header match and origin/referer trust checks for state-changing requests.
  - `api/_server.ts` now applies `csrfCookie` globally so browser clients receive CSRF cookie prior to protected calls.
- **Remaining:** Ensure `/api/auth/*` backend routes use the same middleware stack when that route module is introduced.

### 5) Insufficient input validation

- **Status:** Partially resolved
- **Owner:** App + API
- **Evidence:**
  - `src/lib/services/auth.ts` now validates/sanitizes invite payloads and rejects malformed user identifiers before network requests.
- **Remaining:** Expand server-side validation to all write endpoints in auth, people, tasks, and prayer APIs.

### 6) Sensitive data in localStorage

- **Status:** Partially resolved
- **Owner:** Frontend Platform
- **Evidence:**
  - `src/hooks/useChurchSettings.ts` no longer reads/writes settings localStorage in production fallback mode.
- **Remaining:** audit other localStorage usage to ensure no sensitive data persists in production.

### 7) IDOR authorization checks

- **Status:** Partially resolved
- **Owner:** Auth/API
- **Evidence:**
  - `src/lib/services/auth.ts` rejects non-UUID user IDs client-side before role-update/removal calls.
- **Remaining:** enforce org-bound authorization checks on server routes (`/api/auth/users/:id*`) as the primary control.
