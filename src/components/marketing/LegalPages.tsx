/**
 * Terms / Privacy / DPA placeholder pages.
 *
 * These are TEMPLATE drafts. Production deployment requires attorney
 * review before customer #20. The structure here is the standard
 * SaaS DPA shape — fields, sections, and obligations.
 *
 * ATTORNEYS / OPERATORS: replace this file with the attorney-reviewed
 * version before significant customer growth. The template covers:
 *   - Service description + acceptable use
 *   - Subscription + payment terms (Stripe-mediated)
 *   - Data ownership + export rights
 *   - Privacy (PII handling, data residency)
 *   - Limitation of liability
 *   - Termination + 90-day grace export window
 */

interface LegalPageProps {
  title: string;
  effectiveDate?: string;
  children: React.ReactNode;
}

function LegalPage({ title, effectiveDate, children }: LegalPageProps) {
  return (
    <div className="min-h-screen bg-white py-16 px-4">
      <article className="max-w-3xl mx-auto prose prose-gray">
        <h1 className="text-3xl font-light text-gray-900 mb-2" style={{ fontFamily: 'Fraunces, serif' }}>
          {title}
        </h1>
        {effectiveDate && (
          <p className="text-sm text-gray-500 mb-8">Effective {effectiveDate}</p>
        )}
        <div className="prose-headings:font-medium prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-3 prose-h3:text-base prose-p:text-gray-700 prose-p:leading-relaxed prose-ul:text-gray-700 prose-li:my-1 text-gray-700">
          {children}
        </div>
        <div className="mt-12 pt-6 border-t border-gray-200 text-xs text-gray-500">
          <p>
            Questions about these terms? Write to{' '}
            <a className="text-amber-700 hover:text-amber-900" href="mailto:legal@grace-crm.app">
              legal@grace-crm.app
            </a>.
          </p>
          <p className="mt-2">
            <a href="/" className="text-amber-700 hover:text-amber-900">← Back to home</a>
          </p>
        </div>
      </article>
    </div>
  );
}

export function TermsPage() {
  return (
    <LegalPage title="Terms of Service" effectiveDate="May 26, 2026">
      <p>
        These Terms of Service ("Terms") govern your access to and use of GRACE, a software
        service operated by Virtual Worship Solutions Inc. ("VWS", "we", "us"). By creating
        an account or using the service, you agree to these Terms.
      </p>

      <h2>1. Service</h2>
      <p>
        GRACE is a software-as-a-service platform providing church relationship management,
        online giving processing, AI-assisted operational tooling, and (on the Enterprise
        plan) merchant card program services. The platform is provided on a subscription
        basis under the plan you select at sign-up.
      </p>

      <h2>2. Account and use</h2>
      <p>
        You are responsible for maintaining the confidentiality of your account credentials
        and for all activity under your account. You agree not to:
      </p>
      <ul>
        <li>Use the service to send unsolicited communications</li>
        <li>Attempt to access another tenant's data</li>
        <li>Reverse-engineer or copy the service</li>
        <li>Use the AI features to generate harmful or deceptive content</li>
      </ul>

      <h2>3. Subscription, billing, and cancellation</h2>
      <p>
        Subscriptions renew monthly or annually until canceled. Payment is processed by
        Stripe, Inc.; we never store full payment card data. You may cancel at any time
        from the Settings → Billing portal; cancellation takes effect at the end of the
        current billing period. We do not provide refunds for partial periods.
      </p>

      <h2>4. Data ownership</h2>
      <p>
        Your church's data — including member records, giving records, and content — remains
        your property. You may export all data at any time via CSV download from Settings
        → Data Export. On cancellation, read-only access is retained for 90 days; after
        that, your data is permanently deleted per our retention schedule.
      </p>

      <h2>5. AI features</h2>
      <p>
        GRACE uses third-party large language model providers (currently Google Gemini,
        OpenAI, and Anthropic) to power its AI-assisted features. AI outputs are suggestions
        only; you remain responsible for any pastoral or operational decisions you take based
        on them. Inference inputs are subject to our Privacy Policy and are not used by
        upstream providers for training when our paid API tier is in effect.
      </p>

      <h2>6. Card program (Enterprise only)</h2>
      <p>
        On Enterprise plans, GRACE facilitates a merchant card program operated by our
        banking partner. Interchange revenue earned by your church may be treated as
        Unrelated Business Income for federal tax purposes; please consult your accountant.
        Card spending by members is NOT a tax-deductible charitable contribution.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the maximum extent permitted by law, VWS's aggregate liability under these
        Terms shall not exceed the fees you paid in the twelve months preceding the
        claim. Nothing in these Terms limits liability for fraud, willful misconduct,
        or any liability that cannot be limited by law.
      </p>

      <h2>8. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be notified
        by email to your account administrator at least 30 days before taking effect.
      </p>

      <p className="mt-8 italic text-sm text-gray-500">
        This is a template document. Production deployment requires review by qualified
        legal counsel; this version should not be relied upon as final or definitive.
      </p>
    </LegalPage>
  );
}

