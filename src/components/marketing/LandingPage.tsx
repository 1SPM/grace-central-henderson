/**
 * Public landing page at /. The front door for prospects.
 *
 * Replaces the Clerk-only sign-in page that previously greeted
 * unauthed visitors. The pitch lands BEFORE the auth gate.
 *
 * Structure:
 *   Hero        — headline + subhead + primary CTA + secondary CTA
 *   Trust row   — small social-proof line (placeholder until pilots)
 *   Features    — three pillars: AI care, Impact Campaigns, card program
 *   Plan teaser — three pricing tiles → /pricing
 *   How it works — three-step "what changes for your church"
 *   FAQ         — three most common questions
 *   Footer      — sign in + support links
 *
 * Brand voice: warm, plain-English, never marketing-jargon. Pastors
 * don't trust SaaS pitches that sound like SaaS pitches.
 */

import { useState, type ReactNode } from 'react';
import { ArrowRight, ChevronDown, Heart, CreditCard, BarChart3, Check } from 'lucide-react';
import { isDemoModeEnabled, navigateToDemoCrm } from '../../lib/demoEntry';

function DemoCtaLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  if (isDemoModeEnabled) {
    return (
      <a
        href="#"
        className={className}
        onClick={(e) => {
          e.preventDefault();
          navigateToDemoCrm();
        }}
      >
        {children}
      </a>
    );
  }
  return (
    <a href={href} className={className}>
      {children}
    </a>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 via-white to-amber-50">
      <Header />
      <Hero />
      <TrustRow />
      <Features />
      <PricingTeaser />
      <HowItWorks />
      <Faq />
      <Footer />
    </div>
  );
}

function Header() {
  return (
    <nav className="border-b border-amber-100 bg-white/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2 font-medium text-gray-900">
          <span
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 text-white text-sm font-bold flex items-center justify-center"
            aria-hidden
          >
            G
          </span>
          <span style={{ fontFamily: 'Fraunces, serif' }}>GRACE</span>
        </a>
        <div className="flex items-center gap-2 sm:gap-6">
          <a href="/pricing" className="text-sm text-gray-700 hover:text-gray-900">Pricing</a>
          <a
            href="mailto:sales@grace-crm.app?subject=GRACE demo request"
            className="text-sm text-gray-700 hover:text-gray-900 hidden sm:inline"
          >
            Talk to sales
          </a>
          <DemoCtaLink href="/sign-in" className="text-sm text-gray-700 hover:text-gray-900">
            Sign in
          </DemoCtaLink>
          <DemoCtaLink
            href="/signup"
            className="px-4 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700"
          >
            Start trial
          </DemoCtaLink>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="max-w-5xl mx-auto px-4 pt-16 sm:pt-24 pb-12 text-center">
      <h1
        className="text-4xl sm:text-6xl font-light text-gray-900 leading-tight mb-6"
        style={{ fontFamily: 'Fraunces, serif' }}
      >
        Spend Sunday with your people.<br />
        Let GRACE handle the rest.
      </h1>
      <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto mb-8 leading-relaxed">
        An AI-powered platform for churches — CRM, online giving, member care automation,
        and a financial dashboard that turns the conversation with your CFO into a five-minute meeting.
      </p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center items-center">
        <DemoCtaLink
          href="/signup?plan=pro"
          className="px-6 py-3 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700 flex items-center gap-2"
        >
          Start free 14-day trial <ArrowRight size={16} />
        </DemoCtaLink>
        <a
          href="/pricing"
          className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-white"
        >
          See pricing
        </a>
      </div>
      <p className="text-sm text-gray-500 mt-4">
        No credit card required to start. Cancel anytime from your billing portal.
      </p>
    </section>
  );
}

