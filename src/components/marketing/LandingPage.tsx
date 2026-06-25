/**
 * Public landing page at /. Central Henderson brand — Poppins body,
 * Montserrat/Gotham display, central-red accents, member-portal mockup.
 */

import { useState } from 'react';
import { ArrowRight, ChevronDown, Heart, CreditCard, BarChart3 } from 'lucide-react';
import { DemoCtaLink } from './DemoCtaLink';
import { MarketingShell } from './MarketingShell';
import { MarketingHeader } from './MarketingHeader';
import { MarketingFooter } from './MarketingFooter';

const MEMBER_PORTAL_MOCKUP = '/previews/assets/Memebers portal cell.png';

export function LandingPage() {
  return (
    <MarketingShell>
      <MarketingHeader />
      <Hero />
      <TrustRow />
      <Features />
      <PricingTeaser />
      <HowItWorks />
      <Faq />
      <MarketingFooter />
    </MarketingShell>
  );
}

function Hero() {
  return (
    <section className="central-container central-section pt-8 sm:pt-12 lg:pt-16">
      <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        <div className="text-center lg:text-left">
          <h1 className="font-brand text-4xl sm:text-5xl lg:text-7xl font-bold text-central-black leading-[1.08] mb-6 marketing-reveal tracking-tight">
            Spend Sunday with your people.
            <br />
            Let GRACE handle the rest.
          </h1>
          <p className="text-lg sm:text-xl text-central-grey max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed marketing-reveal marketing-reveal-delay-1 font-web">
            An AI-powered platform for churches — CRM, online giving, member care automation,
            and a financial dashboard that turns the conversation with your CFO into a five-minute meeting.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start items-center marketing-reveal marketing-reveal-delay-2">
            <DemoCtaLink href="/signup?plan=pro" className="central-btn-primary">
              Start free 14-day trial <ArrowRight size={16} />
            </DemoCtaLink>
            <a href="/pricing" className="central-btn-secondary">
              See pricing
            </a>
          </div>
          <p className="text-sm text-central-grey mt-4 marketing-reveal marketing-reveal-delay-3 font-web">
            No credit card required to start. Cancel anytime from your billing portal.
          </p>
        </div>

        <div className="relative flex justify-center lg:justify-end marketing-reveal marketing-reveal-delay-4">
          <div className="marketing-hero-glow" aria-hidden />
          <div className="relative rotate-1 hover:rotate-0 transition-transform duration-500">
            <div
              className="p-3 sm:p-4 shadow-premium-lg border border-central-line bg-central-white"
              style={{ borderRadius: 'var(--radius-card)' }}
            >
              <img
                src={MEMBER_PORTAL_MOCKUP}
                alt="GRACE Members Card Portal on iPhone — giving, care, and community at Central Henderson"
                className="w-auto h-auto max-w-[270px] sm:max-w-[300px] block"
                style={{ borderRadius: 'calc(var(--radius-card) - 2px)' }}
                width={300}
                height={650}
                loading="eager"
              />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-16 border-b border-central-line" aria-hidden />
    </section>
  );
}

function TrustRow() {
  return (
    <section className="bg-central-canvas border-y border-central-line py-12 sm:py-14">
      <div className="central-container">
        <p className="text-xs uppercase tracking-[0.2em] text-central-grey mb-4 font-brand font-semibold">
          Built for the way ministry actually works
        </p>
        <blockquote className="marketing-pull-quote text-xl sm:text-2xl text-central-black leading-relaxed max-w-3xl font-web">
          Designed alongside Central Henderson Church — not engineered in isolation from a Silicon Valley office.
        </blockquote>
      </div>
    </section>
  );
}

