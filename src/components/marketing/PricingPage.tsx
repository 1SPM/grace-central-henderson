/**
 * Public-facing pricing page. Accessed at /pricing.
 *
 * Three tiers mirror api/_lib/billing/plans.ts (single source of
 * truth — when we rev the plans, update both). For the launch demo
 * we hard-code; production should fetch from /api/billing/plans
 * to keep client + server in sync without a deploy.
 */

type PlanGate = {
  financialHub: boolean;
  serverAgents: boolean;
  customDomain: boolean;
  cardProgram: boolean;
};

interface PlanCard {
  slug: 'starter' | 'pro' | 'enterprise';
  name: string;
  price: number;
  tagline: string;
  features: string[];
  gates: PlanGate;
  cta: string;
  highlighted?: boolean;
}

const PLANS: PlanCard[] = [
  {
    slug: 'starter',
    name: 'Starter',
    price: 49,
    tagline: 'For small churches taking the first step into digital ministry.',
    features: [
      'AI-powered church CRM',
      'Online giving via Stripe',
      'Up to 100 members',
      'Ask Grace assistant',
      'Email support',
    ],
    gates: { financialHub: false, serverAgents: false, customDomain: false, cardProgram: false },
    cta: 'Start 14-day trial',
  },
  {
    slug: 'pro',
    name: 'Pro',
    price: 199,
    tagline: 'For growing churches who want the platform to work for them.',
    features: [
      'Everything in Starter',
      'Up to 1,000 members',
      'Impact Campaigns reporting',
      'Daily AI care agents',
      'Stripe Connect with platform fee',
      'Priority support (24-hr)',
    ],
    gates: { financialHub: true, serverAgents: true, customDomain: false, cardProgram: false },
    cta: 'Start 14-day trial',
    highlighted: true,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    price: 499,
    tagline: 'For churches launching member card programs and white-labeled experiences.',
    features: [
      'Everything in Pro',
      'Unlimited members',
      'Custom domain (your.church)',
      'Member card program (i2c neobanking)',
      'White-label branding',
      'Dedicated success manager',
      'SOC 2 evidence on request',
    ],
    gates: { financialHub: true, serverAgents: true, customDomain: true, cardProgram: true },
    cta: 'Talk to sales',
  },
];

interface PricingPageProps {
  onStartTrial?: (slug: 'starter' | 'pro' | 'enterprise') => void;
}

export function PricingPage({ onStartTrial }: PricingPageProps) {
  const handleCta = (slug: 'starter' | 'pro' | 'enterprise') => {
    if (slug === 'enterprise') {
      window.location.assign('mailto:sales@grace-crm.app?subject=GRACE Enterprise inquiry');
      return;
    }
    if (onStartTrial) {
      onStartTrial(slug);
    } else {
      window.location.assign(`/signup?plan=${slug}`);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-50 to-white py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-light text-gray-900 mb-3" style={{ fontFamily: 'Fraunces, serif' }}>
            Pricing built for ministry, not enterprise.
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            14-day free trial on every plan. No card on file required to start.
            Cancel anytime from your church's billing portal.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {PLANS.map((plan) => (
            <div
              key={plan.slug}
              className={[
                'rounded-2xl border bg-white p-8 flex flex-col',
                plan.highlighted
                  ? 'border-amber-400 shadow-xl ring-2 ring-amber-200'
                  : 'border-gray-200 shadow-sm',
              ].join(' ')}
            >
              {plan.highlighted && (
                <div className="text-xs font-semibold text-amber-700 mb-2 uppercase tracking-wide">
                  Most popular
                </div>
              )}
              <h2 className="text-2xl font-medium text-gray-900 mb-1">{plan.name}</h2>
              <p className="text-sm text-gray-500 mb-6 min-h-[3rem]">{plan.tagline}</p>
              <div className="mb-6">
                <span className="text-4xl font-light text-gray-900">${plan.price}</span>
                <span className="text-gray-500 ml-1">/month</span>
              </div>
              <ul className="space-y-3 mb-8 flex-grow">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start text-sm text-gray-700">
                    <svg className="w-5 h-5 text-amber-600 mr-2 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleCta(plan.slug)}
                className={[
                  'w-full py-3 rounded-lg font-medium transition-colors',
                  plan.highlighted
                    ? 'bg-amber-600 text-white hover:bg-amber-700'
                    : 'bg-gray-900 text-white hover:bg-gray-800',
                ].join(' ')}
              >
                {plan.cta}
              </button>
            </div>
          ))}
        </div>

        <div className="text-center text-sm text-gray-500 space-y-2 max-w-3xl mx-auto">
          <p>
            <strong>Important tax note:</strong> Card spending earns the church interchange revenue
            but is NOT a tax-deductible charitable contribution. Direct donations through the giving
            portal are tax-deductible per IRS rules.
          </p>
          <p>
            Need to import existing data from Planning Center, Breeze, or ChurchTrac? Our migration
            wizard accepts standard CSV exports — free during onboarding.
          </p>
        </div>
      </div>
    </div>
  );
}