function TrustRow() {
  return (
    <section className="max-w-4xl mx-auto px-4 py-8 text-center">
      <p className="text-sm uppercase tracking-wide text-gray-500 mb-3">
        Built for the way ministry actually works
      </p>
      <p className="text-base text-gray-700 max-w-2xl mx-auto">
        Designed alongside Central Henderson Church — not engineered in isolation from a Silicon Valley office.
      </p>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: <Heart className="w-6 h-6 text-amber-600" />,
      title: 'AI care agents that never sleep',
      copy:
        'Three agents quietly scan your church every morning. They flag the member who hasn\'t been to service in 30 days, the donor whose pattern just changed, the event next week with no leader assigned. The pastor sees the list. The platform doesn\'t pretend to do the visit.',
    },
    {
      icon: <CreditCard className="w-6 h-6 text-amber-600" />,
      title: 'Banking as ministry',
      copy:
        'On Enterprise, members can carry a church-branded debit or credit card. Every grocery run, every tank of gas, every Amazon order generates interchange revenue that flows back to the church. The math is real: $40k–$200k per 1,000 members per year.',
    },
    {
      icon: <BarChart3 className="w-6 h-6 text-amber-600" />,
      title: 'Impact Campaigns your CFO can read',
      copy:
        'Real-time interchange. MTD and YTD giving. Funds split by designation. Top givers with engagement signals. Append-only ledger that an auditor can trust. Zero spreadsheets.',
    },
  ];

  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <h2
        className="text-3xl sm:text-4xl font-light text-gray-900 text-center mb-12"
        style={{ fontFamily: 'Fraunces, serif' }}
      >
        Three platforms most churches use. One that's actually integrated.
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {features.map((f) => (
          <div key={f.title} className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="w-12 h-12 rounded-lg bg-amber-100 flex items-center justify-center mb-4">
              {f.icon}
            </div>
            <h3 className="font-medium text-gray-900 mb-2">{f.title}</h3>
            <p className="text-sm text-gray-600 leading-relaxed">{f.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function PricingTeaser() {
  const tiers = [
    { name: 'Starter', price: 49, blurb: 'CRM + giving for small churches' },
    { name: 'Pro', price: 199, blurb: 'Adds Impact Campaigns + AI care agents', highlight: true },
    { name: 'Enterprise', price: 499, blurb: 'Adds card program + custom domain' },
  ];
  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <h2
        className="text-3xl sm:text-4xl font-light text-gray-900 text-center mb-3"
        style={{ fontFamily: 'Fraunces, serif' }}
      >
        Pricing built for ministry, not enterprise.
      </h2>
      <p className="text-center text-gray-600 mb-10">14-day free trial on every plan.</p>
      <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={[
              'rounded-xl p-6 bg-white border',
              t.highlight ? 'border-amber-400 shadow-md' : 'border-gray-200',
            ].join(' ')}
          >
            <div className="text-sm text-gray-500">{t.name}</div>
            <div className="text-3xl font-light text-gray-900 my-1">${t.price}<span className="text-base text-gray-500">/mo</span></div>
            <div className="text-xs text-gray-600 mb-4 min-h-[2.5rem]">{t.blurb}</div>
            <DemoCtaLink
              href={`/signup?plan=${t.name.toLowerCase()}`}
              className={[
                'block text-center py-2 rounded-lg text-sm font-medium',
                t.highlight ? 'bg-amber-600 text-white hover:bg-amber-700' : 'bg-gray-100 text-gray-900 hover:bg-gray-200',
              ].join(' ')}
            >
              Start free trial
            </DemoCtaLink>
          </div>
        ))}
      </div>
      <p className="text-center mt-6">
        <a href="/pricing" className="text-amber-700 hover:text-amber-900 text-sm font-medium">
          See full plan comparison →
        </a>
      </p>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Sign up + import your roster',
      copy: 'Drag a CSV from Planning Center, Breeze, ChurchTrac, or any spreadsheet. We auto-detect the columns. Most uploads are one click.',
    },
    {
      n: '2',
      title: 'Turn on online giving',
      copy: 'Connect your Stripe account in five minutes. Members can give one-time or recurring. The platform fee is the only thing we touch.',
    },
    {
      n: '3',
      title: 'Let the agents work',
      copy: 'Member care, stewardship, and operations agents run daily. Each morning your team gets a focused list of three to ten things that need a human.',
    },
  ];
  return (
    <section className="max-w-5xl mx-auto px-4 py-16">
      <h2
        className="text-3xl sm:text-4xl font-light text-gray-900 text-center mb-12"
        style={{ fontFamily: 'Fraunces, serif' }}
      >
        Onboarding takes 15 minutes.
      </h2>
      <div className="grid md:grid-cols-3 gap-8">
        {steps.map((s) => (
          <div key={s.n} className="text-center">
            <div className="w-12 h-12 mx-auto rounded-full bg-amber-100 text-amber-800 text-xl font-medium flex items-center justify-center mb-4">
              {s.n}
            </div>
            <h3 className="font-medium text-gray-900 mb-2">{s.title}</h3>
            <p className="text-sm text-gray-600">{s.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Faq() {
  const items = [
    {
      q: 'Is interchange revenue from member spending taxable to my church?',
      a: 'Likely yes, as Unrelated Business Income (UBIT). Direct donations stay tax-deductible; interchange revenue is generally taxable. We surface this clearly to admins and recommend reviewing with your accountant.',
    },
    {
      q: 'How do you compare to Planning Center / Breeze / ChurchTrac?',
      a: 'Those products are excellent CRMs. GRACE adds the financial layer they don\'t: real-time giving dashboard, AI care agents, and the member card program. We accept CSV imports from each of them.',
    },
    {
      q: 'What about data ownership and exit?',
      a: 'Your data is yours. Our standard DPA gives you 90 days of read access after cancellation, and CSV export is available at any time from Settings → Data.',
    },
  ];
  return (
    <section className="max-w-3xl mx-auto px-4 py-16">
      <h2
        className="text-3xl sm:text-4xl font-light text-gray-900 text-center mb-12"
        style={{ fontFamily: 'Fraunces, serif' }}
      >
        Common questions
      </h2>
      <div className="space-y-3">
        {items.map((item) => <FaqItem key={item.q} {...item} />)}
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-medium text-gray-900">{q}</span>
        <ChevronDown
          size={18}
          className={['text-gray-500 transition-transform', open ? 'rotate-180' : ''].join(' ')}
        />
      </button>
      {open && <div className="px-5 pb-4 text-sm text-gray-700">{a}</div>}
    </div>
  );
}

function Footer() {
  return (
    <footer className="border-t border-amber-100 bg-white/60 backdrop-blur mt-8">
      <div className="max-w-5xl mx-auto px-4 py-10">
        <div className="grid sm:grid-cols-4 gap-8 mb-8">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-7 h-7 rounded-md bg-gradient-to-br from-amber-500 to-amber-700 text-white text-xs font-bold flex items-center justify-center">G</span>
              <span className="font-medium" style={{ fontFamily: 'Fraunces, serif' }}>GRACE</span>
            </div>
            <p className="text-sm text-gray-600 max-w-sm">
              The platform for churches that want to spend less time on paperwork
              and more time with their people.
            </p>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Product</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="/pricing" className="text-gray-700 hover:text-gray-900">Pricing</a></li>
              <li><DemoCtaLink href="/signup" className="text-gray-700 hover:text-gray-900">Start trial</DemoCtaLink></li>
              <li><DemoCtaLink href="/sign-in" className="text-gray-700 hover:text-gray-900">Sign in</DemoCtaLink></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs uppercase tracking-wide text-gray-500 mb-3">Company</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="mailto:support@grace-crm.app" className="text-gray-700 hover:text-gray-900">Support</a></li>
              <li><a href="mailto:sales@grace-crm.app" className="text-gray-700 hover:text-gray-900">Sales</a></li>
              <li><a href="/terms" className="text-gray-700 hover:text-gray-900">Terms</a></li>
              <li><a href="/privacy" className="text-gray-700 hover:text-gray-900">Privacy</a></li>
            </ul>
          </div>
        </div>
        <div className="pt-6 border-t border-amber-100 flex flex-wrap items-center justify-between gap-3 text-xs text-gray-500">
          <span>© {new Date().getFullYear()} Virtual Worship Solutions Inc.</span>
          <span className="flex items-center gap-1">
            <Check size={12} className="text-green-600" />
            SOC 2 Type II in progress · GDPR DPA available on request
          </span>
        </div>
      </div>
    </footer>
  );
}