export function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" effectiveDate="May 26, 2026">
      <p>
        This Privacy Policy describes how Virtual Worship Solutions Inc. ("VWS", "we",
        "us") collects, uses, and protects information you provide when using GRACE.
      </p>

      <h2>1. Information we collect</h2>
      <ul>
        <li><strong>Account data:</strong> name, email, phone (admin user)</li>
        <li><strong>Member data:</strong> data your church uploads about its members</li>
        <li><strong>Giving data:</strong> donation history, payment method (last 4 only)</li>
        <li><strong>Usage data:</strong> log of feature use, error events</li>
        <li><strong>AI conversation data:</strong> prompts and outputs from Ask Grace and care agents</li>
      </ul>

      <h2>2. How we use it</h2>
      <p>
        Account, member, and giving data are used solely to operate the service for your
        church. Usage data drives product improvement and aggregated reporting. AI
        conversation data is stored to enable continuity (re-opening a chat); it is not
        shared with other tenants and is not used to train upstream models.
      </p>

      <h2>3. Sharing</h2>
      <p>We share data only with sub-processors required to operate the service:</p>
      <ul>
        <li><strong>Supabase</strong> — database + storage (US-East data center)</li>
        <li><strong>Clerk</strong> — authentication</li>
        <li><strong>Stripe</strong> — payment processing</li>
        <li><strong>i2c + OWVI</strong> — card program (Enterprise only)</li>
        <li><strong>Google / OpenAI / Anthropic</strong> — AI inference (Pro+ features)</li>
        <li><strong>Resend / Twilio</strong> — email + SMS delivery</li>
        <li><strong>Sentry / PostHog</strong> — error monitoring + product analytics (PII-scrubbed)</li>
      </ul>

      <h2>4. PII redaction</h2>
      <p>
        We strip personally identifiable information from log lines and error reports
        before they leave our infrastructure. Email addresses, phone numbers, payment
        details, and webhook signatures are pattern-redacted automatically.
      </p>

      <h2>5. Data residency</h2>
      <p>
        Primary data resides in the United States (US-East). EU customer data may be
        replicated to EU regions on request as part of an Enterprise plan.
      </p>

      <h2>6. Your rights</h2>
      <p>
        You can export, correct, or delete data at any time from your account. For
        members of your church who request access or deletion of their own records,
        contact your church administrator. For broader requests (subject access,
        right to be forgotten under GDPR), email{' '}
        <a className="text-amber-700 hover:text-amber-900" href="mailto:privacy@grace-crm.app">
          privacy@grace-crm.app
        </a>.
      </p>

      <h2>7. Security</h2>
      <p>
        We use industry-standard encryption in transit (TLS 1.2+) and at rest (AES-256).
        Per-tenant Row-Level Security in the database structurally prevents cross-tenant
        data access. We are pursuing SOC 2 Type II certification.
      </p>

      <p className="mt-8 italic text-sm text-gray-500">
        This is a template document. Production deployment requires review by qualified
        legal counsel; this version should not be relied upon as final or definitive.
      </p>
    </LegalPage>
  );
}