function Features() {
  const features = [
    {
      icon: <Heart className="w-8 h-8 text-central-red" strokeWidth={1.5} />,
      title: 'AI care agents that never sleep',
      copy:
        "Three agents quietly scan your church every morning. They flag the member who hasn't been to service in 30 days, the donor whose pattern just changed, the event next week with no leader assigned. The pastor sees the list. The platform doesn't pretend to do the visit.",
      reverse: false,
    },
    {
      icon: <CreditCard className="w-8 h-8 text-central-red" strokeWidth={1.5} />,
      title: 'Banking as ministry',
      copy:
        'On Enterprise, members can carry a church-branded debit or credit card. Every grocery run, every tank of gas, every Amazon order generates interchange revenue that flows back to the church. The math is real: $40k–$200k per 1,000 members per year.',
      reverse: true,
    },
    {
      icon: <BarChart3 className="w-8 h-8 text-central-red" strokeWidth={1.5} />,
      title: 'Impact Campaigns your CFO can read',
      copy:
        'Real-time interchange. MTD and YTD giving. Funds split by designation. Top givers with engagement signals. Append-only ledger that an auditor can trust. Zero spreadsheets.',
      reverse: false,
    },
  ];

  return (
    <section className="central-container central-section">
      <h2 className="font-brand text-3xl sm:text-4xl lg:text-5xl font-bold text-central-black mb-14 max-w-2xl leading-tight tracking-tight">
        Three platforms most churches use. One that&apos;s actually integrated.
      </h2>
      <div className="space-y-10 sm:space-y-14">
        {features.map((f) => (
          <article
            key={f.title}
            className="grid md:grid-cols-2 gap-8 md:gap-12 items-center central-card p-6 sm:p-8"
          >
            <div className={f.reverse ? 'md:order-2' : 'md:order-1'}>
              <h3 className="font-brand text-xl sm:text-2xl font-bold text-central-black mb-3">{f.title}</h3>
              <p className="text-central-grey leading-relaxed font-web">{f.copy}</p>
            </div>
            <div
              className={[
                'flex items-center justify-center min-h-[140px] rounded-[var(--radius-card)] bg-central-canvas border border-central-line',
                f.reverse ? 'md:order-1' : 'md:order-2',
              ].join(' ')}
            >
              <div
                className="w-16 h-16 flex items-center justify-center"
                style={{ borderRadius: 'var(--radius-card)', background: 'var(--central-red-soft)' }}
              >
                {f.icon}
              </div>
            </div>
          </article>
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
    <section className="central-container central-section">
      <h2 className="font-brand text-3xl sm:text-4xl font-bold text-central-black mb-3 text-center tracking-tight">
        Pricing built for ministry, not enterprise.
      </h2>
      <p className="text-center text-central-grey mb-10 font-web">14-day free trial on every plan.</p>
      <div className="grid sm:grid-cols-3 gap-4 max-w-4xl mx-auto items-end">
        {tiers.map((t) => (
          <div
            key={t.name}
            className={[
              'central-card p-6 flex flex-col',
              t.highlight ? 'shadow-premium-lg sm:-mt-2 sm:pb-8 relative overflow-hidden border-central-red' : '',
            ].join(' ')}
          >
            {t.highlight && (
              <>
                <div className="absolute top-0 left-0 right-0 h-1 bg-central-red" aria-hidden />
                <span className="text-xs font-brand font-semibold text-central-red uppercase tracking-wide mb-2">
                  Most churches start here
                </span>
              </>
            )}
            <div className="text-sm text-central-grey font-web">{t.name}</div>
            <div className="font-brand text-3xl font-bold text-central-black my-1">
              ${t.price}
              <span className="text-base text-central-grey font-web font-normal">/mo</span>
            </div>
            <div className="text-sm text-central-grey mb-4 min-h-[2.5rem] flex-grow font-web">{t.blurb}</div>
            <DemoCtaLink
              href={`/signup?plan=${t.name.toLowerCase()}`}
              className={t.highlight ? 'central-btn-primary block text-center !w-full' : 'central-btn-secondary block text-center !w-full'}
            >
              Start free trial
            </DemoCtaLink>
          </div>
        ))}
      </div>
      <p className="text-center mt-8">
        <a href="/pricing" className="text-central-red hover:opacity-80 text-sm font-semibold font-web transition-opacity duration-[180ms]">
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
    <section className="central-container central-section">
      <h2 className="font-brand text-3xl sm:text-4xl font-bold text-central-black text-center mb-14 tracking-tight">
        Onboarding takes 15 minutes.
      </h2>
      <div className="relative">
        <div className="marketing-timeline-line hidden md:block" aria-hidden />
        <div className="grid md:grid-cols-3 gap-10 md:gap-8">
          {steps.map((s) => (
            <div key={s.n} className="text-center relative">
              <div className="w-12 h-12 mx-auto rounded-full border-2 border-central-red text-central-red text-lg font-brand font-bold flex items-center justify-center mb-4 bg-central-white">
                {s.n}
              </div>
              <h3 className="font-brand text-lg font-bold text-central-black mb-2">{s.title}</h3>
              <p className="text-sm text-central-grey leading-relaxed font-web">{s.copy}</p>
            </div>
          ))}
        </div>
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
      a: "Those products are excellent CRMs. GRACE adds the financial layer they don't: real-time giving dashboard, AI care agents, and the member card program. We accept CSV imports from each of them.",
    },
    {
      q: 'What about data ownership and exit?',
      a: 'Your data is yours. Our standard DPA gives you 90 days of read access after cancellation, and CSV export is available at any time from Settings → Data.',
    },
  ];

  return (
    <section className="central-container central-section max-w-3xl">
      <h2 className="font-brand text-3xl sm:text-4xl font-bold text-central-black text-center mb-12 tracking-tight">
        Common questions
      </h2>
      <div className="space-y-3">
        {items.map((item) => (
          <FaqItem key={item.q} {...item} />
        ))}
      </div>
    </section>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={['central-card overflow-hidden transition-colors', open ? 'bg-central-canvas' : ''].join(' ')}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full px-5 py-4 text-left flex items-center justify-between hover:bg-central-canvas/60 transition-[background] duration-[180ms] font-web"
      >
        <span className="font-semibold text-central-black pr-4">{q}</span>
        <ChevronDown
          size={18}
          className={['text-central-grey transition-transform flex-shrink-0', open ? 'rotate-180' : ''].join(' ')}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 text-sm text-central-black/80 leading-relaxed border-t border-central-line pt-3 font-web">
          {a}
        </div>
      )}
    </div>
  );
}
